import { describe, it, expect } from "vitest";
import {
  interpretarRespostaBrutaIA,
  construirPromptPlanejamento,
  prepararPreviaParaSelecao,
  contarSelecionadas,
  selecionarEssenciais,
  selecionarTodas,
  limparSelecao,
  novaSugestaoManual,
  ConfirmacaoPlanejamentoSchema,
  LIMITE_MAXIMO_SUGESTOES,
  LIMITE_MAXIMO_CHECKLIST_POR_TAREFA,
  LIMITE_MAXIMO_PERGUNTAS_ESCLARECIMENTO,
  type SugestaoTarefaIA,
} from "@/lib/ecc/planejamento-ia";

function respostaOk(sugestoes: unknown[]): string {
  return JSON.stringify({ status: "ok", sugestoes });
}

describe("interpretarRespostaBrutaIA", () => {
  it("aceita uma resposta válida e normaliza os campos ausentes", () => {
    const resultado = interpretarRespostaBrutaIA(
      respostaOk([{ titulo: "Definir data e horário", recomendacao: "essencial" }]),
    );
    expect(resultado.status).toBe("ok");
    if (resultado.status !== "ok") throw new Error("esperado ok");
    expect(resultado.sugestoes).toHaveLength(1);
    expect(resultado.sugestoes[0].titulo).toBe("Definir data e horário");
    expect(resultado.sugestoes[0].descricao).toBe("");
    expect(resultado.sugestoes[0].checklist).toEqual([]);
  });

  it("JSON sintaticamente inválido vira erro recuperável, não lança exceção", () => {
    const resultado = interpretarRespostaBrutaIA("isto não é um JSON válido {{{");
    expect(resultado.status).toBe("erro");
  });

  it("JSON válido mas fora do schema esperado vira erro recuperável", () => {
    const resultado = interpretarRespostaBrutaIA(JSON.stringify({ foo: "bar" }));
    expect(resultado.status).toBe("erro");
  });

  it("sugestão sem título é descartada; se nenhuma sobrar, vira erro", () => {
    const resultado = interpretarRespostaBrutaIA(respostaOk([{ titulo: "   ", recomendacao: "opcional" }]));
    expect(resultado.status).toBe("erro");
  });

  it("corta a quantidade de sugestões no limite máximo (defesa contra o modelo exagerar)", () => {
    const muitas = Array.from({ length: LIMITE_MAXIMO_SUGESTOES + 10 }, (_, i) => ({
      titulo: `Tarefa ${i}`,
      recomendacao: "opcional",
    }));
    const resultado = interpretarRespostaBrutaIA(respostaOk(muitas));
    expect(resultado.status).toBe("ok");
    if (resultado.status !== "ok") throw new Error("esperado ok");
    expect(resultado.sugestoes).toHaveLength(LIMITE_MAXIMO_SUGESTOES);
  });

  it("trunca título/descrição/checklist muito longos em vez de rejeitar a resposta inteira", () => {
    const tituloEnorme = "A".repeat(500);
    const itemChecklistEnorme = "B".repeat(500);
    const resultado = interpretarRespostaBrutaIA(
      respostaOk([{ titulo: tituloEnorme, recomendacao: "essencial", checklist: [itemChecklistEnorme] }]),
    );
    expect(resultado.status).toBe("ok");
    if (resultado.status !== "ok") throw new Error("esperado ok");
    expect(resultado.sugestoes[0].titulo.length).toBeLessThan(500);
    expect(resultado.sugestoes[0].checklist[0].length).toBeLessThan(500);
  });

  it("corta a quantidade de itens de checklist por tarefa no limite máximo", () => {
    const checklistEnorme = Array.from({ length: LIMITE_MAXIMO_CHECKLIST_POR_TAREFA + 5 }, (_, i) => `passo ${i}`);
    const resultado = interpretarRespostaBrutaIA(respostaOk([{ titulo: "Tarefa", recomendacao: "essencial", checklist: checklistEnorme }]));
    expect(resultado.status).toBe("ok");
    if (resultado.status !== "ok") throw new Error("esperado ok");
    expect(resultado.sugestoes[0].checklist).toHaveLength(LIMITE_MAXIMO_CHECKLIST_POR_TAREFA);
  });

  it("status 'precisa_esclarecimento' devolve as perguntas, cortadas em até 3", () => {
    const muitasPerguntas = Array.from({ length: 6 }, (_, i) => `Pergunta ${i}?`);
    const resultado = interpretarRespostaBrutaIA(JSON.stringify({ status: "precisa_esclarecimento", perguntas: muitasPerguntas }));
    expect(resultado.status).toBe("precisa_esclarecimento");
    if (resultado.status !== "precisa_esclarecimento") throw new Error("esperado precisa_esclarecimento");
    expect(resultado.perguntas).toHaveLength(LIMITE_MAXIMO_PERGUNTAS_ESCLARECIMENTO);
  });
});

describe("construirPromptPlanejamento", () => {
  it("inclui o contexto literal e as regras de não inventar dado concreto", () => {
    const prompt = construirPromptPlanejamento("festa de aniversário de 8 anos");
    expect(prompt).toContain("festa de aniversário de 8 anos");
    expect(prompt).toContain("NUNCA invente data, preço, fornecedor");
  });

  it("anexa esclarecimentos anteriores sem descartar o contexto original", () => {
    const prompt = construirPromptPlanejamento("festa de aniversário", [{ pergunta: "Quantas pessoas?", resposta: "30" }]);
    expect(prompt).toContain("festa de aniversário");
    expect(prompt).toContain("Quantas pessoas?");
    expect(prompt).toContain("30");
  });
});

describe("seleção na prévia", () => {
  const base: SugestaoTarefaIA[] = [
    { idTemp: "a", titulo: "Definir data", descricao: "", recomendacao: "essencial", checklist: [] },
    { idTemp: "b", titulo: "Contratar DJ", descricao: "", recomendacao: "opcional", checklist: [] },
  ];

  it("prepararPreviaParaSelecao começa com tudo desmarcado", () => {
    const previa = prepararPreviaParaSelecao(base);
    expect(contarSelecionadas(previa)).toBe(0);
  });

  it("selecionarEssenciais marca só as essenciais", () => {
    const previa = selecionarEssenciais(prepararPreviaParaSelecao(base));
    expect(contarSelecionadas(previa)).toBe(1);
    expect(previa.find((s) => s.idTemp === "a")?.selecionada).toBe(true);
    expect(previa.find((s) => s.idTemp === "b")?.selecionada).toBe(false);
  });

  it("selecionarTodas e limparSelecao", () => {
    const todas = selecionarTodas(prepararPreviaParaSelecao(base));
    expect(contarSelecionadas(todas)).toBe(2);
    expect(contarSelecionadas(limparSelecao(todas))).toBe(0);
  });

  it("novaSugestaoManual nasce selecionada e vazia", () => {
    const nova = novaSugestaoManual();
    expect(nova.selecionada).toBe(true);
    expect(nova.titulo).toBe("");
  });
});

describe("ConfirmacaoPlanejamentoSchema — validação da prévia editada na confirmação", () => {
  it("aceita um payload válido", () => {
    const resultado = ConfirmacaoPlanejamentoSchema.safeParse({
      nome: "Aniversário do João",
      idempotencyKey: "12345678",
      tarefas: [{ titulo: "Definir data", checklist: ["Confirmar salão"] }],
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita tarefa sem título", () => {
    const resultado = ConfirmacaoPlanejamentoSchema.safeParse({
      nome: "Projeto",
      idempotencyKey: "12345678",
      tarefas: [{ titulo: "" }],
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita mais tarefas que o limite máximo", () => {
    const tarefas = Array.from({ length: LIMITE_MAXIMO_SUGESTOES + 1 }, (_, i) => ({ titulo: `Tarefa ${i}` }));
    const resultado = ConfirmacaoPlanejamentoSchema.safeParse({ nome: "Projeto", idempotencyKey: "12345678", tarefas });
    expect(resultado.success).toBe(false);
  });

  it("rejeita payload sem idempotencyKey", () => {
    const resultado = ConfirmacaoPlanejamentoSchema.safeParse({ nome: "Projeto", tarefas: [] });
    expect(resultado.success).toBe(false);
  });
});
