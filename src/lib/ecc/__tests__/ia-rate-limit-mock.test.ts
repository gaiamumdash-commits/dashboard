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
});
