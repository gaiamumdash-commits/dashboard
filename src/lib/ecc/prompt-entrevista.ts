import { ExtracaoEntrevistaSchema, type ExtracaoEntrevista } from "@/lib/ecc/entrevista-schemas";
import type { EstagioEntrevista, EtapaEntrevistaColada } from "@/lib/ecc/tipos";

export const ETAPAS: Exclude<EstagioEntrevista, "concluida">[] = [
  "situacao",
  "problema",
  "implicacao",
  "necessidade",
];

export const ROTULO_ETAPA: Record<Exclude<EstagioEntrevista, "concluida">, string> = {
  situacao: "Situação",
  problema: "Problema",
  implicacao: "Implicação",
  necessidade: "Necessidade",
};

const INSTRUCAO_ETAPA: Record<Exclude<EstagioEntrevista, "concluida">, string> = {
  situacao:
    "me pergunte, uma pergunta de cada vez, sobre o que eu faço hoje — se já vendo algum produto digital ou meu trabalho ainda é 100% presencial/offline, e pra quem eu vendo ou atendo hoje.",
  problema:
    "me pergunte, uma de cada vez, sobre as minhas dores reais hoje — o que trava minha divulgação/vendas, o que eu já tentei e não resolveu.",
  implicacao:
    "me ajude a enxergar o que continuar assim está me custando — o que eu perco, o peso real de não resolver isso. Pergunte, uma de cada vez.",
  necessidade:
    "me ajude a descrever, com minhas próprias palavras, como seria o cenário ideal — o que eu realmente quero que aconteça. Se eu ainda não tiver um produto digital, me ajude a moldar um a partir do que eu sei fazer, não pule esse ponto. Pergunte, uma de cada vez.",
};

function blocoContexto(etapasAnteriores: EtapaEntrevistaColada[]): string {
  if (etapasAnteriores.length === 0) return "";
  const partes = etapasAnteriores.map(
    (e) => `--- ${ROTULO_ETAPA[e.estagio]} ---\n${e.texto_colado}`,
  );
  return `Aqui está o que já conversamos até agora:\n\n${partes.join("\n\n")}\n\n`;
}

/** Gera o prompt de uma etapa da entrevista — reescrito do zero a partir da
 * lógica de 4 estágios (nunca copiar texto de fonte externa). Cada prompt é
 * autocontido (funciona mesmo se o Fabio começar uma conversa nova no
 * Claude a cada etapa) e carrega o contexto já reunido nas etapas
 * anteriores — sem nenhuma chamada de API, é só montagem de texto. */
export function gerarPromptEtapa(
  estagio: Exclude<EstagioEntrevista, "concluida">,
  etapasAnteriores: EtapaEntrevistaColada[],
): string {
  return `Você vai me ajudar a entender melhor o meu próprio negócio de produtos digitais, através de uma entrevista rápida.

${blocoContexto(etapasAnteriores)}Nesta etapa, ${ROTULO_ETAPA[estagio].toUpperCase()}: ${INSTRUCAO_ETAPA[estagio]} Não apresente solução nenhuma, só pergunte e escute.

Quando sentir que já entendeu essa parte, feche com um resumo curto (3-5 linhas) do que você entendeu.

Comece agora com a primeira pergunta.`;
}

const CAMPOS_FINAIS = `NOME_NEGOCIO: ...
NICHO: ...
TOM_DE_VOZ: ...
RESUMO_DIAGNOSTICO: ...
PRODUTO_NOME: ...
PRODUTO_FORMATO: curso ou ebook ou mentoria ou template ou comunidade ou outro
PRODUTO_PROMESSA: ...
DOR_1: ...
DOR_2: ...
DOR_3: ...
DOR_4: ...
DOR_5: ...
DESEJO_1: ...
DESEJO_2: ...
DESEJO_3: ...
DESEJO_4: ...
DESEJO_5: ...
DOR_UNIFICADA: ...
GATILHO_COMPRA: ...`;

export function gerarPromptExtracaoFinal(etapas: EtapaEntrevistaColada[]): string {
  return `${blocoContexto(etapas)}Com base em tudo isso, feche a entrevista com EXATAMENTE este bloco preenchido (sem inventar nada que eu não tenha dito — se faltar algo, escreva sua melhor inferência marcada como "(inferido)"). Cada campo numa linha só, sem markdown dentro do valor:

\`\`\`
${CAMPOS_FINAIS}
\`\`\``;
}

const FORMATOS_VALIDOS = ["curso", "ebook", "mentoria", "template", "comunidade", "outro"] as const;

/** Parser determinístico (sem IA) do bloco CAMPO: valor que o Claude gera
 * no final da entrevista. Lança erro com o nome exato do campo faltando,
 * pra pedir só o que falta em vez de refazer tudo. */
export function parsearResultadoEntrevista(textoColado: string): ExtracaoEntrevista {
  const campos: Record<string, string> = {};
  for (const linha of textoColado.split("\n")) {
    const match = linha.match(/^([A-Z_0-9]+):\s?(.*)$/);
    if (match && match[2].trim()) {
      campos[match[1]] = match[2].trim();
    }
  }

  function obrigatorio(chave: string): string {
    const valor = campos[chave];
    if (!valor) {
      throw new Error(
        `Campo "${chave}" não encontrado no texto colado. Volte ao Claude, peça pra incluir esse campo no bloco final, e cole de novo.`,
      );
    }
    return valor;
  }

  const formato = obrigatorio("PRODUTO_FORMATO").toLowerCase();
  if (!FORMATOS_VALIDOS.includes(formato as (typeof FORMATOS_VALIDOS)[number])) {
    throw new Error(`PRODUTO_FORMATO "${formato}" inválido — use um de: ${FORMATOS_VALIDOS.join(", ")}.`);
  }

  const extracao: ExtracaoEntrevista = {
    perfil: {
      nome_negocio: obrigatorio("NOME_NEGOCIO"),
      nicho: obrigatorio("NICHO"),
      tom_de_voz: obrigatorio("TOM_DE_VOZ"),
      resumo_diagnostico: obrigatorio("RESUMO_DIAGNOSTICO"),
    },
    produto: {
      nome: obrigatorio("PRODUTO_NOME"),
      formato: formato as ExtracaoEntrevista["produto"]["formato"],
      promessa: obrigatorio("PRODUTO_PROMESSA"),
    },
    avatar: {
      dores: [1, 2, 3, 4, 5].map((i) => obrigatorio(`DOR_${i}`)),
      desejos: [1, 2, 3, 4, 5].map((i) => obrigatorio(`DESEJO_${i}`)),
      dor_unificada: obrigatorio("DOR_UNIFICADA"),
      gatilho_compra: obrigatorio("GATILHO_COMPRA"),
    },
  };

  return ExtracaoEntrevistaSchema.parse(extracao);
}
