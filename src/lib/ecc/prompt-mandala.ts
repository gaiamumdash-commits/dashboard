import { parsearBlocoCampoValor } from "@/lib/ecc/parser-campo-valor";
import type { AvatarItem, FaseFunil, IdeiaConteudo, PerfilNegocio, ProdutoDigital, TipoAnuncio } from "@/lib/ecc/tipos";

export const ROTULO_TIPO_ANUNCIO: Record<TipoAnuncio, string> = {
  ultra_segmentado: "Ultra segmentado",
  problema_solucao: "Problema e solução",
  pesquisa_cientifica: "Pesquisa científica",
  atualidades_trend: "Atualidades e trends",
};

const DESCRICAO_TIPO_ANUNCIO: Record<TipoAnuncio, string> = {
  ultra_segmentado:
    "fala direto com um subgrupo bem específico do público (uma situação, faixa de idade, momento de vida ou característica bem particular) — a pessoa precisa sentir que o anúncio foi escrito só pra ela.",
  problema_solucao:
    "nomeia um problema concreto e específico que esse público tem hoje, e aponta o caminho prático pra resolver — não um problema genérico, um problema que a pessoa reconheceria imediatamente como o dela.",
  pesquisa_cientifica:
    "usa um estudo, dado de pesquisa ou descoberta real como ponto de partida — a premissa precisa soar específica (instituição, número de participantes, prazo), nunca uma estatística vaga.",
  atualidades_trend:
    "conecta um assunto cultural em alta agora (filme, série, notícia, meme, polêmica) com o nicho do produto, de um jeito que faça sentido pro público — se não souber o que está em alta agora, pesquise antes de gerar os títulos.",
};

function blocoContextoIdeias(
  perfil: PerfilNegocio,
  produto: ProdutoDigital,
  itensAvatar: AvatarItem[],
  dorUnificada: string | null,
  gatilhoCompra: string | null,
): string {
  const dores = itensAvatar.filter((i) => i.tipo === "dor").map((i) => `- ${i.texto}`);
  const desejos = itensAvatar.filter((i) => i.tipo === "desejo").map((i) => `- ${i.texto}`);

  return `Contexto do negócio:
Nicho: ${perfil.nicho}
Tom de voz: ${perfil.tom_de_voz ?? "não definido, use um tom direto e confiável"}

Produto: ${produto.nome} (${produto.formato})
Promessa do produto: ${produto.promessa ?? "não definida"}

Dores do cliente ideal:
${dores.join("\n") || "- não mapeadas"}

Desejos do cliente ideal:
${desejos.join("\n") || "- não mapeados"}

Dor unificada (o núcleo por trás de tudo): ${dorUnificada ?? "não definida"}
O que dispara a decisão de compra: ${gatilhoCompra ?? "não definido"}
`;
}

/** Gera o prompt pra criar 12 ganchos de um tipo de anúncio — reescrito do
 * zero a partir da lógica de "avisar ou ensinar, nunca vender" (nunca
 * copiar texto/exemplos de fonte externa). Operação de um turno só: todo o
 * contexto já está no banco, não existe sessão/histórico pra carregar. */
export function gerarPromptIdeias(
  perfil: PerfilNegocio,
  produto: ProdutoDigital,
  itensAvatar: AvatarItem[],
  dorUnificada: string | null,
  gatilhoCompra: string | null,
  tipo: TipoAnuncio,
): string {
  return `Você vai me ajudar a criar ganchos de anúncio pro meu produto digital.

${blocoContextoIdeias(perfil, produto, itensAvatar, dorUnificada, gatilhoCompra)}
Tipo de anúncio escolhido — ${ROTULO_TIPO_ANUNCIO[tipo]}: ${DESCRICAO_TIPO_ANUNCIO[tipo]}

Gere 12 ganchos (títulos curtos) numerados de 1 a 12, seguindo estas regras em todos eles:
- Cada gancho avisa algo que eu não sabia ou ensina um pedaço de conhecimento real — nunca vende, nunca promete de forma vaga.
- Nunca é uma pergunta.
- Tem pelo menos um elemento de especificidade: um número, uma situação concreta, um cenário real — nada de frase genérica tipo "transforme seu negócio".
- Zero travessão, zero ponto de exclamação, zero emoji, zero "não é X, é Y", zero "mesmo que"/"sem precisar".
- O nome do produto ou a palavra "curso"/"treinamento"/"compre" não aparece no gancho.
- Cada gancho puxa um ângulo diferente — não repita a mesma ideia com palavras trocadas.
- Tom de voz: ${perfil.tom_de_voz ?? "direto e confiável"}.

Devolva só a lista numerada, sem nada antes ou depois:

1. ...
2. ...
...
12. ...`;
}

const LINHA_IDEIA = /^\s*(\d{1,2})[.)]\s+(.+)$/;

/** Parser determinístico (sem IA) da lista numerada de ganchos. */
export function parsearListaIdeias(textoColado: string): { numero: number; titulo: string }[] {
  const ideias: { numero: number; titulo: string }[] = [];
  for (const linha of textoColado.split("\n")) {
    const match = linha.match(LINHA_IDEIA);
    if (match) {
      ideias.push({ numero: Number(match[1]), titulo: match[2].trim() });
    }
  }

  if (ideias.length === 0) {
    throw new Error('Nenhuma ideia numerada encontrada no texto colado. Confirme que colou a lista no formato "1. texto".');
  }

  return ideias;
}

const DESCRICAO_CTA: Record<FaseFunil, string> = {
  descoberta:
    'pede pra seguir o perfil, sempre com um motivo concreto (ex.: "se você quer aprender X de verdade, segue esse perfil") — nunca só "salva ou comenta", nunca menciona frequência de postagem.',
  relacionamento: "pede uma interação leve: marcar um amigo, comentar, salvar ou compartilhar.",
  conversao:
    'convida pro próximo passo (assistir uma aula, baixar um material, ver o conteúdo completo) — nunca pede a compra diretamente.',
  remarketing: "pode pedir a ação final: comprar agora, garantir a vaga.",
};

export const ROTULO_FASE_FUNIL: Record<FaseFunil, string> = {
  descoberta: "Descoberta",
  relacionamento: "Relacionamento",
  conversao: "Conversão",
  remarketing: "Remarketing",
};

/** Gera o prompt pra desenvolver a copy completa (2 parágrafos + 4 CTAs) a
 * partir de um gancho já escolhido. */
export function gerarPromptCopy(
  perfil: PerfilNegocio,
  produto: ProdutoDigital,
  itensAvatar: AvatarItem[],
  dorUnificada: string | null,
  gatilhoCompra: string | null,
  ideia: Pick<IdeiaConteudo, "titulo_gancho" | "tipo_anuncio">,
): string {
  return `Você vai me ajudar a desenvolver a copy completa de um anúncio a partir de um gancho que eu já escolhi.

${blocoContextoIdeias(perfil, produto, itensAvatar, dorUnificada, gatilhoCompra)}
Gancho escolhido (não mude, use exatamente este): "${ideia.titulo_gancho}"

Desenvolva em dois parágrafos (4 a 6 linhas cada, sem esticar):
- Parágrafo 1: entrega o pedaço de conhecimento prometido no gancho — o mecanismo, uma comparação de antes/depois quando fizer sentido, um dado ou situação específica. Eu preciso aprender algo real aqui.
- Parágrafo 2: conecta o que foi ensinado com a dor real por trás da dor que a pessoa diria em voz alta, prepara o terreno pro CTA, fala com razão e emoção ao mesmo tempo. Continua sem soar vendedor. O produto só pode ser citado aqui, nunca no gancho ou no parágrafo 1.

Regras de estilo, iguais às do gancho: zero travessão, zero ponto de exclamação, zero emoji, zero "não é X, é Y", zero pergunta, zero "mesmo que"/"sem precisar". Tom de voz: ${perfil.tom_de_voz ?? "direto e confiável"}.

Depois dos parágrafos, escreva 4 opções de CTA, uma pra cada fase do funil:
- Descoberta: ${DESCRICAO_CTA.descoberta}
- Relacionamento: ${DESCRICAO_CTA.relacionamento}
- Conversão: ${DESCRICAO_CTA.conversao}
- Remarketing: ${DESCRICAO_CTA.remarketing}

Cada CTA com verbo no imperativo + o que a pessoa vai receber, nunca só "saiba mais" ou "clique aqui".

Feche com EXATAMENTE este bloco preenchido, cada campo numa linha só (sem quebra de linha dentro do valor, sem markdown):

\`\`\`
PARAGRAFO_1: ...
PARAGRAFO_2: ...
CTA_DESCOBERTA: ...
CTA_RELACIONAMENTO: ...
CTA_CONVERSAO: ...
CTA_REMARKETING: ...
\`\`\``;
}

export type ResultadoCopy = {
  paragrafo1: string;
  paragrafo2: string;
  ctaDescoberta: string;
  ctaRelacionamento: string;
  ctaConversao: string;
  ctaRemarketing: string;
};

/** Parser determinístico (sem IA) do bloco CAMPO: valor da copy final. */
export function parsearResultadoCopy(textoColado: string): ResultadoCopy {
  const campos = parsearBlocoCampoValor(textoColado);

  function obrigatorio(chave: string): string {
    const valor = campos[chave];
    if (!valor) {
      throw new Error(
        `Campo "${chave}" não encontrado no texto colado. Volte ao Claude, peça pra incluir esse campo no bloco final, e cole de novo.`,
      );
    }
    return valor;
  }

  return {
    paragrafo1: obrigatorio("PARAGRAFO_1"),
    paragrafo2: obrigatorio("PARAGRAFO_2"),
    ctaDescoberta: obrigatorio("CTA_DESCOBERTA"),
    ctaRelacionamento: obrigatorio("CTA_RELACIONAMENTO"),
    ctaConversao: obrigatorio("CTA_CONVERSAO"),
    ctaRemarketing: obrigatorio("CTA_REMARKETING"),
  };
}
