import { describe, it, expect } from "vitest";
import {
  construirPromptCopiavel,
  interpretarRespostaColada,
  MARCADOR_FIM,
  MARCADOR_INICIO,
  TAMANHO_MAXIMO_RESPOSTA_COLADA,
} from "@/lib/ecc/planejamento-prompt";

const PLANO = {
  marcos: [
    { titulo: "Preparação", descricao: "Tudo pronto pra gravar" },
    { titulo: "Lançamento", descricao: "Curso no ar" },
  ],
  tarefas: [
    { titulo: "Gravar aulas", descricao: "10 aulas", recomendacao: "essencial", marco: "Preparação", checklist: ["Roteiro", "Gravar"] },
    { titulo: "Abrir carrinho", recomendacao: "essencial", marco: "Lançamento", checklist: [] },
    { titulo: "Fazer live de aquecimento", recomendacao: "opcional", marco: "Etapa que não existe" },
  ],
};

const bloco = (obj: unknown) => `${MARCADOR_INICIO}\n${JSON.stringify(obj, null, 2)}\n${MARCADOR_FIM}`;

describe("construirPromptCopiavel", () => {
  it("leva nome e objetivo digitados e os marcadores do bloco final", () => {
    const prompt = construirPromptCopiavel("Curso online", "Lançar em 3 meses");
    expect(prompt).toContain("Curso online");
    expect(prompt).toContain("Lançar em 3 meses");
    expect(prompt).toContain(MARCADOR_INICIO);
    expect(prompt).toContain(MARCADOR_FIM);
  });

  it("pede entrevista antes de planejar e proíbe inventar nome/data/preço", () => {
    const prompt = construirPromptCopiavel("X", "Y");
    expect(prompt).toMatch(/5 a 7 perguntas/);
    expect(prompt).toMatch(/NUNCA invente data, preço, fornecedor ou nome de pessoa/);
    expect(prompt).toMatch(/dados sensíveis/);
  });
});

describe("interpretarRespostaColada", () => {
  it("lê o bloco limpo: cada marco seguido das tarefas dele, e as sem marco no fim", () => {
    const r = interpretarRespostaColada(bloco(PLANO));
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.sugestoes.map((s) => [s.titulo, s.marco])).toEqual([
      ["Preparação", true],
      ["Gravar aulas", false],
      ["Lançamento", true],
      ["Abrir carrinho", false],
      ["Fazer live de aquecimento", false],
    ]);
    expect(r.sugestoes[1].checklist).toEqual(["Roteiro", "Gravar"]);
    expect(r.sugestoes[1].recomendacao).toBe("essencial");
    expect(r.sugestoes[4].recomendacao).toBe("opcional");
  });

  it("aceita a CONVERSA INTEIRA colada, ignorando o modelo de bloco que vem no próprio prompt", () => {
    const conversa = [
      construirPromptCopiavel("Curso", "Lançar curso"),
      "IA: 1. Qual o prazo? 2. Quem ajuda?",
      "Eu: 3 meses, sozinho. Pode planejar.",
      "IA: Aqui está o plano:",
      bloco(PLANO),
      "Boa sorte!",
    ].join("\n\n");
    const r = interpretarRespostaColada(conversa);
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.sugestoes[0].titulo).toBe("Preparação");
  });

  it("tolera cerca de código, aspas curvas e vírgula sobrando", () => {
    const texto = `Plano:\n${MARCADOR_INICIO}\n\`\`\`json\n{ “tarefas”: [ { “titulo”: “Contratar editor”, }, ], }\n\`\`\`\n${MARCADOR_FIM}`;
    const r = interpretarRespostaColada(texto);
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.sugestoes.map((s) => s.titulo)).toEqual(["Contratar editor"]);
  });

  it("sem marcadores, ainda acha o JSON solto", () => {
    const r = interpretarRespostaColada(`Segue: ${JSON.stringify({ tarefas: [{ titulo: "Uma tarefa" }] })}`);
    expect(r.status).toBe("ok");
  });

  it("bloco quebrado → erro amigável oferecendo pedir o bloco de novo", () => {
    const r = interpretarRespostaColada(`${MARCADOR_INICIO}\n{ "tarefas": [ { "titulo": \n${MARCADOR_FIM}`);
    expect(r).toMatchObject({ status: "erro", podeRefazerBloco: true });
  });

  it("só o modelo do prompt colado (sem plano) → erro, nunca vira plano", () => {
    const r = interpretarRespostaColada(construirPromptCopiavel("X", "Y"));
    expect(r.status).toBe("erro");
  });

  it("vazio e texto gigante são recusados", () => {
    expect(interpretarRespostaColada("   ").status).toBe("erro");
    expect(interpretarRespostaColada("x".repeat(TAMANHO_MAXIMO_RESPOSTA_COLADA + 1)).status).toBe("erro");
  });

  it("descarta item sem título sem derrubar o resto e conta os descartados", () => {
    const r = interpretarRespostaColada(bloco({ tarefas: [{ titulo: "" }, { descricao: "sem título" }, { titulo: "Válida" }] }));
    expect(r).toMatchObject({ status: "ok", descartados: 2 });
    if (r.status === "ok") expect(r.sugestoes.map((s) => s.titulo)).toEqual(["Válida"]);
  });

  it("trunca textos enormes e limita checklist a 15 itens", () => {
    const r = interpretarRespostaColada(
      bloco({ tarefas: [{ titulo: "T".repeat(500), descricao: "D".repeat(5000), checklist: Array.from({ length: 40 }, (_, i) => `passo ${i}`) }] }),
    );
    if (r.status !== "ok") throw new Error("esperava ok");
    expect(r.sugestoes[0].titulo.length).toBeLessThanOrEqual(140);
    expect(r.sugestoes[0].descricao.length).toBeLessThanOrEqual(500);
    expect(r.sugestoes[0].checklist).toHaveLength(15);
  });

  it("corta em 30 itens no total e avisa quantos ficaram de fora", () => {
    const r = interpretarRespostaColada(bloco({ tarefas: Array.from({ length: 35 }, (_, i) => ({ titulo: `Tarefa ${i}` })) }));
    expect(r).toMatchObject({ status: "ok", descartados: 5 });
    if (r.status === "ok") expect(r.sugestoes).toHaveLength(30);
  });

  it("HTML/script no texto colado vira só texto (nada é interpretado)", () => {
    const r = interpretarRespostaColada(bloco({ tarefas: [{ titulo: "<img src=x onerror=alert(1)>", checklist: [123, "ok"] }] }));
    if (r.status !== "ok") throw new Error("esperava ok");
    expect(r.sugestoes[0].titulo).toBe("<img src=x onerror=alert(1)>");
    expect(r.sugestoes[0].checklist).toEqual(["ok"]);
  });
});
