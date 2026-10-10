import { diaIsoDe, ehChaveData, somarDiasChave } from "@/lib/ecc/planner/regras";

// Datas citadas no texto de um ramo ("Reunião sexta 14h", "entrega 15/11",
// "dia 20 de novembro") — por REGRA, sem IA (decisão do Fabio). Puro e
// testado em `__tests__/mapas-datas.test.ts`. Trabalha só com chaves
// "AAAA-MM-DD" do Brasil (`hoje` vem de `hojeISOBrasil()`), então não
// depende do fuso do servidor.
//
// Não reaproveita `parser-fala-agenda.ts` de propósito: aquele sempre
// devolve uma data (hoje às 9h quando não acha nenhuma) — aqui "não tem
// data" precisa ser `null`.

export type DataNoTexto = {
  /** "AAAA-MM-DD". */
  data: string;
  /** "HH:MM", se o texto também tiver horário. */
  hora: string | null;
};

const MESES: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
};

const DIAS: [RegExp, number][] = [
  [/\bsegunda(?:-feira)?\b/, 1],
  [/\bterca(?:-feira)?\b/, 2],
  [/\bquarta(?:-feira)?\b/, 3],
  [/\bquinta(?:-feira)?\b/, 4],
  [/\bsexta(?:-feira)?\b/, 5],
  [/\bsabado\b/, 6],
  [/\bdomingo\b/, 7],
];

/** Minúsculas, sem acento, mesmo comprimento do original (NFC). */
function semAcento(texto: string): string {
  return texto
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function chave(ano: number, mes: number, dia: number): string | null {
  const c = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return ehChaveData(c) ? c : null;
}

/** Dia/mês sem ano: este ano, ou o próximo se já passou. */
function proximaOcorrencia(mes: number, dia: number, hoje: string): string | null {
  const ano = Number(hoje.slice(0, 4));
  const esteAno = chave(ano, mes, dia);
  if (!esteAno) return chave(ano + 1, mes, dia);
  return esteAno >= hoje ? esteAno : chave(ano + 1, mes, dia);
}

function lerHora(t: string): string | null {
  const casos = [
    /\bas\s+(\d{1,2})(?:[:h](\d{2}))?\s*h?\b/, // "às 9", "às 14h30" (só "às": "a 3 pessoas" não é hora)
    /\b(\d{1,2})[:h](\d{2})\b/, // "14:30", "14h30"
    /\b(\d{1,2})\s*h(?:oras?)?\b/, // "14h", "9 horas"
  ];
  for (const r of casos) {
    const m = t.match(r);
    if (!m) continue;
    const h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    if (h <= 23 && min <= 59) return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  if (/\bmeio[- ]dia\b/.test(t)) return "12:00";
  return null;
}

function lerDia(t: string, hoje: string): string | null {
  if (/\bdepois de amanha\b/.test(t)) return somarDiasChave(hoje, 2);
  if (/\bamanha\b/.test(t)) return somarDiasChave(hoje, 1);
  if (/\bhoje\b/.test(t)) return hoje;

  const barra = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
  if (barra) {
    const dia = Number(barra[1]);
    const mes = Number(barra[2]);
    if (barra[3]) {
      const ano = barra[3].length === 2 ? 2000 + Number(barra[3]) : Number(barra[3]);
      return chave(ano, mes, dia);
    }
    return proximaOcorrencia(mes, dia, hoje);
  }

  const porExtenso = t.match(/\b(?:dia\s+)?(\d{1,2})\s+de\s+([a-z]+)\b/);
  if (porExtenso && MESES[porExtenso[2]]) return proximaOcorrencia(MESES[porExtenso[2]], Number(porExtenso[1]), hoje);

  const soDia = t.match(/\bdia\s+(\d{1,2})\b/);
  if (soDia) {
    const dia = Number(soDia[1]);
    const [ano, mes] = hoje.split("-").map(Number);
    const esteMes = chave(ano, mes, dia);
    if (esteMes && esteMes >= hoje) return esteMes;
    return mes === 12 ? chave(ano + 1, 1, dia) : chave(ano, mes + 1, dia);
  }

  for (const [regex, alvo] of DIAS) {
    if (regex.test(t)) {
      // Próxima ocorrência, de 1 a 7 dias à frente (igual à Agenda por voz).
      const diff = ((alvo - diaIsoDe(hoje) + 7 - 1) % 7) + 1;
      return somarDiasChave(hoje, diff);
    }
  }
  return null;
}

/** A data citada no texto (e o horário, se houver), ou null. */
export function detectarData(texto: string, hoje: string): DataNoTexto | null {
  const t = semAcento(texto);
  const data = lerDia(t, hoje);
  if (!data) return null;
  return { data, hora: lerHora(t) };
}

/** "15/11" (ano só quando não é o atual) + " 14:30". */
export function rotuloData(d: DataNoTexto, hoje: string): string {
  const [ano, mes, dia] = d.data.split("-");
  const base = d.data === hoje ? "Hoje" : d.data === somarDiasChave(hoje, 1) ? "Amanhã" : `${dia}/${mes}${ano !== hoje.slice(0, 4) ? `/${ano}` : ""}`;
  return d.hora ? `${base} ${d.hora}` : base;
}
