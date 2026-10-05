import { describe, it, expect } from "vitest";
import {
  resumirProgressoQuadro,
  contarEmFoco,
  prazosDeHoje,
  focoAtivoDoUsuario,
  fracaoDecorridaHiperfoco,
  segundosRestantesHiperfoco,
  formatarCronometro,
  proximoCompromisso,
  horarioDeInicio,
  filtrarTarefasDoQuadro,
  filtroQuadroAtivo,
  FILTRO_QUADRO_VAZIO,
} from "@/lib/ecc/kanban-cabecalho";
import type { CompromissoDoDia } from "@/lib/ecc/agenda";
import type { Tarefa } from "@/lib/ecc/tipos";

describe("resumirProgressoQuadro", () => {
  it("mesma fórmula da barra antiga: concluídas / total, arredondado", () => {
    const tarefas = [{ coluna_id: "ok" }, { coluna_id: "ok" }, { coluna_id: "a" }];
    expect(resumirProgressoQuadro(tarefas, "ok")).toEqual({ concluidas: 2, total: 3, abertas: 1, percentual: 67 });
  });

  it("quadro vazio = 0%, sem divisão por zero", () => {
    expect(resumirProgressoQuadro([], "ok")).toEqual({ concluidas: 0, total: 0, abertas: 0, percentual: 0 });
  });

  it("sem coluna Concluído, nada conta como concluído", () => {
    expect(resumirProgressoQuadro([{ coluna_id: "a" }], null).concluidas).toBe(0);
  });
});

describe("contarEmFoco", () => {
  it("conta só cartões em coluna com dispara_hiperfoco", () => {
    const colunas = [
      { id: "dev", dispara_hiperfoco: true },
      { id: "hoje", dispara_hiperfoco: false },
    ];
    expect(contarEmFoco([{ coluna_id: "dev" }, { coluna_id: "hoje" }, { coluna_id: "dev" }], colunas)).toBe(2);
  });
});

describe("prazosDeHoje", () => {
  const concluido = new Set(["fim"]);
  const t = (parcial: Partial<Tarefa>) => ({ coluna_id: "a", data_limite: null, is_marco: false, ...parcial });

  it("conta só prazos na data civil de hoje (fuso Brasil), fora o concluído", () => {
    const tarefas = [
      t({ data_limite: "2026-10-05T17:00:00Z" }), // 14h Brasília
      t({ data_limite: "2026-10-06T02:30:00Z" }), // 23h30 do dia 05 em Brasília — ainda é hoje
      t({ data_limite: "2026-10-06T12:00:00Z" }), // amanhã
      t({ data_limite: "2026-10-05T15:00:00Z", coluna_id: "fim" }), // concluído
      t({}),
    ];
    expect(prazosDeHoje(tarefas, concluido, "2026-10-05").quantidade).toBe(2);
  });

  it("destaque prefere marco, senão o horário mais cedo", () => {
    const cedo = t({ data_limite: "2026-10-05T12:00:00Z" });
    const marco = t({ data_limite: "2026-10-05T20:00:00Z", is_marco: true });
    expect(prazosDeHoje([cedo, marco], concluido, "2026-10-05").destaque).toBe(marco);
    expect(prazosDeHoje([cedo], concluido, "2026-10-05").destaque).toBe(cedo);
  });

  it("nenhum prazo hoje → 0 e destaque null", () => {
    expect(prazosDeHoje([t({})], concluido, "2026-10-05")).toEqual({ quantidade: 0, destaque: null });
  });
});

describe("focoAtivoDoUsuario", () => {
  const base = { hiperfoco_iniciado_em: "2026-10-05T12:00:00Z", tempo_estimado_min: 30, hiperfoco_user_id: "eu" };

  it("acha o cronômetro da pessoa logada", () => {
    const outro = { ...base, hiperfoco_user_id: "outro" };
    expect(focoAtivoDoUsuario([outro, base], "eu")).toBe(base);
  });

  it("ignora cartão sem duração e usuário anônimo", () => {
    expect(focoAtivoDoUsuario([{ ...base, tempo_estimado_min: null }], "eu")).toBeNull();
    expect(focoAtivoDoUsuario([base], null)).toBeNull();
  });
});

describe("cronômetro", () => {
  const inicio = "2026-10-05T12:00:00Z";
  const inicioMs = new Date(inicio).getTime();

  it("fração decorrida limitada a [0, 1]", () => {
    expect(fracaoDecorridaHiperfoco(inicio, 30, inicioMs + 15 * 60_000)).toBeCloseTo(0.5);
    expect(fracaoDecorridaHiperfoco(inicio, 30, inicioMs + 60 * 60_000)).toBe(1);
    expect(fracaoDecorridaHiperfoco(inicio, 30, inicioMs - 1000)).toBe(0);
  });

  it("segundos restantes nunca negativos", () => {
    expect(segundosRestantesHiperfoco(inicio, 30, inicioMs + 60_000)).toBe(29 * 60);
    expect(segundosRestantesHiperfoco(inicio, 30, inicioMs + 31 * 60_000)).toBe(0);
  });

  it("formata mm:ss e h:mm:ss", () => {
    expect(formatarCronometro(18 * 60 + 42)).toBe("18:42");
    expect(formatarCronometro(65)).toBe("01:05");
    expect(formatarCronometro(3600 + 5 * 60 + 9)).toBe("1:05:09");
    expect(formatarCronometro(-3)).toBe("00:00");
  });
});

describe("proximoCompromisso", () => {
  const c = (id: string, ordem: number): CompromissoDoDia => ({ id, titulo: id, horario: "", ordem });

  it("primeiro que começa a partir de agora, ignorando dia inteiro", () => {
    const agora = 1_000;
    expect(proximoCompromisso([c("passado", 500), c("dia-inteiro", 0), c("depois", 3_000), c("logo", 2_000)], agora)?.id).toBe(
      "logo",
    );
  });

  it("null quando não sobra nenhum", () => {
    expect(proximoCompromisso([c("passado", 500)], 1_000)).toBeNull();
  });
});

describe("horarioDeInicio", () => {
  it("pega só o início do intervalo", () => {
    expect(horarioDeInicio("14:00–15:00")).toBe("14:00");
    expect(horarioDeInicio("Dia inteiro")).toBe("Dia inteiro");
  });
});

describe("filtrarTarefasDoQuadro", () => {
  const tarefas = [
    { id: "1", titulo: "Revisão do orçamento", prioridade: "P1" as const },
    { id: "2", titulo: "Filmar comercial", prioridade: "P3" as const },
    { id: "3", titulo: "Editar comercial", prioridade: "P2" as const },
  ];
  const contexto = {
    tarefasDoUsuario: new Set(["2"]),
    etiquetasPorTarefa: new Map([["3", new Set(["et-video"])]]),
  };

  it("sem filtro devolve a mesma lista", () => {
    expect(filtroQuadroAtivo(FILTRO_QUADRO_VAZIO)).toBe(false);
    expect(filtrarTarefasDoQuadro(tarefas, FILTRO_QUADRO_VAZIO, contexto)).toBe(tarefas);
  });

  it("busca ignora acento e maiúscula", () => {
    const r = filtrarTarefasDoQuadro(tarefas, { ...FILTRO_QUADRO_VAZIO, busca: "REVISAO" }, contexto);
    expect(r.map((t) => t.id)).toEqual(["1"]);
  });

  it("critérios combinam com E", () => {
    const r = filtrarTarefasDoQuadro(tarefas, { ...FILTRO_QUADRO_VAZIO, busca: "comercial", somenteMinhas: true }, contexto);
    expect(r.map((t) => t.id)).toEqual(["2"]);
  });

  it("prioridade e etiqueta com OU dentro do critério", () => {
    expect(
      filtrarTarefasDoQuadro(tarefas, { ...FILTRO_QUADRO_VAZIO, prioridades: ["P1", "P2"] }, contexto).map((t) => t.id),
    ).toEqual(["1", "3"]);
    expect(
      filtrarTarefasDoQuadro(tarefas, { ...FILTRO_QUADRO_VAZIO, etiquetaIds: ["et-video"] }, contexto).map((t) => t.id),
    ).toEqual(["3"]);
  });
});
