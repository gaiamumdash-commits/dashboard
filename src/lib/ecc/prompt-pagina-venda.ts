import { blocoContextoNegocio } from "@/lib/ecc/prompt-mandala";
import { parsearBlocoCampoValor } from "@/lib/ecc/parser-campo-valor";
import type { AvatarItem, PecaConteudo, PerfilNegocio, ProdutoDigital } from "@/lib/ecc/tipos";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function blocoPecaReferencia(pecaReferencia: PecaConteudo | null): string {
  if (!pecaReferencia) {
    return "Não há peça de referência escolhida — crie o gancho e o argumento central da página do zero, a partir só do contexto do negócio e do avatar acima.";
  }

  const ctaEscolhida = pecaReferencia.cta_escolhida
    ? {
        descoberta: pecaReferencia.cta_descoberta,
        relacionamento: pecaReferencia.cta_relacionamento,
        conversao: pecaReferencia.cta_conversao,
        remarketing: pecaReferencia.cta_remarketing,
      }[pecaReferencia.cta_escolhida]
    : pecaReferencia.cta_conversao;

  return `Peça de conteúdo escolhida como referência de tom e argumento (não copie literalmente, use como inspiração central da página):
Gancho: "${pecaReferencia.gancho}"
Desenvolvimento: ${pecaReferencia.paragrafo_1} ${pecaReferencia.paragrafo_2}
CTA de referência: ${ctaEscolhida}`;
}

/** Gera o prompt pra criar o texto estruturado de uma página de venda —
 * headline, blocos, prova social, preço, CTA. Operação de um turno só,
 * mesmo espírito da Mandala: todo o contexto já está no banco. */
export function gerarPromptPaginaVenda(
  perfil: PerfilNegocio,
  produto: ProdutoDigital,
  itensAvatar: AvatarItem[],
  dorUnificada: string | null,
  gatilhoCompra: string | null,
  pecaReferencia: PecaConteudo | null,
): string {
  return `Você vai me ajudar a escrever o texto estruturado da página de venda do meu produto digital.

${blocoContextoNegocio(perfil, produto, itensAvatar, dorUnificada, gatilhoCompra)}
Preço do produto: ${produto.preco !== null ? formatarMoeda(produto.preco) : "não definido"} (mencione o valor na oferta só se fizer sentido estrategicamente, nunca force uma comparação de preço artificial)

${blocoPecaReferencia(pecaReferencia)}

Escreva os seguintes blocos, nessa ordem:
- Headline: a promessa central da página, direta e específica, sem soar genérica.
- Subheadline: complementa a headline com um detalhe concreto (pra quem é, ou como funciona).
- Introdução: um parágrafo (4 a 6 linhas) que conecta a dor real do avatar com a promessa, preparando o terreno pro que vem a seguir.
- Benefícios: de 4 a 6 benefícios concretos do produto (não características — o que a pessoa ganha na prática).
- Oferta: um parágrafo curto detalhando o que está incluso no produto.
- Prova social: só inclua depoimento, número ou nome de cliente real que eu realmente tenha. Se eu não tiver informado nenhum, não invente nada — devolva exatamente "nenhuma".
- Garantia: se eu não tiver uma garantia real pra oferecer, devolva exatamente "nenhuma" em vez de inventar uma.
- CTA final: a chamada pra ação principal da página, com verbo no imperativo e o que a pessoa recebe ao clicar.

Regras de estilo em todos os blocos: zero travessão, zero ponto de exclamação, zero emoji, zero "não é X, é Y", zero pergunta na headline, zero "mesmo que"/"sem precisar". Tom de voz: ${perfil.tom_de_voz ?? "direto e confiável"}.

Feche com EXATAMENTE este bloco preenchido, cada campo numa linha só (sem quebra de linha dentro do valor, sem markdown; os benefícios separados por " | " na mesma linha):

\`\`\`
HEADLINE: ...
SUBHEADLINE: ...
INTRODUCAO: ...
BENEFICIOS: ... | ... | ...
OFERTA: ...
PROVA_SOCIAL: ... (ou "nenhuma")
GARANTIA: ... (ou "nenhuma")
CTA_FINAL: ...
\`\`\``;
}

export type ResultadoPaginaVenda = {
  headline: string;
  subheadline: string;
  introducao: string;
  beneficios: string;
  oferta: string;
  provaSocial: string | null;
  garantia: string | null;
  ctaFinal: string;
};

const VALORES_VAZIOS = new Set(["nenhuma", "nenhum", "n/a", "na"]);

function normalizarOpcional(valor: string | undefined): string | null {
  if (!valor) return null;
  const limpo = valor.trim();
  if (!limpo || VALORES_VAZIOS.has(limpo.toLowerCase())) return null;
  return limpo;
}

/** Parser determinístico (sem IA) do bloco CAMPO: valor da página de venda. */
export function parsearResultadoPaginaVenda(textoColado: string): ResultadoPaginaVenda {
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
    headline: obrigatorio("HEADLINE"),
    subheadline: obrigatorio("SUBHEADLINE"),
    introducao: obrigatorio("INTRODUCAO"),
    beneficios: obrigatorio("BENEFICIOS"),
    oferta: obrigatorio("OFERTA"),
    provaSocial: normalizarOpcional(campos.PROVA_SOCIAL),
    garantia: normalizarOpcional(campos.GARANTIA),
    ctaFinal: obrigatorio("CTA_FINAL"),
  };
}
