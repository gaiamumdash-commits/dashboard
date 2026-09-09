import { blocoContextoNegocio } from "@/lib/ecc/prompt-mandala";
import { parsearBlocoCampoValor } from "@/lib/ecc/parser-campo-valor";
import type { AvatarItem, PaginaVenda, PecaConteudo, PerfilNegocio, ProdutoDigital } from "@/lib/ecc/tipos";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function blocoReferenciaVsl(pecaReferencia: PecaConteudo | null, paginaReferencia: PaginaVenda | null): string {
  if (paginaReferencia) {
    return `Página de venda já gerada como referência de tom e argumento (não copie literalmente, use como base do roteiro):
Headline: "${paginaReferencia.headline}"
Introdução: ${paginaReferencia.introducao}
Oferta: ${paginaReferencia.oferta}
CTA: ${paginaReferencia.cta_final}`;
  }

  if (pecaReferencia) {
    const ctaEscolhida = pecaReferencia.cta_escolhida
      ? {
          descoberta: pecaReferencia.cta_descoberta,
          relacionamento: pecaReferencia.cta_relacionamento,
          conversao: pecaReferencia.cta_conversao,
          remarketing: pecaReferencia.cta_remarketing,
        }[pecaReferencia.cta_escolhida]
      : pecaReferencia.cta_conversao;

    return `Peça de conteúdo escolhida como referência de tom e argumento (não copie literalmente, use como inspiração):
Gancho: "${pecaReferencia.gancho}"
Desenvolvimento: ${pecaReferencia.paragrafo_1} ${pecaReferencia.paragrafo_2}
CTA de referência: ${ctaEscolhida}`;
  }

  return "Não há referência escolhida — crie o roteiro do zero, a partir só do contexto do negócio e do avatar acima.";
}

/** Gera o prompt pra criar o roteiro falado de uma VSL — 7 blocos com tempo
 * estimado por bloco, pra guiar a gravação. Operação de um turno só, mesmo
 * espírito da Página de Venda: todo o contexto já está no banco. */
export function gerarPromptVsl(
  perfil: PerfilNegocio,
  produto: ProdutoDigital,
  itensAvatar: AvatarItem[],
  dorUnificada: string | null,
  gatilhoCompra: string | null,
  pecaReferencia: PecaConteudo | null,
  paginaReferencia: PaginaVenda | null,
): string {
  return `Você vai me ajudar a escrever o roteiro falado (VSL) do meu produto digital — o texto que eu vou ler em voz alta na gravação do vídeo de venda.

${blocoContextoNegocio(perfil, produto, itensAvatar, dorUnificada, gatilhoCompra)}
${blocoReferenciaVsl(pecaReferencia, paginaReferencia)}

Escreva os seguintes blocos, nessa ordem, cada um pensado pra ser LIDO EM VOZ ALTA (frases curtas, ritmo de fala, não de texto escrito):
- Gancho: os primeiros segundos, pra prender a atenção antes que a pessoa pule o vídeo.
- Identificação da dor: nomeia a dor real do avatar de um jeito que a pessoa se reconheça imediatamente.
- Agitação: aprofunda a consequência de continuar sem resolver essa dor, sem exagero nem alarmismo.
- Virada/solução: o momento em que apresento a solução e o porquê ela funciona.
- Prova: só inclua depoimento, número ou resultado real que eu realmente tenha. Se eu não tiver informado nenhum, não invente nada — devolva exatamente "nenhuma".
- Oferta: o que está incluso no produto (mencione o preço, ${produto.preco !== null ? formatarMoeda(produto.preco) : "não definido"}, só se fizer sentido estrategicamente, nunca force uma comparação artificial).
- CTA final: a chamada pra ação, com verbo no imperativo e o que a pessoa recebe ao agir.

Pra cada bloco, além do texto, me diga um tempo estimado de fala (formato curto, ex: "~15s" ou "~30-45s") — serve de guia na hora de gravar.

Regras de estilo em todos os blocos: zero travessão, zero ponto de exclamação, zero emoji, zero "não é X, é Y", zero pergunta no gancho, zero "mesmo que"/"sem precisar". Tom de voz: ${perfil.tom_de_voz ?? "direto e confiável"}.

Feche com EXATAMENTE este bloco preenchido, cada campo numa linha só (sem quebra de linha dentro do valor, sem markdown):

\`\`\`
TEMPO_GANCHO: ...
GANCHO: ...
TEMPO_IDENTIFICACAO_DOR: ...
IDENTIFICACAO_DOR: ...
TEMPO_AGITACAO: ...
AGITACAO: ...
TEMPO_VIRADA: ...
VIRADA: ...
TEMPO_PROVA: ... (ou "nenhuma")
PROVA: ... (ou "nenhuma")
TEMPO_OFERTA: ...
OFERTA: ...
TEMPO_CTA_FINAL: ...
CTA_FINAL: ...
\`\`\``;
}

export type ResultadoVsl = {
  tempoGancho: string | null;
  gancho: string;
  tempoIdentificacaoDor: string | null;
  identificacaoDor: string;
  tempoAgitacao: string | null;
  agitacao: string;
  tempoVirada: string | null;
  virada: string;
  tempoProva: string | null;
  prova: string | null;
  tempoOferta: string | null;
  oferta: string;
  tempoCtaFinal: string | null;
  ctaFinal: string;
};

const VALORES_VAZIOS = new Set(["nenhuma", "nenhum", "n/a", "na"]);

function normalizarOpcional(valor: string | undefined): string | null {
  if (!valor) return null;
  const limpo = valor.trim();
  if (!limpo || VALORES_VAZIOS.has(limpo.toLowerCase())) return null;
  return limpo;
}

/** Parser determinístico (sem IA) do bloco CAMPO: valor do roteiro de VSL. */
export function parsearResultadoVsl(textoColado: string): ResultadoVsl {
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

  const prova = normalizarOpcional(campos.PROVA);

  return {
    tempoGancho: normalizarOpcional(campos.TEMPO_GANCHO),
    gancho: obrigatorio("GANCHO"),
    tempoIdentificacaoDor: normalizarOpcional(campos.TEMPO_IDENTIFICACAO_DOR),
    identificacaoDor: obrigatorio("IDENTIFICACAO_DOR"),
    tempoAgitacao: normalizarOpcional(campos.TEMPO_AGITACAO),
    agitacao: obrigatorio("AGITACAO"),
    tempoVirada: normalizarOpcional(campos.TEMPO_VIRADA),
    virada: obrigatorio("VIRADA"),
    tempoProva: prova ? normalizarOpcional(campos.TEMPO_PROVA) : null,
    prova,
    tempoOferta: normalizarOpcional(campos.TEMPO_OFERTA),
    oferta: obrigatorio("OFERTA"),
    tempoCtaFinal: normalizarOpcional(campos.TEMPO_CTA_FINAL),
    ctaFinal: obrigatorio("CTA_FINAL"),
  };
}
