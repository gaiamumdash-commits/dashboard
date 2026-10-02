import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ rpc: rpcMock }),
}));

import { verificarRateLimitIA } from "@/lib/ecc/ia-rate-limit";

/**
 * Complementa tests/integration/rate-limit-concorrencia.test.ts (que prova
 * a atomicidade real contra Postgres) — aqui, com o RPC mockado, provamos
 * especificamente 2 critérios de aceite do P0 que não dependem de banco:
 * "indisponibilidade do controle de cota bloqueia chamada paga" (fail-closed)
 * e o comportamento de cada uma das 3 camadas isoladamente.
 */
describe("verificarRateLimitIA — bloqueio por limite e fail-closed (RPC mockado)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("permite quando as 3 camadas (usuario/workspace/global) retornam true", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    const r = await verificarRateLimitIA({ userId: "u1", tenantId: "t1" });
    expect(r.permitido).toBe(true);
    expect(rpcMock).toHaveBeenCalledTimes(3);
  });

  it("bloqueia quando só o limite por USUÁRIO estourou", async () => {
    rpcMock.mockImplementation(async (_nome: string, args: { p_escopo: string }) => ({
      data: args.p_escopo !== "usuario",
      error: null,
    }));
    const r = await verificarRateLimitIA({ userId: "u1", tenantId: "t1" });
    expect(r.permitido).toBe(false);
    if (!r.permitido) expect(r.motivo).toMatch(/minuto/i);
  });

  it("bloqueia quando só o limite por WORKSPACE estourou", async () => {
    rpcMock.mockImplementation(async (_nome: string, args: { p_escopo: string }) => ({
      data: args.p_escopo !== "workspace",
      error: null,
    }));
    const r = await verificarRateLimitIA({ userId: "u1", tenantId: "t1" });
    expect(r.permitido).toBe(false);
    if (!r.permitido) expect(r.motivo).toMatch(/workspace/i);
  });

  it("bloqueia quando só o limite GLOBAL estourou", async () => {
    rpcMock.mockImplementation(async (_nome: string, args: { p_escopo: string }) => ({
      data: args.p_escopo !== "global",
      error: null,
    }));
    const r = await verificarRateLimitIA({ userId: "u1", tenantId: "t1" });
    expect(r.permitido).toBe(false);
    if (!r.permitido) expect(r.motivo).toMatch(/Gaiamum atingiu/i);
  });

  it("FAIL-CLOSED: indisponibilidade do controle de cota (erro no RPC) bloqueia a chamada, nunca libera por padrão", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const r = await verificarRateLimitIA({ userId: "u1", tenantId: "t1" });
    expect(r.permitido).toBe(false);
  });

  it("FAIL-CLOSED: basta 1 das 3 chamadas falhar (mesmo as outras 2 permitindo) pra bloquear", async () => {
    rpcMock.mockImplementation(async (_nome: string, args: { p_escopo: string }) => {
      if (args.p_escopo === "global") return { data: null, error: { message: "timeout" } };
      return { data: true, error: null };
    });
    const r = await verificarRateLimitIA({ userId: "u1", tenantId: "t1" });
    expect(r.permitido).toBe(false);
  });

  /**
   * Achado real da revisão do P0 (2026-09-30): a 1ª versão chamava as 3
   * RPCs em paralelo (Promise.all) — uma tentativa bloqueada no limite de
   * USUÁRIO ainda incrementava a cota de WORKSPACE e GLOBAL, compartilhada
   * com todo mundo. Corrigido para sequencial com curto-circuito: os 2
   * testes abaixo prova que uma tentativa rejeitada na camada mais
   * restrita nunca chega a chamar as camadas mais amplas.
   */
  it("CORREÇÃO: bloqueio por USUÁRIO não chega a consumir cota de workspace/global (nunca chama as RPCs seguintes)", async () => {
    rpcMock.mockImplementation(async (_nome: string, args: { p_escopo: string }) => ({
      data: args.p_escopo !== "usuario",
      error: null,
    }));
    const r = await verificarRateLimitIA({ userId: "u1", tenantId: "t1" });
    expect(r.permitido).toBe(false);
    // Só a 1ª camada (usuário) foi chamada — workspace/global nunca sofrem o
    // incremento de uma tentativa que já ia ser rejeitada de qualquer forma.
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("ia_registrar_tentativa", expect.objectContaining({ p_escopo: "usuario" }));
  });

  it("CORREÇÃO: bloqueio por WORKSPACE não chega a chamar a camada GLOBAL", async () => {
    rpcMock.mockImplementation(async (_nome: string, args: { p_escopo: string }) => ({
      data: args.p_escopo !== "workspace",
      error: null,
    }));
    const r = await verificarRateLimitIA({ userId: "u1", tenantId: "t1" });
    expect(r.permitido).toBe(false);
    // Usuário (permitiu) + workspace (bloqueou) = 2 chamadas; global nunca chamado.
    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).not.toHaveBeenCalledWith("ia_registrar_tentativa", expect.objectContaining({ p_escopo: "global" }));
  });
});
