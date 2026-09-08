/** Parser determinístico (sem IA) de fala transcrita em português pra
 * campos de compromisso — título, início, fim opcional e antecedência de
 * alarme. É best-effort de propósito: o resultado sempre passa por uma
 * tela de confirmação editável antes de criar o compromisso de verdade
 * (ver `formulario-evento-agenda.tsx`), então não precisa cobrir 100% do
 * português natural, só os padrões mais comuns de fala de compromisso.
 *
 * Todo casamento de regex roda sobre uma versão SEM ACENTO do texto (a
 * fala pode vir transcrita com ou sem acento, dependendo do motor de
 * reconhecimento) — os índices batem 1:1 com o texto de trabalho (NFC)
 * porque `removerAcentos` nunca muda o número de caracteres, então dá
 * pra recortar o trecho certo do texto original e preservar a
 * acentuação de quem falou no título final. Nenhuma regex neste arquivo
 * deve conter caracteres acentuados — só a versão sem acento é
 * comparada. */

export type ResultadoParserFalaAgenda = {
  titulo: string;
  /** "AAAA-MM-DDTHH:mm", mesmo formato de <input type="datetime-local">. */
  inicioLocal: string;
  fimLocal: string | null;
  /** 0 = sem alarme. */
  antecedenciaMin: number;
};

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  "segunda-feira": 1,
  segunda: 1,
  "terca-feira": 2,
  terca: 2,
  "quarta-feira": 3,
  quarta: 3,
  "quinta-feira": 4,
  quinta: 4,
  "sexta-feira": 5,
  sexta: 5,
  sabado: 6,
};

/** Faixa Unicode dos diacríticos combinantes (acentos) na forma NFD —
 * usados via código numérico, nunca como literal no código-fonte, pra
 * não depender de como o editor/terminal normaliza caracteres
 * acentuados (foi exatamente essa inconsistência que causou um bug real
 * de parsing, descoberto testando com texto acentuado de verdade). */
const DIACRITICO_COMBINANTE_INICIO = 0x0300;
const DIACRITICO_COMBINANTE_FIM = 0x036f;

function removerAcentos(texto: string): string {
  return Array.from(texto.normalize("NFD"))
    .filter((caractere) => {
      const codigo = caractere.codePointAt(0) ?? 0;
      return codigo < DIACRITICO_COMBINANTE_INICIO || codigo > DIACRITICO_COMBINANTE_FIM;
    })
    .join("");
}

/** Casa `regex` (escrita só com ASCII, sem acento) contra a versão sem
 * acento de `texto`, mas devolve o `RegExpMatchArray` com índice válido
 * pra recortar o `texto` original (mesmo comprimento em ambas as
 * versões, char a char). */
function casarSemAcento(texto: string, regex: RegExp): RegExpMatchArray | null {
  return removerAcentos(texto).match(regex);
}

function removerTrecho(texto: string, match: RegExpMatchArray): string {
  const inicio = match.index ?? 0;
  const fim = inicio + match[0].length;
  return texto.slice(0, inicio) + " " + texto.slice(fim);
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize("NFC");
}

function paraStringLocal(data: Date, hora: number, minuto: number): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  const hh = String(hora).padStart(2, "0");
  const mm = String(minuto).padStart(2, "0");
  return `${ano}-${mes}-${dia}T${hh}:${mm}`;
}

function somarDias(data: Date, dias: number): Date {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function extrairAntecedencia(texto: string): { restante: string; antecedenciaMin: number } {
  const regexUnidade: Record<string, number> = { minuto: 1, hora: 60, dia: 1440 };
  const regex = /(?:(?:me\s+)?(?:avis[ae]|lembr[ae])\s+.*?)?(\d+)\s*(minuto|hora|dia)s?\s+antes/i;
  const match = casarSemAcento(texto, regex);
  if (!match) return { restante: texto, antecedenciaMin: 0 };
  const quantidade = Number(match[1]);
  const unidade = regexUnidade[match[2].toLowerCase()] ?? 0;
  return { restante: removerTrecho(texto, match), antecedenciaMin: quantidade * unidade };
}

function extrairIntervaloHorario(
  texto: string,
): { restante: string; horaInicio: number | null; minInicio: number; horaFim: number | null; minFim: number } {
  const regex = /das?\s+(\d{1,2})(?:[:h](\d{2}))?\s*h?\s*as?\s+(\d{1,2})(?:[:h](\d{2}))?\s*h?/i;
  const match = casarSemAcento(texto, regex);
  if (!match) {
    return { restante: texto, horaInicio: null, minInicio: 0, horaFim: null, minFim: 0 };
  }
  const horaInicio = Number(match[1]);
  const minInicio = match[2] ? Number(match[2]) : 0;
  const horaFim = Number(match[3]);
  const minFim = match[4] ? Number(match[4]) : 0;
  return { restante: removerTrecho(texto, match), horaInicio, minInicio, horaFim, minFim };
}

function extrairHorarioSimples(texto: string): { restante: string; hora: number | null; minuto: number } {
  const meioDia = casarSemAcento(texto, /\bmeio[- ]dia\b/i);
  if (meioDia) {
    return { restante: removerTrecho(texto, meioDia), hora: 12, minuto: 0 };
  }
  const meiaNoite = casarSemAcento(texto, /\bmeia[- ]noite\b/i);
  if (meiaNoite) {
    return { restante: removerTrecho(texto, meiaNoite), hora: 0, minuto: 0 };
  }
  const comAs = casarSemAcento(texto, /\bas?\s+(\d{1,2})(?:[:h](\d{2}))?\s*h?\b/i);
  if (comAs) {
    return {
      restante: removerTrecho(texto, comAs),
      hora: Number(comAs[1]),
      minuto: comAs[2] ? Number(comAs[2]) : 0,
    };
  }
  const doisPontos = casarSemAcento(texto, /\b(\d{1,2})[:h](\d{2})\b/);
  if (doisPontos) {
    return { restante: removerTrecho(texto, doisPontos), hora: Number(doisPontos[1]), minuto: Number(doisPontos[2]) };
  }
  const soHora = casarSemAcento(texto, /\b(\d{1,2})\s*h(?:oras)?\b/i);
  if (soHora) {
    return { restante: removerTrecho(texto, soHora), hora: Number(soHora[1]), minuto: 0 };
  }
  return { restante: texto, hora: null, minuto: 0 };
}

function extrairData(texto: string, agora: Date): { restante: string; dataBase: Date } {
  const hoje = casarSemAcento(texto, /\bhoje\b/i);
  if (hoje) {
    return { restante: removerTrecho(texto, hoje), dataBase: agora };
  }
  const amanha = casarSemAcento(texto, /\bamanha\b/i);
  if (amanha) {
    return { restante: removerTrecho(texto, amanha), dataBase: somarDias(agora, 1) };
  }
  const dataExplicita = casarSemAcento(texto, /\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dataExplicita) {
    const dia = Number(dataExplicita[1]);
    const mes = Number(dataExplicita[2]) - 1;
    const ano = dataExplicita[3]
      ? Number(dataExplicita[3].length === 2 ? `20${dataExplicita[3]}` : dataExplicita[3])
      : agora.getFullYear();
    return { restante: removerTrecho(texto, dataExplicita), dataBase: new Date(ano, mes, dia) };
  }
  for (const [nome, diaAlvo] of Object.entries(DIAS_SEMANA)) {
    const match = casarSemAcento(texto, new RegExp(`\\b${nome}\\b`, "i"));
    if (match) {
      const diaAtual = agora.getDay();
      const diff = ((diaAlvo - diaAtual + 7 - 1) % 7) + 1;
      return { restante: removerTrecho(texto, match), dataBase: somarDias(agora, diff) };
    }
  }
  return { restante: texto, dataBase: agora };
}

function limparTitulo(texto: string): string {
  const limpo = texto
    .replace(/\b(para|que|de|as|com|e)\b\s*$/gi, "")
    .replace(/^\s*\b(para|que|de|as|com|e)\b/gi, "")
    .replace(/[,.]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return limpo || "Compromisso";
}

export function interpretarFalaAgenda(
  textoTranscrito: string,
  agora: Date = new Date(),
): ResultadoParserFalaAgenda {
  const textoNormalizado = normalizar(textoTranscrito);

  const { restante: semAlarme, antecedenciaMin } = extrairAntecedencia(textoNormalizado);
  const intervalo = extrairIntervaloHorario(semAlarme);

  let horaInicio: number;
  let minInicio: number;
  let horaFimBruta: number | null = null;
  let minFimBruta = 0;
  let restanteAposHorario: string;

  if (intervalo.horaInicio !== null) {
    horaInicio = intervalo.horaInicio;
    minInicio = intervalo.minInicio;
    horaFimBruta = intervalo.horaFim;
    minFimBruta = intervalo.minFim;
    restanteAposHorario = intervalo.restante;
  } else {
    const simples = extrairHorarioSimples(intervalo.restante);
    horaInicio = simples.hora ?? 9;
    minInicio = simples.minuto;
    restanteAposHorario = simples.restante;
  }

  const { restante: textoFinal, dataBase } = extrairData(restanteAposHorario, agora);

  const inicioLocal = paraStringLocal(dataBase, horaInicio, minInicio);
  let fimLocal: string | null = null;
  if (horaFimBruta !== null) {
    const fimEmMinutos = horaFimBruta * 60 + minFimBruta;
    const inicioEmMinutos = horaInicio * 60 + minInicio;
    if (fimEmMinutos > inicioEmMinutos) {
      fimLocal = paraStringLocal(dataBase, horaFimBruta, minFimBruta);
    }
  }

  const titulo = limparTitulo(textoFinal);

  return { titulo, inicioLocal, fimLocal, antecedenciaMin };
}
