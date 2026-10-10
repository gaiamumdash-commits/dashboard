// Palavras-chave do mapa — por contagem, sem IA (decisão do Fabio). Puro e
// testado em `__tests__/mapas-palavras.test.ts`. Comparação sem acento e
// sem maiúscula ("Reunião" = "reuniao"), mas mostra a grafia mais usada.

export type PalavraChave = { palavra: string; chave: string; total: number };

/** Palavras comuns do português que não dizem nada sobre o mapa. */
const COMUNS = new Set(
  (
    "a o as os um uma uns umas de da do das dos em na no nas nos por pela pelo pelas pelos para pra pro com sem sob sobre entre ate apos " +
    "e ou mas porem que se nao sim ja ainda tambem so mais menos muito muita muitos muitas pouco pouca bem mal la aqui ali onde quando como porque " +
    "eu tu ele ela nos vos eles elas voce voces me te lhe nos meu minha meus minhas seu sua seus suas nosso nossa dele dela isso isto aquilo esse essa " +
    "este esta esses essas estes estas aquele aquela ao aos à às num numa ser estar ter haver fazer ir vai vou foi era sao esta estao tem tinha ha " +
    "cada todo toda todos todas outro outra outros outras qual quais quem algo algum alguma nada tudo mesmo mesma vez vezes dia dias hoje amanha " +
    "segunda terca quarta quinta sexta sabado domingo feira janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro " +
    "etc obs ver fazer feito sobre via vs x"
  ).split(/\s+/),
);

export function chaveDaPalavra(palavra: string): string {
  return palavra
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Palavras de um texto (letras, com hífen interno), sem as #tags. */
function palavrasDe(texto: string): string[] {
  return (texto.replace(/#[\p{L}\p{N}_-]+/gu, " ").match(/[\p{L}]+(?:-[\p{L}]+)*/gu) ?? []).filter((p) => p.length >= 3);
}

function contar(itens: string[], minimo: number, limite: number): PalavraChave[] {
  const porChave = new Map<string, { total: number; grafias: Map<string, number> }>();
  for (const item of itens) {
    const chave = chaveDaPalavra(item);
    const atual = porChave.get(chave) ?? { total: 0, grafias: new Map() };
    atual.total += 1;
    atual.grafias.set(item, (atual.grafias.get(item) ?? 0) + 1);
    porChave.set(chave, atual);
  }
  return [...porChave.entries()]
    .filter(([, v]) => v.total >= minimo)
    .map(([chave, v]) => ({
      chave,
      total: v.total,
      palavra: [...v.grafias.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0][0],
    }))
    .sort((a, b) => b.total - a.total || a.chave.localeCompare(b.chave, "pt-BR"))
    .slice(0, limite);
}

/** As palavras que mais aparecem nos ramos (pelo menos 2 vezes). */
export function palavrasChave(textos: string[], limite = 10): PalavraChave[] {
  const todas = textos.flatMap(palavrasDe).filter((p) => !COMUNS.has(chaveDaPalavra(p)) && !/^\d+$/.test(p));
  return contar(todas, 2, limite);
}

/** As #tags escritas nos ramos (todas, mesmo citadas uma vez). */
export function tagsDoMapa(textos: string[], limite = 20): PalavraChave[] {
  const tags = textos.flatMap((t) => t.match(/#[\p{L}\p{N}_-]+/gu) ?? []);
  return contar(tags, 1, limite);
}

/** O texto cita a palavra (ou a #tag)? Sem acento, palavra inteira. */
export function citaPalavra(texto: string, chave: string): boolean {
  const alvo = chaveDaPalavra(chave);
  if (alvo.startsWith("#")) return (texto.match(/#[\p{L}\p{N}_-]+/gu) ?? []).some((t) => chaveDaPalavra(t) === alvo);
  return palavrasDe(texto).some((p) => chaveDaPalavra(p) === alvo);
}
