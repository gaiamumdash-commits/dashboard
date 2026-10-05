import { z } from "zod";
import { Type, type Schema } from "@google/genai";

/**
 * Planejamento assistido por IA (criação de projeto) — pedido do Fabio,
 * handoff canônico checkpoint #62: ao criar um projeto, descrever o objetivo
 * (texto ou voz) e a IA sugere cartões candidatos pra coluna "Tarefas",
 * revisados/selecionados pela pessoa antes de qualquer gravação no banco.
 *
 * Tudo neste arquivo é lógica PURA (sem "server-only", sem chamada de rede) —
 * testável sem stub de IA nem banco. Quem chama o Gemini de verdade é
 * `planejamento-ia-actions.ts`.
 */

export const LIMITE_MAXIMO_SUGESTOES = 20;
/** Teto de itens (marcos + tarefas) numa confirmação — maior que o da IA
 * interna porque o prompt copiável (conversa longa na IA da pessoa) traz
 * marcos além das tarefas. O banco reforça o mesmo número (migration 0055). */
export const LIMITE_MAXIMO_ITENS_PLANEJAMENTO = 30;
export const LIMITE_MAXIMO_CHECKLIST_POR_TAREFA = 15;
export const LIMITE_MAXIMO_PERGUNTAS_ESCLARECIMENTO = 3;
export const TAMANHO_MAXIMO_CONTEXTO = 4000;
const TAMANHO_MAXIMO_TITULO = 140;
const TAMANHO_MAXIMO_DESCRICAO = 500;
const TAMANHO_MAXIMO_ITEM_CHECKLIST = 200;
const TAMANHO_MAXIMO_PERGUNTA = 240;

export type RecomendacaoTarefaIA = "essencial" | "opcional";

/** Uma sugestão de cartão, já validada/saneada — o que a prévia mostra e o
 * que (se selecionada e confirmada) vira uma linha real de `tarefas`. */
export type SugestaoTarefaIA = {
  /** Id só do lado do cliente (nunca enviado como PK pro banco) — estável
   * durante a sessão da prévia, pra React key / seleção / edição. */
  idTemp: string;
  titulo: string;
  descricao: string;
  recomendacao: RecomendacaoTarefaIA;
  checklist: string[];
  /** Grande etapa do projeto — vira cartão com `is_marco` (só o caminho do
   * prompt copiável traz marcos; a IA interna sempre manda `false`). */
  marco: boolean;
};

/** Resultado de uma geração — a IA ou devolve uma prévia pronta, ou pede até
 * 3 esclarecimentos curtos antes de arriscar sugestões ruins (pedido
 * explícito: "se faltar contexto indispensável... pedir no máximo três
 * esclarecimentos curtos antes de gerar"). */
export type ResultadoGeracaoSugestoesIA =
  | { status: "ok"; sugestoes: SugestaoTarefaIA[] }
  | { status: "precisa_esclarecimento"; perguntas: string[] }
  | { status: "erro"; mensagem: string };

// ---------------------------------------------------------------------------
// Schema da resposta do modelo (JSON mode) — usado nos dois lados: monta o
// `responseSchema` que pedimos ao Gemini E valida/saneia o que ele devolve
// (um `responseSchema` reduz o risco de formato errado, mas nunca é garantia
// — a resposta do modelo é sempre dado não confiável).
// ---------------------------------------------------------------------------

// Tetos do zod aqui são só uma rede de segurança contra um payload absurdo
// (ex.: o modelo alucinando um texto de várias páginas) — o corte de
// tamanho de VERDADE (TAMANHO_MAXIMO_*, acima) é aplicado depois, por
// `truncar()`. Manter uma margem bem folgada evita rejeitar a resposta
// inteira só porque um campo passou do tamanho funcional esperado.
const TETO_BRUTO_TEXTO_CURTO = 5_000;
const TETO_BRUTO_LISTA = LIMITE_MAXIMO_SUGESTOES * 5;

const SugestaoBrutaSchema = z.object({
  titulo: z.string().trim().min(1).max(TETO_BRUTO_TEXTO_CURTO),
  descricao: z.string().trim().max(TETO_BRUTO_TEXTO_CURTO).optional().default(""),
  recomendacao: z.enum(["essencial", "opcional"]).optional().default("opcional"),
  checklist: z.array(z.string().trim().max(TETO_BRUTO_TEXTO_CURTO)).optional().default([]),
});

const RespostaBrutaIASchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    sugestoes: z.array(SugestaoBrutaSchema).max(TETO_BRUTO_LISTA),
  }),
  z.object({
    status: z.literal("precisa_esclarecimento"),
    perguntas: z.array(z.string().trim().max(TETO_BRUTO_TEXTO_CURTO)).min(1),
  }),
]);

/** `responseSchema` no formato que o SDK do Gemini espera (maiúsculas,
 * `Type.*`) — espelha `RespostaBrutaIASchema` acima; qualquer mudança num
 * dos dois exige revisar o outro. */
export const SCHEMA_RESPOSTA_PLANEJAMENTO_IA: Schema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ["ok", "precisa_esclarecimento"] },
    perguntas: { type: Type.ARRAY, items: { type: Type.STRING } },
    sugestoes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING },
          descricao: { type: Type.STRING },
          recomendacao: { type: Type.STRING, enum: ["essencial", "opcional"] },
          checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["titulo", "recomendacao"],
      },
    },
  },
  required: ["status"],
};

function truncar(texto: string, tamanho: number): string {
  const limpo = texto.trim();
  return limpo.length > tamanho ? limpo.slice(0, tamanho).trim() : limpo;
}

let proximoIdTemp = 0;
/** Gerador determinístico (não `crypto.randomUUID`) — a prévia inteira é
 * descartável e nunca é a PK real de nada, então não precisa de
 * aleatoriedade/imprevisibilidade; um contador simples também é mais fácil
 * de testar (saída estável entre execuções). */
export function gerarIdTempSugestao(): string {
  proximoIdTemp += 1;
  return `sugestao-${proximoIdTemp}`;
}

/**
 * Interpreta e SANEIA a resposta bruta (string JSON) do Gemini — nunca
 * confia no formato ou nos limites só porque pedimos `responseSchema`:
 * valida estrutura com zod, corta quantidade e tamanho de texto explicitamente.
 * Devolve `{status:"erro"}` em vez de lançar exceção — quem chama decide a
 * mensagem amigável.
 */
export function interpretarRespostaBrutaIA(jsonBruto: string): ResultadoGeracaoSugestoesIA {
  let json: unknown;
  try {
    json = JSON.parse(jsonBruto);
  } catch {
    return { status: "erro", mensagem: "A IA devolveu uma resposta num formato inesperado. Tenta de novo." };
  }

  const validado = RespostaBrutaIASchema.safeParse(json);
  if (!validado.success) {
    return { status: "erro", mensagem: "A IA devolveu uma resposta num formato inesperado. Tenta de novo." };
  }

  if (validado.data.status === "precisa_esclarecimento") {
    return {
      status: "precisa_esclarecimento",
      perguntas: validado.data.perguntas.slice(0, LIMITE_MAXIMO_PERGUNTAS_ESCLARECIMENTO).map((p) => truncar(p, TAMANHO_MAXIMO_PERGUNTA)),
    };
  }

  const sugestoes: SugestaoTarefaIA[] = validado.data.sugestoes
    .slice(0, LIMITE_MAXIMO_SUGESTOES)
    .map((bruta) => ({
      idTemp: gerarIdTempSugestao(),
      titulo: truncar(bruta.titulo, TAMANHO_MAXIMO_TITULO),
      descricao: truncar(bruta.descricao, TAMANHO_MAXIMO_DESCRICAO),
      recomendacao: bruta.recomendacao,
      checklist: bruta.checklist
        .slice(0, LIMITE_MAXIMO_CHECKLIST_POR_TAREFA)
        .map((item) => truncar(item, TAMANHO_MAXIMO_ITEM_CHECKLIST))
        .filter((item) => item.length > 0),
      marco: false,
    }))
    .filter((s) => s.titulo.length > 0);

  if (sugestoes.length === 0) {
    return { status: "erro", mensagem: "A IA não encontrou nenhuma tarefa sugerida — tenta descrever o projeto com mais detalhe." };
  }

  return { status: "ok", sugestoes };
}

/** Monta o prompt enviado ao Gemini — regras do domínio (não inventar
 * data/preço/fornecedor/disponibilidade/responsável, proporcional ao
 * projeto, respeitar exclusões explícitas, separar cartão de checklist
 * interno) ficam AQUI, nunca na UI. `respostasEsclarecimento` (se houver)
 * são as respostas às perguntas de uma rodada anterior — concatenadas ao
 * contexto original, não substituem ele. */
export function construirPromptPlanejamento(
  contexto: string,
  respostasEsclarecimento?: { pergunta: string; resposta: string }[],
): string {
  const blocoEsclarecimento =
    respostasEsclarecimento && respostasEsclarecimento.length > 0
      ? "\n\nEsclarecimentos adicionais que a pessoa já respondeu:\n" +
        respostasEsclarecimento.map((r) => `- ${r.pergunta} → ${r.resposta}`).join("\n")
      : "";

  return `Você ajuda a transformar a ideia de um projeto em tarefas práticas, dentro de um app de produtividade (Gaiamum).

Contexto do projeto, descrito pela própria pessoa (texto livre ou transcrição de voz — pode ter imprecisões de transcrição):
"""
${contexto}
"""${blocoEsclarecimento}

Sua tarefa: devolver um JSON (conforme o schema pedido) com UMA das duas respostas:

1. Se o contexto já for suficiente pra sugerir tarefas úteis: "status": "ok" e uma lista de 8 a 15 sugestões de tarefas (limite rígido: 20), proporcional à complexidade real do projeto descrito — não encha a lista com tarefas artificiais só pra bater um número.

2. Se faltar informação indispensável pra qualquer sugestão útil (ex.: contexto vago demais, "quero fazer um evento" sem dizer qual): "status": "precisa_esclarecimento" com no máximo 3 perguntas curtas e diretas. Use isso com moderação — prefira sugerir uma tarefa como "Definir X" a interromper o fluxo, a menos que realmente não dê pra sugerir nada útil sem a resposta.

Regras de conteúdo, OBRIGATÓRIAS:
- NUNCA invente data, preço, fornecedor, disponibilidade ou responsável concretos. Quando uma dessas informações falta, sugira uma TAREFA pra defini-la (ex.: "Definir data e horário"), nunca um valor chutado.
- Considere objetivo, prazo, orçamento, participantes, se é execução individual ou em equipe, e qualquer preferência ou exclusão explícita (se a pessoa disser "não quero X", NUNCA sugira X nem nada equivalente).
- Extras (ex.: DJ, fotografia, decoração temática) só quando coerentes com o contexto dado — nunca como padrão.
- Cada sugestão é uma AÇÃO independente e acompanhável (vira um cartão). Passos que são sub-etapas da MESMA ação vão no campo "checklist" dela (ex.: cartão "Solicitar orçamentos de salões" → checklist: ["Confirmar capacidade", "Verificar disponibilidade", "Conferir serviços incluídos"]) — nunca duplique a mesma atividade como cartão E como item de checklist, e não desmembre cada detalhe pequeno num cartão separado.
- "recomendacao": "essencial" pras tarefas sem as quais o projeto não avança, "opcional" pro resto — é uma recomendação pra ajudar a pessoa a escolher, não uma trava.
- "descricao" é curta (1-2 frases), explicando o cartão — pode ficar vazia se o título já for autoexplicativo.
- Responda só com o JSON — sem comentário, markdown ou texto fora do schema.`;
}

// ---------------------------------------------------------------------------
// Prévia — estado client-side (seleção, edição) e funções puras sobre ele.
// ---------------------------------------------------------------------------

export type SugestaoNaPrevia = SugestaoTarefaIA & { selecionada: boolean };

export function prepararPreviaParaSelecao(sugestoes: SugestaoTarefaIA[]): SugestaoNaPrevia[] {
  return sugestoes.map((s) => ({ ...s, selecionada: false }));
}

export function contarSelecionadas(previa: SugestaoNaPrevia[]): number {
  return previa.filter((s) => s.selecionada).length;
}

export function selecionarEssenciais(previa: SugestaoNaPrevia[]): SugestaoNaPrevia[] {
  return previa.map((s) => ({ ...s, selecionada: s.recomendacao === "essencial" }));
}

export function selecionarTodas(previa: SugestaoNaPrevia[]): SugestaoNaPrevia[] {
  return previa.map((s) => ({ ...s, selecionada: true }));
}

export function limparSelecao(previa: SugestaoNaPrevia[]): SugestaoNaPrevia[] {
  return previa.map((s) => ({ ...s, selecionada: false }));
}

/** Nova sugestão em branco, pra "adicionar tarefa manualmente" na prévia —
 * nasce já selecionada (a pessoa acabou de pedir por ela). */
export function novaSugestaoManual(): SugestaoNaPrevia {
  return { idTemp: gerarIdTempSugestao(), titulo: "", descricao: "", recomendacao: "opcional", checklist: [], marco: false, selecionada: true };
}

// ---------------------------------------------------------------------------
// Validação da prévia editada, no momento da confirmação — "o navegador não
// é fonte de autorização": a Server Action de confirmação roda isto de novo
// sobre o que o cliente mandou, nunca confia na prévia só porque já tinha
// passado pela validação da geração.
// ---------------------------------------------------------------------------

export const TarefaConfirmadaSchema = z.object({
  titulo: z.string().trim().min(1).max(TAMANHO_MAXIMO_TITULO),
  descricao: z.string().trim().max(TAMANHO_MAXIMO_DESCRICAO).optional().default(""),
  checklist: z.array(z.string().trim().max(TAMANHO_MAXIMO_ITEM_CHECKLIST)).max(LIMITE_MAXIMO_CHECKLIST_POR_TAREFA).optional().default([]),
  marco: z.boolean().optional().default(false),
});

export const ConfirmacaoPlanejamentoSchema = z.object({
  nome: z.string().trim().min(1).max(140),
  descricao: z.string().trim().max(1000).optional().default(""),
  idempotencyKey: z.string().trim().min(8).max(100),
  tarefas: z.array(TarefaConfirmadaSchema).max(LIMITE_MAXIMO_ITENS_PLANEJAMENTO),
});

export type ConfirmacaoPlanejamento = z.infer<typeof ConfirmacaoPlanejamentoSchema>;

/** Mesma validação, pro planejamento dentro de um projeto que já existe. */
export const AdicionarPlanejamentoSchema = z.object({
  projetoId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(100),
  tarefas: z.array(TarefaConfirmadaSchema).min(1).max(LIMITE_MAXIMO_ITENS_PLANEJAMENTO),
});
