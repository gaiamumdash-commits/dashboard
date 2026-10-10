import { MAX_NOS_POR_MAPA, MAX_TEXTO_NO, type MovimentoNo, type NoMapa } from "@/lib/ecc/mapas/tipos";

// Regras puras da árvore do mapa (sem banco, sem React) — testadas em
// `__tests__/mapas-arvore.test.ts`. As Server Actions calculam aqui o novo
// lugar de um ramo e só gravam o resultado.

type NoOrdenavel = Pick<NoMapa, "id" | "pai_id" | "ordem">;

/** Filhos de cada ramo, já em ordem (chave `null` = a ideia central). */
export function filhosPorPai<T extends NoOrdenavel>(nos: T[]): Map<string | null, T[]> {
  const mapa = new Map<string | null, T[]>();
  for (const no of nos) {
    const lista = mapa.get(no.pai_id) ?? [];
    lista.push(no);
    mapa.set(no.pai_id, lista);
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
  return mapa;
}

export function raizDoMapa<T extends NoOrdenavel>(nos: T[]): T | null {
  return nos.find((n) => n.pai_id === null) ?? null;
}

/** Da ideia central até o ramo `id` (inclusive) — o "caminho de volta" do
 * modo foco. Vazio se o ramo não existe. */
export function caminhoAte<T extends NoOrdenavel>(nos: T[], id: string): T[] {
  const porId = new Map(nos.map((n) => [n.id, n]));
  const caminho: T[] = [];
  let atual = porId.get(id);
  while (atual && caminho.length <= nos.length) {
    caminho.unshift(atual);
    atual = atual.pai_id ? porId.get(atual.pai_id) : undefined;
  }
  return caminho;
}

/** Quantos ramos existem dentro de `id` (filhos, netos...). */
export function contarDescendentes<T extends NoOrdenavel>(filhos: Map<string | null, T[]>, id: string): number {
  let total = 0;
  const pilha = [...(filhos.get(id) ?? [])];
  while (pilha.length > 0) {
    const no = pilha.pop()!;
    total += 1;
    pilha.push(...(filhos.get(no.id) ?? []));
  }
  return total;
}

/** Ordem entre dois vizinhos (qualquer um pode faltar). */
export function ordemEntre(antes: number | null | undefined, depois: number | null | undefined): number {
  const temAntes = typeof antes === "number";
  const temDepois = typeof depois === "number";
  if (temAntes && temDepois) return (antes + depois) / 2;
  if (temAntes) return antes + 1;
  if (temDepois) return depois - 1;
  return 1;
}

/** Ordem de um ramo novo dentro de `paiId`: logo depois de `depoisDe` (se
 * for irmão) ou no fim da lista. */
export function ordemParaNovo<T extends NoOrdenavel>(nos: T[], paiId: string, depoisDe?: string | null): number {
  const irmaos = filhosPorPai(nos).get(paiId) ?? [];
  const indice = depoisDe ? irmaos.findIndex((n) => n.id === depoisDe) : -1;
  if (indice >= 0) return ordemEntre(irmaos[indice].ordem, irmaos[indice + 1]?.ordem);
  return ordemEntre(irmaos.at(-1)?.ordem, null);
}

/** Novo lugar do ramo `id` para cada movimento, ou null se não dá (primeiro
 * da lista não sobe nem entra; filho direto da ideia central não sai; a
 * ideia central não se move). */
export function planoMovimento<T extends NoOrdenavel>(
  nos: T[],
  id: string,
  movimento: MovimentoNo,
): { pai_id: string; ordem: number } | null {
  const no = nos.find((n) => n.id === id);
  if (!no || no.pai_id === null) return null;
  const filhos = filhosPorPai(nos);
  const irmaos = filhos.get(no.pai_id) ?? [];
  const i = irmaos.findIndex((n) => n.id === id);

  switch (movimento) {
    case "cima":
      if (i <= 0) return null;
      return { pai_id: no.pai_id, ordem: ordemEntre(irmaos[i - 2]?.ordem, irmaos[i - 1].ordem) };
    case "baixo":
      if (i >= irmaos.length - 1) return null;
      return { pai_id: no.pai_id, ordem: ordemEntre(irmaos[i + 1].ordem, irmaos[i + 2]?.ordem) };
    case "dentro": {
      if (i <= 0) return null;
      const novoPai = irmaos[i - 1];
      return { pai_id: novoPai.id, ordem: ordemEntre((filhos.get(novoPai.id) ?? []).at(-1)?.ordem, null) };
    }
    case "fora": {
      const pai = nos.find((n) => n.id === no.pai_id);
      if (!pai || pai.pai_id === null) return null;
      const tios = filhos.get(pai.pai_id) ?? [];
      const j = tios.findIndex((n) => n.id === pai.id);
      return { pai_id: pai.pai_id, ordem: ordemEntre(pai.ordem, tios[j + 1]?.ordem) };
    }
  }
}

const MARCADOR = /^(?:[-*•+]|\d{1,3}[.)]|#{1,6}|\[[ xX]?\])\s+/;

/** Lista colada (WhatsApp, Notas, Word, Markdown) → ramos com o índice do
 * pai (-1 = direto na ideia central). Recuo por espaços ou tab; marcadores
 * (-, *, •, 1., ##, [ ]) são removidos. Corta no limite de ramos. */
export function lerListaIndentada(texto: string, maximo = MAX_NOS_POR_MAPA - 1): { itens: { texto: string; pai: number }[]; cortados: number } {
  const itens: { texto: string; pai: number }[] = [];
  const pilha: { recuo: number; indice: number }[] = [];
  let cortados = 0;

  for (const linhaBruta of texto.replace(/\r\n?/g, "\n").split("\n")) {
    const semRecuo = linhaBruta.replace(/^[\s ]+/, "");
    const conteudo = semRecuo.replace(MARCADOR, "").trim();
    if (!conteudo) continue;
    if (itens.length >= maximo) {
      cortados += 1;
      continue;
    }
    const recuo = linhaBruta.slice(0, linhaBruta.length - semRecuo.length).replace(/\t/g, "    ").length;
    while (pilha.length > 0 && pilha[pilha.length - 1].recuo >= recuo) pilha.pop();
    itens.push({ texto: conteudo.slice(0, MAX_TEXTO_NO), pai: pilha.at(-1)?.indice ?? -1 });
    pilha.push({ recuo, indice: itens.length - 1 });
  }
  return { itens, cortados };
}
