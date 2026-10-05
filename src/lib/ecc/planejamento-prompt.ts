import { z } from "zod";
import { gerarIdTempSugestao, LIMITE_MAXIMO_CHECKLIST_POR_TAREFA, LIMITE_MAXIMO_ITENS_PLANEJAMENTO, type SugestaoTarefaIA } from "@/lib/ecc/planejamento-ia";

/**
 * "Planejar com IA" por prompt copiável — Fase 1 (pedido do Fabio,
 * 2026-10-05, docs/gaiamum/FRENTES-RECEITAS-E-PROMPT-IA-2026-10-05.md).
 *
 * A pessoa copia um prompt, conversa na IA que preferir (ChatGPT, Gemini,
 * Claude...) e cola de volta a resposta final. Custo zero de IA pro Gaiamum,
 * e a pessoa ganha uma conversa de verdade em vez de 3 perguntas.
 *
 * Lógica PURA (sem rede, sem banco). O texto colado é DADO NÃO CONFIÁVEL:
 * tamanho máximo, zod, truncamento — e a UI só mostra como texto puro.
 */

export const MARCADOR_INICIO = "===GAIAMUM-INICIO===";
export const MARCADOR_FIM = "===GAIAMUM-FIM===";
export const TAMANHO_MAXIMO_OBJETIVO = 2000;
/** Uma conversa inteira colada por engano ainda cabe; acima disso é lixo. */
export const TAMANHO_MAXIMO_RESPOSTA_COLADA = 100_000;
const LIMITE_MAXIMO_MARCOS = 10;
const TAMANHO_MAXIMO_TITULO = 140;
const TAMANHO_MAXIMO_DESCRICAO = 500;
const TAMANHO_MAXIMO_ITEM_CHECKLIST = 200;

/** Frase que a pessoa manda pra IA dela quando o bloco veio quebrado. */
export const FRASE_REFAZER_BLOCO = `Gere de novo só o bloco final do Gaiamum, entre ${MARCADOR_INICIO} e ${MARCADOR_FIM}, em JSON válido, sem nenhum texto fora dele.`;

/** Atalhos — só links, nenhuma integração (decisão do Fabio, 2026-10-05). */
export const LINKS_IAS = [
  { nome: "ChatGPT", url: "https://chatgpt.com/" },
  { nome: "Gemini", url: "https://gemini.google.com/" },
  { nome: "Claude", url: "https://claude.ai/new" },
] as const;

/** Monta o prompt copiável. NÃO leva nenhum dado do banco — só o nome do
 * projeto e o objetivo que a própria pessoa digitou nesta tela. */
export function construirPromptCopiavel(nomeProjeto: string, objetivo: string): string {
  const nome = nomeProjeto.trim().slice(0, 140) || "(sem nome ainda)";
  const texto = objetivo.trim().slice(0, TAMANHO_MAXIMO_OBJETIVO) || "(a pessoa ainda vai explicar na conversa)";

  return `Você vai me ajudar a planejar um projeto que vou executar no Gaiamum, um app de gestão de projetos com quadro Kanban.

Projeto: ${nome}
O que eu quero alcançar, nas minhas palavras:
"""
${texto}
"""

Como conduzir a conversa:

1. ANTES de planejar, me entreviste. Faça no máximo 5 a 7 perguntas por rodada, curtas e numeradas, e espere minhas respostas. Cubra, ao longo da conversa:
   - o objetivo e como vou saber que deu certo (um indicador ou resultado concreto);
   - o prazo final e as datas que já existem;
   - quem está envolvido e o papel de cada um;
   - recursos e orçamento disponíveis;
   - restrições e o que eu NÃO quero fazer.
   Se eu já tiver respondido algo, não pergunte de novo. Se eu disser "pode planejar", planeje com o que tiver.

2. Depois faça a engenharia reversa: do resultado final para as grandes etapas (marcos), das etapas para as tarefas, e de cada tarefa para um checklist de passos curtos.

3. Regras do planejamento:
   - NUNCA invente data, preço, fornecedor ou nome de pessoa. Se faltar, crie uma tarefa para definir (ex.: "Definir data de lançamento").
   - Responsável só por PAPEL (ex.: "financeiro", "designer"), nunca por nome.
   - Se eu disser que não quero algo, não sugira nada parecido.
   - Proporcional ao tamanho do projeto: de 3 a 6 marcos e no máximo 20 tarefas no total.
   - Cada tarefa é uma ação que dá para acompanhar sozinha; sub-passos da mesma ação vão no checklist dela.
   - Privacidade: se eu colar dados sensíveis (CPF, senhas, dados bancários, de saúde ou de clientes), me avise e não repita esses dados no plano.

4. Quando eu aprovar o plano, entregue o bloco final EXATAMENTE neste formato, em JSON válido, entre as duas linhas marcadoras, sem nada dentro além do JSON:

${MARCADOR_INICIO}
{
  "marcos": [
    { "titulo": "Nome da etapa", "descricao": "O que marca o fim desta etapa" }
  ],
  "tarefas": [
    {
      "titulo": "Ação curta e concreta",
      "descricao": "1 ou 2 frases explicando",
      "recomendacao": "essencial ou opcional",
      "marco": "Nome da etapa a que esta tarefa pertence",
      "checklist": ["Passo 1", "Passo 2"]
    }
  ]
}
${MARCADOR_FIM}

Comece agora pelas perguntas da primeira rodada.`;
}

// ---------------------------------------------------------------------------
// Leitura da resposta colada
// ---------------------------------------------------------------------------

const MarcoColadoSchema = z.object({
  titulo: z.string(),
  descricao: z.string().optional().nullable(),
});

const TarefaColadaSchema = z.object({
  titulo: z.string(),
  descricao: z.string().optional().nullable(),
  recomendacao: z.string().optional().nullable(),
  marco: z.string().optional().nullable(),
  checklist: z.array(z.unknown()).optional().nullable(),
});

const BlocoColadoSchema = z.object({
  marcos: z.array(z.unknown()).optional().nullable(),
  tarefas: z.array(z.unknown()).optional().nullable(),
});

export type ResultadoRespostaColada =
  | { status: "ok"; sugestoes: SugestaoTarefaIA[]; descartados: number }
  | { status: "erro"; mensagem: string; podeRefazerBloco: boolean };

function truncar(texto: string, tamanho: number): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > tamanho ? limpo.slice(0, tamanho).trim() : limpo;
}

/** Conserta os "enfeites" mais comuns de IA de chat antes do JSON.parse:
 * cerca de código, aspas curvas e vírgula sobrando antes de } ou ]. */
function limparJson(bruto: string): string {
  return bruto
    .replace(/```(?:json)?/gi, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

/** Candidatos a JSON, do mais provável pro menos: blocos entre marcadores
 * (do ÚLTIMO pro primeiro — se a pessoa colar a conversa inteira, o primeiro
 * bloco é o modelo do próprio prompt, que não é o plano), e por fim o maior
 * trecho entre a primeira "{" e a última "}". */
export function candidatosDeBloco(texto: string): string[] {
  const candidatos: string[] = [];
  const partes = texto.split(MARCADOR_INICIO);
  for (let i = partes.length - 1; i >= 1; i--) {
    const fim = partes[i].indexOf(MARCADOR_FIM);
    candidatos.push(fim >= 0 ? partes[i].slice(0, fim) : partes[i]);
  }
  const primeiraChave = texto.indexOf("{");
  const ultimaChave = texto.lastIndexOf("}");
  if (primeiraChave >= 0 && ultimaChave > primeiraChave) {
    candidatos.push(texto.slice(primeiraChave, ultimaChave + 1));
  }
  return candidatos;
}

/** O prompt traz um MODELO do bloco — se a conversa inteira for colada, ele
 * nunca pode ser confundido com o plano de verdade. */
const TEXTO_DO_MODELO = "Ação curta e concreta";

function lerBloco(texto: string): z.infer<typeof BlocoColadoSchema> | null {
  for (const candidato of candidatosDeBloco(texto)) {
    if (candidato.includes(TEXTO_DO_MODELO)) continue;
    try {
      const json = JSON.parse(limparJson(candidato));
      const validado = BlocoColadoSchema.safeParse(json);
      if (validado.success && ((validado.data.tarefas?.length ?? 0) > 0 || (validado.data.marcos?.length ?? 0) > 0)) {
        return validado.data;
      }
    } catch {
      // tenta o próximo candidato
    }
  }
  return null;
}

/**
 * Interpreta o texto colado e devolve a prévia, na ordem em que deve virar
 * cartão: cada marco seguido das tarefas dele; depois as tarefas sem marco.
 * Itens malformados são descartados um a um (nunca derrubam o resto).
 */
export function interpretarRespostaColada(textoColado: string): ResultadoRespostaColada {
  const texto = textoColado.trim();
  if (!texto) {
    return { status: "erro", mensagem: "Cole aqui a resposta final da sua IA.", podeRefazerBloco: false };
  }
  if (texto.length > TAMANHO_MAXIMO_RESPOSTA_COLADA) {
    return {
      status: "erro",
      mensagem: "O texto colado está grande demais. Cole só a resposta final da IA, com o bloco GAIAMUM.",
      podeRefazerBloco: true,
    };
  }

  const bloco = lerBloco(texto);
  if (!bloco) {
    return {
      status: "erro",
      mensagem: "Não encontrei o plano no texto colado. Peça pra sua IA gerar de novo só o bloco GAIAMUM e cole aqui.",
      podeRefazerBloco: true,
    };
  }

  let descartados = 0;

  const marcos: { titulo: string; descricao: string }[] = [];
  for (const bruto of bloco.marcos ?? []) {
    const m = MarcoColadoSchema.safeParse(bruto);
    const titulo = m.success ? truncar(m.data.titulo, TAMANHO_MAXIMO_TITULO) : "";
    if (!titulo || marcos.length >= LIMITE_MAXIMO_MARCOS) {
      descartados++;
      continue;
    }
    marcos.push({ titulo, descricao: truncar(m.success ? (m.data.descricao ?? "") : "", TAMANHO_MAXIMO_DESCRICAO) });
  }

  type TarefaLida = Omit<SugestaoTarefaIA, "idTemp" | "marco"> & { marcoDaTarefa: string };
  const tarefas: TarefaLida[] = [];
  for (const bruto of bloco.tarefas ?? []) {
    const t = TarefaColadaSchema.safeParse(bruto);
    const titulo = t.success ? truncar(t.data.titulo, TAMANHO_MAXIMO_TITULO) : "";
    if (!t.success || !titulo) {
      descartados++;
      continue;
    }
    tarefas.push({
      titulo,
      descricao: truncar(t.data.descricao ?? "", TAMANHO_MAXIMO_DESCRICAO),
      recomendacao: (t.data.recomendacao ?? "").toLowerCase().startsWith("essencial") ? "essencial" : "opcional",
      checklist: (t.data.checklist ?? [])
        .filter((item): item is string => typeof item === "string")
        .map((item) => truncar(item, TAMANHO_MAXIMO_ITEM_CHECKLIST))
        .filter((item) => item.length > 0)
        .slice(0, LIMITE_MAXIMO_CHECKLIST_POR_TAREFA),
      marcoDaTarefa: truncar(t.data.marco ?? "", TAMANHO_MAXIMO_TITULO),
    });
  }

  const normalizar = (s: string) => s.toLowerCase().trim();
  const sugestoes: SugestaoTarefaIA[] = [];
  const usadas = new Set<number>();

  const paraSugestao = (t: TarefaLida): SugestaoTarefaIA => ({
    idTemp: gerarIdTempSugestao(),
    titulo: t.titulo,
    descricao: t.descricao,
    recomendacao: t.recomendacao,
    checklist: t.checklist,
    marco: false,
  });

  for (const m of marcos) {
    sugestoes.push({ idTemp: gerarIdTempSugestao(), titulo: m.titulo, descricao: m.descricao, recomendacao: "essencial", checklist: [], marco: true });
    tarefas.forEach((t, i) => {
      if (!usadas.has(i) && t.marcoDaTarefa && normalizar(t.marcoDaTarefa) === normalizar(m.titulo)) {
        usadas.add(i);
        sugestoes.push(paraSugestao(t));
      }
    });
  }
  tarefas.forEach((t, i) => {
    if (!usadas.has(i)) sugestoes.push(paraSugestao(t));
  });

  if (sugestoes.length === 0) {
    return { status: "erro", mensagem: "O plano colado não tem nenhuma tarefa nem marco com título.", podeRefazerBloco: true };
  }

  const cortados = Math.max(0, sugestoes.length - LIMITE_MAXIMO_ITENS_PLANEJAMENTO);
  return { status: "ok", sugestoes: sugestoes.slice(0, LIMITE_MAXIMO_ITENS_PLANEJAMENTO), descartados: descartados + cortados };
}
