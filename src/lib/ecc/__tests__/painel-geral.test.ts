import { describe, it, expect, vi, afterEach } from "vitest";
import {
  saudacaoPorHorario,
  primeiroNome,
  calcularSaudeProjeto,
  selecionarMetaPrincipal,
  progressoDeTarefas,
  proximoMarco,
  prazoImportanteDaSemana,
  prazoRelativo,
  montarAlertasPrioritarios,
} from "@/lib/ecc/painel-geral";
import type { MetaSmart, Tarefa } from "@/lib/ecc/tipos";

function tarefa(parcial: Partial<Tarefa>): Pick<Tarefa, "coluna_id" | "data_limite" | "is_marco"> {
  return { coluna_id: "col-aberta", data_limite: null, is_marco: false, ...parcial };
}

describe("saudacaoPorHorario", () => {
  it("Bom dia antes do meio-dia", () => {
    expect(saudacaoPorHorario(new Date("2026-10-05T09:00:00-03:00"))).toBe("Bom dia");
  });

  it("Boa tarde entre 12h e 18h", () => {
    expect(saudacaoPorHorario(new Date("2026-10-05T14:00:00-03:00"))).toBe("Boa tarde");
  });

  it("Boa noite a partir das 18h", () => {
    expect(saudacaoPorHorario(new Date("2026-10-05T20:00:00-03:00"))).toBe("Boa noite");
  });
});

describe("primeiroNome", () => {
  it("usa a parte local do e-mail, capitalizada", () => {
    expect(primeiroNome("fabio@gaiamum.com.br")).toBe("Fabio");
  });

  it("não quebra com e-mail sem @ (defensivo)", () => {
    expect(primeiroNome("fabio")).toBe("Fabio");
  });
});

describe("calcularSaudeProjeto", () => {
  const colunasConcluidoIds = new Set(["col-concluida"]);

  it("'atencao' quando há tarefa aberta atrasada", () => {
    const tarefas = [tarefa({ data_limite: "2020-01-01T00:00:00Z" })];
    expect(calcularSaudeProjeto(tarefas, colunasConcluidoIds)).toBe("atencao");
  });

  it("'no_caminho' quando a única tarefa atrasada já está concluída", () => {
    const tarefas = [tarefa({ coluna_id: "col-concluida", data_limite: "2020-01-01T00:00:00Z" })];
    expect(calcularSaudeProjeto(tarefas, colunasConcluidoIds)).toBe("no_caminho");
  });

  it("'no_caminho' sem tarefas atrasadas", () => {
    const tarefas = [tarefa({ data_limite: null })];
    expect(calcularSaudeProjeto(tarefas, colunasConcluidoIds)).toBe("no_caminho");
  });
});

function meta(horizonte: MetaSmart["horizonte"]): MetaSmart {
  return {
    id: horizonte,
    tenant_id: "t1",
    horizonte,
    visao_macro: "x",
    specific: "x",
    measurable: "x",
    attainable: "x",
    relevant: "x",
    time_bound: "x",
    criado_em: "2026-01-01T00:00:00Z",
  };
}

describe("selecionarMetaPrincipal", () => {
  it("prefere a meta de longo prazo quando existem as duas", () => {
    const metas = [meta("medio_prazo"), meta("longo_prazo")];
    expect(selecionarMetaPrincipal(metas)?.horizonte).toBe("longo_prazo");
  });

  it("usa a de médio prazo se for a única", () => {
    const metas = [meta("medio_prazo")];
    expect(selecionarMetaPrincipal(metas)?.horizonte).toBe("medio_prazo");
  });

  it("null sem meta nenhuma", () => {
    expect(selecionarMetaPrincipal([])).toBeNull();
  });
});

describe("progressoDeTarefas", () => {
  const colunasConcluidoIds = new Set(["col-concluida"]);

  it("null sem tarefas", () => {
    expect(progressoDeTarefas([], colunasConcluidoIds)).toBeNull();
  });

  it("calcula percentual de concluídas", () => {
    const tarefas = [
      { coluna_id: "col-concluida" },
      { coluna_id: "col-concluida" },
      { coluna_id: "col-aberta" },
      { coluna_id: "col-aberta" },
    ];
    expect(progressoDeTarefas(tarefas, colunasConcluidoIds)).toBe(50);
  });
});

describe("proximoMarco", () => {
  const colunasConcluidoIds = new Set(["col-concluida"]);

  it("ignora tarefas que não são marco", () => {
    const tarefas = [tarefa({ is_marco: false, data_limite: "2026-01-01T00:00:00Z" })];
    expect(proximoMarco(tarefas, colunasConcluidoIds)).toBeNull();
  });

  it("ignora marco já concluído", () => {
    const tarefas = [
      tarefa({ is_marco: true, data_limite: "2026-01-01T00:00:00Z", coluna_id: "col-concluida" }),
    ];
    expect(proximoMarco(tarefas, colunasConcluidoIds)).toBeNull();
  });

  it("escolhe o marco com data mais próxima", () => {
    const longe = tarefa({ is_marco: true, data_limite: "2026-12-01T00:00:00Z" });
    const perto = tarefa({ is_marco: true, data_limite: "2026-11-01T00:00:00Z" });
    expect(proximoMarco([longe, perto], colunasConcluidoIds)).toBe(perto);
  });
});

describe("prazoImportanteDaSemana", () => {
  const colunasConcluidoIds = new Set(["col-concluida"]);
  afterEach(() => vi.useRealTimers());

  it("null sem nada na janela de 7 dias", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
    const tarefas = [tarefa({ data_limite: "2026-11-01T00:00:00-03:00" })];
    expect(prazoImportanteDaSemana(tarefas, colunasConcluidoIds)).toBeNull();
  });

  it("prioriza marco mesmo se houver tarefa comum com prazo mais próximo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
    const comum = tarefa({ data_limite: "2026-10-06T00:00:00-03:00", is_marco: false });
    const marco = tarefa({ data_limite: "2026-10-09T00:00:00-03:00", is_marco: true });
    expect(prazoImportanteDaSemana([comum, marco], colunasConcluidoIds)).toBe(marco);
  });

  it("sem marco na janela, cai pra tarefa comum de prazo mais próximo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
    const longe = tarefa({ data_limite: "2026-10-10T00:00:00-03:00" });
    const perto = tarefa({ data_limite: "2026-10-06T00:00:00-03:00" });
    expect(prazoImportanteDaSemana([longe, perto], colunasConcluidoIds)).toBe(perto);
  });

  it("ignora tarefas já concluídas", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
    const concluida = tarefa({ data_limite: "2026-10-06T00:00:00-03:00", coluna_id: "col-concluida" });
    expect(prazoImportanteDaSemana([concluida], colunasConcluidoIds)).toBeNull();
  });
});

describe("prazoRelativo", () => {
  afterEach(() => vi.useRealTimers());

  it("'Hoje' pra data de hoje", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
    expect(prazoRelativo("2026-10-05T18:00:00-03:00")).toBe("Hoje");
  });

  it("'Amanhã' pro dia seguinte", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
    expect(prazoRelativo("2026-10-06T18:00:00-03:00")).toBe("Amanhã");
  });

  it("nome do dia da semana até 7 dias", () => {
    vi.useFakeTimers();
    // 2026-10-05 é uma segunda-feira — 2026-10-09 é sexta.
    vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
    expect(prazoRelativo("2026-10-09T18:00:00-03:00")).toBe("Sex");
  });

  it("data curta além de 7 dias", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
    expect(prazoRelativo("2026-10-20T18:00:00-03:00")).toBe("20/10");
  });
});

describe("montarAlertasPrioritarios", () => {
  it("vazio quando nada precisa de atenção e agenda está oculta mas sem outro dado", () => {
    const alertas = montarAlertasPrioritarios({
      tarefasAtrasadas: 0,
      contasVencendoEm7Dias: null,
      compromissosHoje: 0,
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].severidade).toBe("azul");
  });

  it("ordena vermelho, depois amarelo, depois azul, no máximo 3", () => {
    const alertas = montarAlertasPrioritarios({
      tarefasAtrasadas: 2,
      contasVencendoEm7Dias: { quantidade: 1, valorTotal: 480 },
      compromissosHoje: 3,
    });
    expect(alertas.map((a) => a.severidade)).toEqual(["vermelho", "amarelo", "azul"]);
    expect(alertas[0].texto).toBe("2 tarefas atrasadas");
  });

  it("convite pra conectar agenda quando oculta", () => {
    const alertas = montarAlertasPrioritarios({
      tarefasAtrasadas: 0,
      contasVencendoEm7Dias: null,
      compromissosHoje: "oculto",
    });
    expect(alertas[0].texto).toMatch(/conecte/i);
  });
});
