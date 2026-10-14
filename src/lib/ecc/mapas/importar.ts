import { MAX_NOS_POR_MAPA, MAX_NOTA_NO, MAX_TEXTO_NO } from "@/lib/ecc/mapas/tipos";

// Importar mapa mental de outros apps (XMind, FreeMind/MindMeister .mm,
// Markdown/texto e, via Gemini, foto/PDF). Regras puras — sem DOM, sem
// banco — testadas em `__tests__/mapas-importar.test.ts`. Todo formato vira
// uma árvore e depois uma lista plana (pai antes do filho) que a Server
// Action `importarMapa` grava como um mapa novo, editável como qualquer outro.

export type RamoImportado = { texto: string; nota?: string; filhos: RamoImportado[] };

/** Ramo pronto pra gravar: `pai` é o índice de outro item (-1 = direto na
 * ideia central) e sempre aponta pra trás. */
export type ItemImportado = { texto: string; nota: string | null; pai: number };

export type MapaImportado = { titulo: string; notaCentral: string | null; itens: ItemImportado[]; cortados: number };

/** Texto de um ramo numa linha só (o mapa não guarda quebra de linha). */
function umaLinha(bruto: string): string {
  return bruto.replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO_NO);
}

function notaLimpa(bruta: string | undefined): string | null {
  const nota = (bruta ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_NOTA_NO);
  return nota || null;
}

/** Árvore importada → ideia central + ramos em lista plana. Ramos sem texto
 * somem (os filhos sobem pro avô); corta no limite de ramos do mapa. */
export function arvoreParaMapa(raiz: RamoImportado): MapaImportado {
  const itens: ItemImportado[] = [];
  let cortados = 0;
  const visitar = (ramo: RamoImportado, pai: number) => {
    const texto = umaLinha(ramo.texto);
    let paiDosFilhos = pai;
    if (texto) {
      if (itens.length >= MAX_NOS_POR_MAPA - 1) {
        cortados += 1 + contarRamos(ramo.filhos);
        return;
      }
      itens.push({ texto, nota: notaLimpa(ramo.nota), pai });
      paiDosFilhos = itens.length - 1;
    }
    for (const filho of ramo.filhos) visitar(filho, paiDosFilhos);
  };
  for (const filho of raiz.filhos) visitar(filho, -1);
  return { titulo: umaLinha(raiz.texto) || "Mapa importado", notaCentral: notaLimpa(raiz.nota), itens, cortados };
}

function contarRamos(ramos: RamoImportado[]): number {
  return ramos.reduce((total, r) => total + 1 + contarRamos(r.filhos), 0);
}

/** Vários ramos no topo (planilha com várias abas, Markdown sem título
 * único) viram filhos de uma ideia central com o nome do arquivo. */
function raizUnica(topo: RamoImportado[], nomeArquivo: string): RamoImportado {
  if (topo.length === 1) return topo[0];
  return { texto: nomeSemExtensao(nomeArquivo), filhos: topo };
}

export function nomeSemExtensao(nomeArquivo: string): string {
  return umaLinha(nomeArquivo.replace(/\.[^./\\]+$/, "")) || "Mapa importado";
}

// --------------------------------------------------------------------------
// XML (FreeMind/MindMeister .mm e XMind 8 content.xml) — leitor mínimo por
// tags: os dois formatos só precisam de aninhamento + texto, e no servidor
// de testes (Node) não existe DOMParser.
// --------------------------------------------------------------------------

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteiro, codigo: string) => {
    if (codigo[0] === "#") {
      const numero = codigo[1] === "x" || codigo[1] === "X" ? parseInt(codigo.slice(2), 16) : parseInt(codigo.slice(1), 10);
      return Number.isFinite(numero) && numero > 0 && numero <= 0x10ffff ? String.fromCodePoint(numero) : inteiro;
    }
    return ENTIDADES[codigo.toLowerCase()] ?? inteiro;
  });
}

function atributo(atributos: string, nome: string): string | null {
  const achado = new RegExp(`\\b${nome}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(atributos);
  return achado ? decodificarEntidades(achado[2] ?? achado[3] ?? "") : null;
}

function semTags(html: string): string {
  return decodificarEntidades(html.replace(/<[^>]*>/g, " "));
}

/** FreeMind / Freeplane / MindMeister (.mm): `<node TEXT="...">` aninhados;
 * texto formatado vem em `<richcontent TYPE="NODE">` (HTML). */
export function lerFreeMind(xml: string, nomeArquivo = "Mapa importado"): RamoImportado {
  const topo: RamoImportado[] = [];
  const pilha: RamoImportado[] = [];
  const tag = /<(\/?)(node|richcontent)\b([^>]*?)(\/?)>/gi;
  let achado: RegExpExecArray | null;

  while ((achado = tag.exec(xml))) {
    const [, fecha, nome, atributos, autoFecha] = achado;
    if (nome.toLowerCase() === "richcontent") {
      if (fecha || autoFecha) continue;
      const fim = xml.toLowerCase().indexOf("</richcontent>", tag.lastIndex);
      if (fim === -1) break;
      const tipo = (atributo(atributos, "TYPE") ?? "NODE").toUpperCase();
      const atual = pilha.at(-1);
      const conteudo = semTags(xml.slice(tag.lastIndex, fim));
      if (atual && tipo === "NODE" && !atual.texto) atual.texto = conteudo;
      if (atual && tipo === "NOTE") atual.nota = conteudo;
      tag.lastIndex = fim + "</richcontent>".length;
      continue;
    }
    if (fecha) {
      pilha.pop();
      continue;
    }
    const ramo: RamoImportado = { texto: atributo(atributos, "TEXT") ?? "", filhos: [] };
    (pilha.at(-1)?.filhos ?? topo).push(ramo);
    if (!autoFecha) pilha.push(ramo);
  }

  if (topo.length === 0) throw new Error("Não achei nenhum ramo nesse arquivo .mm.");
  return raizUnica(topo, nomeArquivo);
}

/** XMind 8 (content.xml): `<topic>` aninhados com `<title>`. Cada `<sheet>`
 * (aba) vira um ramo quando há mais de uma. */
export function lerXMindXml(xml: string, nomeArquivo = "Mapa importado"): RamoImportado {
  const topo: RamoImportado[] = [];
  const pilha: RamoImportado[] = [];
  // `<plain>` só aparece dentro de `<notes>`: é a nota do tópico aberto.
  const tag = /<(\/?)(topic|title|plain)\b([^>]*?)(\/?)>/gi;
  let achado: RegExpExecArray | null;

  while ((achado = tag.exec(xml))) {
    const [, fecha, nomeBruto, , autoFecha] = achado;
    const nome = nomeBruto.toLowerCase();
    if (nome === "title" || nome === "plain") {
      if (fecha || autoFecha) continue;
      const fechamento = `</${nome}>`;
      const fim = xml.toLowerCase().indexOf(fechamento, tag.lastIndex);
      if (fim === -1) break;
      const atual = pilha.at(-1);
      const conteudo = semTags(xml.slice(tag.lastIndex, fim));
      if (atual && nome === "title" && !atual.texto) atual.texto = conteudo;
      if (atual && nome === "plain") atual.nota = conteudo;
      tag.lastIndex = fim + fechamento.length;
      continue;
    }
    if (fecha) {
      pilha.pop();
      continue;
    }
    const ramo: RamoImportado = { texto: "", filhos: [] };
    (pilha.at(-1)?.filhos ?? topo).push(ramo);
    if (!autoFecha) pilha.push(ramo);
  }

  if (topo.length === 0) throw new Error("Não achei nenhum tópico nesse arquivo do XMind.");
  return raizUnica(topo, nomeArquivo);
}

type TopicoXMind = {
  title?: unknown;
  notes?: { plain?: { content?: unknown } };
  children?: { attached?: unknown; detached?: unknown };
};

function topicoXMind(bruto: unknown, profundidade: number): RamoImportado {
  const t = (bruto ?? {}) as TopicoXMind;
  const filhos = profundidade > 50 ? [] : [t.children?.attached, t.children?.detached].flatMap((lista) =>
    Array.isArray(lista) ? lista.map((f) => topicoXMind(f, profundidade + 1)) : [],
  );
  const nota = t.notes?.plain?.content;
  return { texto: typeof t.title === "string" ? t.title : "", ...(typeof nota === "string" ? { nota } : {}), filhos };
}

/** XMind 2020+ / XMind Zen (content.json): lista de abas, cada uma com
 * `rootTopic` e filhos em `children.attached` (soltos: `detached`). */
export function lerXMindJson(json: string, nomeArquivo = "Mapa importado"): RamoImportado {
  let dados: unknown;
  try {
    dados = JSON.parse(json);
  } catch {
    throw new Error("O arquivo do XMind está corrompido.");
  }
  const abas = Array.isArray(dados) ? dados : [dados];
  const topo = abas
    .map((aba) => (aba as { rootTopic?: unknown })?.rootTopic)
    .filter((raiz) => raiz && typeof raiz === "object")
    .map((raiz) => topicoXMind(raiz, 0));
  if (topo.length === 0) throw new Error("Não achei nenhum tópico nesse arquivo do XMind.");
  return raizUnica(topo, nomeArquivo);
}

// --------------------------------------------------------------------------
// Markdown / texto
// --------------------------------------------------------------------------

const TITULO_MD = /^(#{1,6})\s+(.*)$/;
const ITEM_MD = /^(?:[-*•+]|\d{1,3}[.)]|\[[ xX]?\])\s+/;

/** Markdown ou texto com recuo. Títulos (#, ##...) e listas (recuo) viram
 * níveis: o item da lista fica DENTRO do título que vem antes dele. Um
 * único título/linha no topo vira a ideia central; vários, ficam debaixo
 * do nome do arquivo. */
export function lerMarkdown(texto: string, nomeArquivo = "Mapa importado"): RamoImportado {
  const linhas = texto.replace(/\r\n?/g, "\n").replace(/^﻿/, "").split("\n");
  const niveisTitulo = linhas.map((l) => TITULO_MD.exec(l.trim())?.[1].length).filter((n): n is number => !!n);
  const menorTitulo = niveisTitulo.length > 0 ? Math.min(...niveisTitulo) : 1;

  const topo: RamoImportado[] = [];
  const pilha: { nivel: number; ramo: RamoImportado }[] = [];
  let nivelDoTitulo = -1; // itens de lista entram um nível abaixo do último título
  let emBlocoDeCodigo = false;

  for (const bruta of linhas) {
    const semRecuo = bruta.replace(/^[\s ]+/, "");
    if (semRecuo.startsWith("```")) {
      emBlocoDeCodigo = !emBlocoDeCodigo;
      continue;
    }
    if (emBlocoDeCodigo || !semRecuo.trim() || /^(-{3,}|\*{3,}|_{3,})$/.test(semRecuo.trim())) continue;

    const titulo = TITULO_MD.exec(semRecuo.trim());
    let nivel: number;
    let conteudo: string;
    if (titulo) {
      nivel = titulo[1].length - menorTitulo;
      nivelDoTitulo = nivel;
      conteudo = titulo[2];
    } else {
      const recuo = bruta.slice(0, bruta.length - semRecuo.length).replace(/\t/g, "    ").length;
      nivel = nivelDoTitulo + 1 + Math.floor(recuo / 2);
      conteudo = semRecuo.replace(ITEM_MD, "");
    }
    // Ênfase e links do Markdown viram texto puro.
    conteudo = conteudo
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/(\*\*|__|\*|_|~~|`)(.+?)\1/g, "$2")
      .replace(/\s#+\s*$/, "");
    if (!conteudo.trim()) continue;

    while (pilha.length > 0 && pilha[pilha.length - 1].nivel >= nivel) pilha.pop();
    const ramo: RamoImportado = { texto: conteudo, filhos: [] };
    (pilha.at(-1)?.ramo.filhos ?? topo).push(ramo);
    pilha.push({ nivel, ramo });
  }

  if (topo.length === 0) throw new Error("O arquivo está vazio.");
  return raizUnica(topo, nomeArquivo);
}

// --------------------------------------------------------------------------
// Tipo do arquivo
// --------------------------------------------------------------------------

export type FormatoImportacao = "xmind" | "freemind" | "markdown" | "imagem" | "pdf";

/** Foto/PDF enviados ao Gemini. A Vercel recusa corpo de requisição acima
 * de ~4,5 MB (antes mesmo do limite de 16 MB do next.config.ts), então o
 * navegador reduz as fotos antes de enviar. */
export const TAMANHO_MAXIMO_LEITURA_IA = 4 * 1024 * 1024;

export const ACEITA_IMPORTACAO = ".xmind,.mm,.md,.markdown,.txt,.pdf,image/png,image/jpeg,image/webp,image/heic,image/heif";

export function formatoDoArquivo(nome: string, mime: string): FormatoImportacao | null {
  const extensao = nome.toLowerCase().split(".").pop() ?? "";
  if (extensao === "xmind") return "xmind";
  if (extensao === "mm") return "freemind";
  if (["md", "markdown", "txt"].includes(extensao) || mime === "text/plain" || mime === "text/markdown") return "markdown";
  if (extensao === "pdf" || mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "heic", "heif"].includes(extensao)) return "imagem";
  return null;
}
