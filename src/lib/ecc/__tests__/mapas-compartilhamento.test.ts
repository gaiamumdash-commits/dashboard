import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  camposDoCompartilhamento,
  compartilhamentoDoMapa,
  ehCompartilhamento,
  seloCompartilhamento,
} from "@/lib/ecc/mapas/compartilhamento";

/**
 * Compartilhar mapa (migration 0063): o dono escolhe "Só eu", "Equipe" ou
 * "Equipe e convidados". A RLS é a garantia (tests/integration/rls-mapas);
 * aqui, a tradução escolha ↔ colunas e a Server Action (Supabase falso).
 */

describe("regra de compartilhamento", () => {
  it("escolha ↔ colunas, nos dois sentidos", () => {
    for (const c of ["privado", "equipe", "todos"] as const) {
      expect(compartilhamentoDoMapa(camposDoCompartilhamento(c))).toBe(c);
    }
    expect(camposDoCompartilhamento("privado")).toEqual({ compartilhado: false, inclui_convidados: false });
    expect(camposDoCompartilhamento("equipe")).toEqual({ compartilhado: true, inclui_convidados: false });
    expect(camposDoCompartilhamento("todos")).toEqual({ compartilhado: true, inclui_convidados: true });
  });

  it("sem a coluna da 0063, mapa compartilhado conta como 'equipe'; convidados sem compartilhar = privado", () => {
    expect(compartilhamentoDoMapa({ compartilhado: true })).toBe("equipe");
    expect(compartilhamentoDoMapa({ compartilhado: false, inclui_convidados: true })).toBe("privado");
  });

  it("só aceita as três opções", () => {
    expect(ehCompartilhamento("equipe")).toBe(true);
    expect(ehCompartilhamento("publico")).toBe(false);
    expect(ehCompartilhamento(undefined)).toBe(false);
  });

  it("selo na lista: dono vê com quem; quem recebe vê 'só leitura'", () => {
    expect(seloCompartilhamento("privado", true)).toBeNull();
    expect(seloCompartilhamento("equipe", true)).toBe("compartilhado com a equipe");
    expect(seloCompartilhamento("todos", true)).toBe("compartilhado com equipe e convidados");
    expect(seloCompartilhamento("todos", false)).toBe("só leitura");
  });
});

// --------------------------------------------------------------------------
// Server Action
// --------------------------------------------------------------------------

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/ecc/workspace", () => ({ garantirWorkspace: vi.fn().mockResolvedValue("tenant-1") }));
vi.mock("@/lib/ecc/actions", () => ({ atualizarDatasTarefa: vi.fn(), criarTarefa: vi.fn(), iniciarHiperfoco: vi.fn() }));
vi.mock("@/lib/ecc/notificacoes", () => ({ enviarEmailResumoMapa: vi.fn() }));

const obterUsuarioAtualMock = vi.fn();
const createClientMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ obterUsuarioAtual: obterUsuarioAtualMock, createClient: createClientMock }));

const MAPA = "11111111-1111-1111-1111-111111111111";

/** Supabase falso: registra update/filtros e devolve `resposta` no fim. */
function supabaseFalso(resposta: { data: unknown; error: { code?: string; message: string } | null }) {
  const chamadas = { tabela: "", update: null as unknown, filtros: [] as [string, unknown][] };
  const cadeia = {
    update(campos: unknown) {
      chamadas.update = campos;
      return cadeia;
    },
    eq(coluna: string, valor: unknown) {
      chamadas.filtros.push([coluna, valor]);
      return cadeia;
    },
    select: () => Promise.resolve(resposta),
  };
  createClientMock.mockResolvedValue({
    from(tabela: string) {
      chamadas.tabela = tabela;
      return cadeia;
    },
  });
  return chamadas;
}

beforeEach(() => {
  vi.clearAllMocks();
  obterUsuarioAtualMock.mockResolvedValue({ id: "user-1", email: "a@teste.invalid" });
});

describe("definirCompartilhamento", () => {
  it("grava as DUAS colunas, filtrando por mapa, workspace e dono", async () => {
    const chamadas = supabaseFalso({ data: [{ id: MAPA }], error: null });
    const { definirCompartilhamento } = await import("@/lib/ecc/mapas/actions");

    expect(await definirCompartilhamento(MAPA, "equipe")).toEqual({ ok: true });
    expect(chamadas.tabela).toBe("mapas");
    expect(chamadas.update).toEqual({ compartilhado: true, inclui_convidados: false });
    expect(chamadas.filtros).toEqual([
      ["id", MAPA],
      ["tenant_id", "tenant-1"],
      ["user_id", "user-1"],
    ]);
  });

  it("quem não é dono (nenhuma linha alterada) recebe mensagem clara", async () => {
    supabaseFalso({ data: [], error: null });
    const { definirCompartilhamento } = await import("@/lib/ecc/mapas/actions");
    const r = await definirCompartilhamento(MAPA, "todos");
    expect(r).toEqual({ ok: false, erro: "Só quem criou o mapa pode mudar o compartilhamento." });
  });

  it("sem a migration 0063 (coluna inexistente), avisa e não compartilha", async () => {
    supabaseFalso({ data: null, error: { code: "42703", message: "column does not exist" } });
    const { definirCompartilhamento } = await import("@/lib/ecc/mapas/actions");
    const r = await definirCompartilhamento(MAPA, "equipe");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/0063/);
  });

  it("opção ou id inválidos nem chegam ao banco", async () => {
    const { definirCompartilhamento } = await import("@/lib/ecc/mapas/actions");
    expect((await definirCompartilhamento(MAPA, "publico" as never)).ok).toBe(false);
    expect((await definirCompartilhamento("nao-e-uuid", "equipe")).ok).toBe(false);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
