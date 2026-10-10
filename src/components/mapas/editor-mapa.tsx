"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as TecladoReact, type PointerEvent as PonteiroReact } from "react";
import Link from "next/link";
import {
  criarNo,
  definirAparencia,
  definirPosicoes,
  definirRecolhido,
  editarNo,
  excluirNo,
  limparPosicoes,
  restaurarRamos,
  salvarPosicao,
  type ResultadoMapa,
} from "@/lib/ecc/mapas/actions";
import { contarDescendentes, filhosPorPai, ordemParaNovo, subarvore } from "@/lib/ecc/mapas/arvore";
import {
  caminhoDaAresta,
  calcularLayout,
  cameraInicial,
  enquadrar,
  estiloDoNivel,
  zoomEm,
  ehSublinhado,
  type Camera,
  type EstiloMapa,
  type Caixa,
} from "@/lib/ecc/mapas/layout";
import {
  desfazer as tirarDoPassado,
  devolverAoFuturo,
  devolverAoPassado,
  historicoVazio,
  refazer as tirarDoFuturo,
  registrar,
  type Historico,
  type Operacao,
  type Aparencia,
  type Posicao,
} from "@/lib/ecc/mapas/historico";
import { CORES_RAMO, MAX_NOTA_NO, MAX_TEXTO_NO, type CorRamo, type FormaRamo, type NoMapa } from "@/lib/ecc/mapas/tipos";
import { Dialog } from "@/components/ui/dialog";
import { ItemMenu, MenuSuspenso } from "@/components/ui/menu-suspenso";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_CAMPO } from "@/components/planner/estilos";

/** Cor de cada ramo principal (o ramo inteiro herda) — tokens do tema, então
 * funcionam no escuro, no claro e no preto. */
const CORES = [
  "var(--gaiamum-tag-purple)",
  "var(--gaiamum-tag-teal)",
  "var(--gaiamum-tag-coral)",
  "var(--gaiamum-tag-blue)",
  "var(--gaiamum-tag-yellow)",
  "var(--gaiamum-tag-lime)",
  "var(--gaiamum-success)",
  "var(--gaiamum-warning)",
];
const corDoRamo = (indice: number) => (indice < 0 ? "var(--gaiamum-primary)" : CORES[indice % CORES.length]);
/** Mesma ordem de CORES_RAMO (tipos.ts): "roxo" = 1ª cor, e assim por diante. */
const corEscolhida = (cor: CorRamo) => CORES[CORES_RAMO.indexOf(cor)];
const NOME_COR: Record<CorRamo, string> = {
  roxo: "Roxo",
  "verde-agua": "Verde-água",
  coral: "Coral",
  azul: "Azul",
  amarelo: "Amarelo",
  lima: "Lima",
  verde: "Verde",
  laranja: "Laranja",
};

/** Distância (px de tela) que separa "toque" de "arrasto". */
const LIMIAR_ARRASTO = { mouse: 4, toque: 8 };
const TEXTO_RASCUNHO = "Nova ideia";

type Rascunho = { id: string; paiId: string; depoisDe: string | null };

type Gesto =
  | { tipo: "nenhum" }
  | { tipo: "pan"; inicioX: number; inicioY: number; camera: Camera; movido: boolean }
  | { tipo: "ramo"; id: string; inicioX: number; inicioY: number; rx: number; ry: number; movido: boolean; limiar: number }
  | { tipo: "pinca"; distancia: number; meioX: number; meioY: number; camera: Camera };

function chaveEstilo(mapaId: string) {
  return `gaiamum:mapa:estilo:${mapaId}`;
}

const semAssinatura = () => () => {};

function lerEstilo(mapaId: string): EstiloMapa {
  try {
    return localStorage.getItem(chaveEstilo(mapaId)) === "linhas" ? "linhas" : "caixas";
  } catch {
    return "caixas"; // armazenamento bloqueado: fica no padrão
  }
}

function chaveCamera(mapaId: string) {
  return `gaiamum:mapa:camera:${mapaId}`;
}

/**
 * Visão de MAPA do mesmo mapa da visão de lista (mesma árvore, mesmas
 * Server Actions). Desenho: HTML (ramos) + SVG (curvas) dentro de uma camada
 * com `transform` (zoom/arrasto da tela) — sem biblioteca gráfica.
 *
 * Posição ≠ hierarquia: arrastar um ramo só grava `pos_x/pos_y` (relativa
 * ao pai, ao soltar); pai e ordem mudam só pelas ações explícitas.
 */
export function EditorMapa({
  mapaId,
  nos: nosServidor,
  somenteLeitura,
  posicoesDisponiveis,
  selecionadoInicial = null,
}: {
  mapaId: string;
  nos: NoMapa[];
  somenteLeitura: boolean;
  posicoesDisponiveis: boolean;
  /** Ramo já selecionado ao abrir (ex.: vindo da lista). */
  selecionadoInicial?: string | null;
}) {
  const { pendente, executar } = useAcaoPlanner();
  const [erroAoSalvar, setErroAoSalvar] = useState(false);

  // Correções otimistas por cima do servidor (descartadas quando ele responde).
  const [novos, setNovos] = useState<NoMapa[]>([]);
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [recolhidos, setRecolhidos] = useState<Record<string, boolean>>({});
  const [posicoes, setPosicoes] = useState<Record<string, Posicao>>({});
  const [aparencias, setAparencias] = useState<Record<string, Aparencia>>({});
  const [ultimoServidor, setUltimoServidor] = useState(nosServidor);
  if (nosServidor !== ultimoServidor) {
    const ids = new Set(nosServidor.map((n) => n.id));
    setUltimoServidor(nosServidor);
    setNovos((lista) => lista.filter((n) => !ids.has(n.id)));
    setRemovidos(new Set());
    setTextos({});
    setPosicoes({});
    setAparencias({});
    if (!somenteLeitura) setRecolhidos({});
  }

  const [selecionado, setSelecionado] = useState<string | null>(selecionadoInicial);
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [notaDe, setNotaDe] = useState<NoMapa | null>(null);
  const [historico, setHistorico] = useState<Historico>(historicoVazio);
  /** Posição relativa do ramo sendo arrastado (só tela, até soltar). */
  const [arrasto, setArrasto] = useState<{ id: string; rx: number; ry: number } | null>(null);

  const areaRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  /** Caixas (todo ramo com borda) ou linhas (orgânico). Preferência de
   * quem está vendo, por mapa, neste navegador — não é dado do mapa. */
  const estiloSalvo = useSyncExternalStore(semAssinatura, () => lerEstilo(mapaId), () => "caixas" as EstiloMapa);
  const [estiloEscolhido, setEstiloEscolhido] = useState<EstiloMapa | null>(null);
  const estilo = estiloEscolhido ?? estiloSalvo;
  function trocarEstilo(novo: EstiloMapa) {
    setEstiloEscolhido(novo);
    try {
      localStorage.setItem(chaveEstilo(mapaId), novo);
    } catch {
      // Só não lembra a escolha.
    }
  }
  const gesto = useRef<Gesto>({ tipo: "nenhum" });
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const ultimoToque = useRef<{ id: string; quando: number } | null>(null);

  // ------------------------------------------------------------------------
  // Árvore em uso = servidor + otimistas (+ o rascunho sendo digitado).
  // ------------------------------------------------------------------------

  const nos = useMemo(() => {
    const ids = new Set(nosServidor.map((n) => n.id));
    const base = [...nosServidor, ...novos.filter((n) => !ids.has(n.id))].filter((n) => !removidos.has(n.id));
    const lista = base.map((n) => {
      const p = n.id in posicoes ? posicoes[n.id] : undefined;
      return {
        ...n,
        texto: textos[n.id] ?? n.texto,
        recolhido: recolhidos[n.id] ?? n.recolhido,
        pos_x: p === undefined ? (n.pos_x ?? null) : (p?.x ?? null),
        pos_y: p === undefined ? (n.pos_y ?? null) : (p?.y ?? null),
        cor: aparencias[n.id] ? aparencias[n.id].cor : (n.cor ?? null),
        forma: aparencias[n.id] ? aparencias[n.id].forma : (n.forma ?? null),
      };
    });
    // Ramo removido some com tudo o que estava dentro.
    const vivos = new Set(lista.map((n) => n.id));
    let mudou = true;
    let atual = lista;
    while (mudou) {
      mudou = false;
      const proximos = atual.filter((n) => n.pai_id === null || vivos.has(n.pai_id));
      if (proximos.length !== atual.length) {
        mudou = true;
        for (const n of atual) if (!proximos.includes(n)) vivos.delete(n.id);
        atual = proximos;
      }
    }
    return atual;
  }, [nosServidor, novos, removidos, textos, recolhidos, posicoes, aparencias]);

  const filhos = useMemo(() => filhosPorPai(nos), [nos]);
  const porId = useMemo(() => new Map(nos.map((n) => [n.id, n])), [nos]);

  const paraLayout = useMemo(() => {
    let lista = nos.map((n) => (arrasto?.id === n.id ? { ...n, pos_x: arrasto.rx, pos_y: arrasto.ry } : n));
    if (rascunho) {
      lista = lista.map((n) => (n.id === rascunho.paiId ? { ...n, recolhido: false } : n));
      lista.push({
        id: rascunho.id,
        mapa_id: mapaId,
        pai_id: rascunho.paiId,
        ordem: ordemParaNovo(nos, rascunho.paiId, rascunho.depoisDe),
        texto: TEXTO_RASCUNHO,
        nota: null,
        recolhido: false,
        pos_x: null,
        pos_y: null,
        cor: null,
        forma: null,
      });
    }
    return lista;
  }, [nos, arrasto, rascunho, mapaId]);

  const layout = useMemo(() => calcularLayout(paraLayout), [paraLayout]);
  const raiz = nos.find((n) => n.pai_id === null) ?? null;

  /** Cor e borda de cada ramo desenhado: a escolhida no ramo, senão a
   * herdada do pai (cor) / a do estilo do mapa (borda). Caixas vêm na
   * ordem pai → filhos, então o pai já está resolvido. */
  const visual = useMemo(() => {
    const r = new Map<string, { cor: string; sublinhado: boolean }>();
    for (const c of layout.caixas.values()) {
      const no = porId.get(c.id);
      const pai = no?.pai_id ? r.get(no.pai_id) : undefined;
      const cor = no?.cor ? corEscolhida(no.cor) : c.nivel <= 1 || !pai ? corDoRamo(c.cor) : pai.cor;
      const sublinhado = no?.forma === "linha" ? true : no?.forma === "caixa" ? false : ehSublinhado(c.nivel, estilo);
      r.set(c.id, { cor, sublinhado });
    }
    return r;
  }, [layout, porId, estilo]);

  // ------------------------------------------------------------------------
  // Câmera: começa enquadrando o mapa (ou como a pessoa deixou nesta aba).
  // ------------------------------------------------------------------------

  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    let salva: Camera | null = null;
    try {
      const bruto = sessionStorage.getItem(chaveCamera(mapaId));
      if (bruto) salva = JSON.parse(bruto) as Camera;
    } catch {
      salva = null;
    }
    const valida = salva && [salva.x, salva.y, salva.escala].every((v) => typeof v === "number" && Number.isFinite(v));
    setCamera(valida ? salva : cameraInicial(layoutRef.current.limites, area.clientWidth, area.clientHeight));
  }, [mapaId]);

  useEffect(() => {
    if (!camera) return;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(chaveCamera(mapaId), JSON.stringify(camera));
      } catch {
        // Aba privada / armazenamento bloqueado: só não lembra o zoom.
      }
    }, 300);
    return () => clearTimeout(t);
  }, [camera, mapaId]);

  // Roda do mouse / trackpad: pinça do trackpad (ctrl) = zoom; rolar = mover.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    function aoRolar(e: WheelEvent) {
      e.preventDefault();
      const r = area!.getBoundingClientRect();
      setCamera((c) => {
        if (!c) return c;
        if (e.ctrlKey || e.metaKey) return zoomEm(c, Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
        return { ...c, x: c.x - e.deltaX, y: c.y - e.deltaY };
      });
    }
    area.addEventListener("wheel", aoRolar, { passive: false });
    return () => area.removeEventListener("wheel", aoRolar);
  }, []);

  function enquadrarTudo() {
    const area = areaRef.current;
    if (area) setCamera(enquadrar(layout.limites, area.clientWidth, area.clientHeight));
  }

  function zoomBotao(fator: number) {
    const area = areaRef.current;
    if (area) setCamera((c) => (c ? zoomEm(c, fator, area.clientWidth / 2, area.clientHeight / 2) : c));
  }

  /** Garante que o ramo aparece na tela (sem mexer se já aparece). */
  function mostrarRamo(id: string) {
    const area = areaRef.current;
    const c = layoutRef.current.caixas.get(id);
    if (!area || !c) return;
    setCamera((cam) => {
      if (!cam) return cam;
      const sx = cam.x + c.x * cam.escala;
      const sy = cam.y + c.y * cam.escala;
      const m = 60;
      const dx = sx < m ? m - sx : sx > area.clientWidth - m ? area.clientWidth - m - sx : 0;
      const dy = sy < m ? m - sy : sy > area.clientHeight - m ? area.clientHeight - m - sy : 0;
      return dx || dy ? { ...cam, x: cam.x + dx, y: cam.y + dy } : cam;
    });
  }

  // ------------------------------------------------------------------------
  // Gravação (todas as escritas passam pelas Server Actions + RLS).
  // ------------------------------------------------------------------------

  function gravar(acao: () => Promise<ResultadoMapa>, opcoes: { desfazer?: () => void; sucesso?: string; aoFalhar?: () => void } = {}) {
    executar(
      async () => {
        const r = await acao();
        setErroAoSalvar(!r.ok);
        if (!r.ok) opcoes.aoFalhar?.();
        return r;
      },
      { desfazer: opcoes.desfazer, sucesso: opcoes.sucesso },
    );
  }

  function anotar(op: Operacao) {
    setHistorico((h) => registrar(h, op));
  }

  function aplicarTexto(id: string, texto: string) {
    setTextos((t) => ({ ...t, [id]: texto }));
    return editarNo(id, texto);
  }

  function salvarTexto(no: NoMapa, bruto: string) {
    const texto = bruto.trim().slice(0, MAX_TEXTO_NO);
    if (!texto || texto === no.texto) return;
    const antes = no.texto;
    anotar({ tipo: "texto", id: no.id, antes, depois: texto });
    gravar(() => aplicarTexto(no.id, texto), { desfazer: () => setTextos((t) => ({ ...t, [no.id]: antes })) });
  }

  function confirmarRascunho(texto: string) {
    const r = rascunho;
    setRascunho(null);
    setEditando(null);
    const limpo = texto.trim().slice(0, MAX_TEXTO_NO);
    if (!r || !limpo) {
      if (r) setSelecionado(r.paiId);
      return;
    }
    const novo: NoMapa = {
      id: r.id,
      mapa_id: mapaId,
      pai_id: r.paiId,
      ordem: ordemParaNovo(nos, r.paiId, r.depoisDe),
      texto: limpo,
      nota: null,
      recolhido: false,
      pos_x: null,
      pos_y: null,
    };
    setNovos((l) => [...l, novo]);
    setRecolhidos((rec) => ({ ...rec, [r.paiId]: false }));
    setSelecionado(r.id);
    anotar({ tipo: "criar", no: novo });
    gravar(() => criarNo(mapaId, r.paiId, limpo, r.depoisDe, r.id), {
      desfazer: () => setNovos((l) => l.filter((n) => n.id !== r.id)),
    });
  }

  function novoFilho(paiId: string) {
    if (somenteLeitura) return;
    const id = crypto.randomUUID();
    setRascunho({ id, paiId, depoisDe: (filhos.get(paiId) ?? []).at(-1)?.id ?? null });
    setEditando(id);
    setSelecionado(id);
    requestAnimationFrame(() => mostrarRamo(id));
  }

  function novoIrmao(id: string) {
    const no = porId.get(id);
    if (somenteLeitura || !no) return;
    if (!no.pai_id) return novoFilho(no.id);
    const novoId = crypto.randomUUID();
    setRascunho({ id: novoId, paiId: no.pai_id, depoisDe: no.id });
    setEditando(novoId);
    setSelecionado(novoId);
    requestAnimationFrame(() => mostrarRamo(novoId));
  }

  function excluir(id: string) {
    const no = porId.get(id);
    if (somenteLeitura || !no || !no.pai_id) return;
    const dentro = contarDescendentes(filhos, id);
    if (dentro > 0 && !window.confirm(`Excluir "${no.texto}" e os ${dentro} ramos dentro dele?`)) return;
    const copia = subarvore(nos, id);
    setRemovidos((s) => new Set([...s, id]));
    setSelecionado(no.pai_id);
    anotar({ tipo: "excluir", nos: copia });
    gravar(() => excluirNo(id), {
      desfazer: () =>
        setRemovidos((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        }),
    });
  }

  function alternarRecolhido(id: string) {
    const no = porId.get(id);
    if (!no || !no.pai_id || (filhos.get(id) ?? []).length === 0) return;
    const valor = !no.recolhido;
    setRecolhidos((r) => ({ ...r, [id]: valor }));
    if (somenteLeitura) return;
    anotar({ tipo: "recolher", id, antes: !valor, depois: valor });
    gravar(() => definirRecolhido(id, valor), { desfazer: () => setRecolhidos((r) => ({ ...r, [id]: !valor })) });
  }

  function gravarPosicao(id: string, antes: Posicao, depois: Posicao, registrarNoHistorico = true) {
    setPosicoes((p) => ({ ...p, [id]: depois }));
    if (registrarNoHistorico) anotar({ tipo: "posicao", id, antes, depois });
    gravar(() => salvarPosicao(id, depois), { desfazer: () => setPosicoes((p) => ({ ...p, [id]: antes })) });
  }

  function mudarAparencia(id: string, mudanca: Partial<Aparencia>) {
    const no = porId.get(id);
    if (somenteLeitura || !no) return;
    const antes: Aparencia = { cor: no.cor ?? null, forma: no.forma ?? null };
    const depois: Aparencia = { ...antes, ...mudanca };
    if (antes.cor === depois.cor && antes.forma === depois.forma) return;
    setAparencias((a) => ({ ...a, [id]: depois }));
    anotar({ tipo: "aparencia", id, antes, depois });
    gravar(() => definirAparencia(id, depois), { desfazer: () => setAparencias((a) => ({ ...a, [id]: antes })) });
  }

  function reorganizar() {
    const manuais = nos.filter((n) => typeof n.pos_x === "number" && typeof n.pos_y === "number").map((n) => ({ id: n.id, x: n.pos_x!, y: n.pos_y! }));
    if (manuais.length === 0) {
      enquadrarTudo();
      return;
    }
    setPosicoes((p) => ({ ...p, ...Object.fromEntries(manuais.map((m) => [m.id, null])) }));
    anotar({ tipo: "reorganizar", antes: manuais });
    gravar(() => limparPosicoes(mapaId), { sucesso: "Mapa reorganizado." });
    requestAnimationFrame(enquadrarTudo);
  }

  // ------------------------------------------------------------------------
  // Desfazer / refazer: reaplica com as mesmas actions; se o servidor
  // recusar, a operação volta pro histórico (nada some em silêncio).
  // ------------------------------------------------------------------------

  function aplicar(op: Operacao, sentido: "desfazer" | "refazer", aoFalhar: () => void) {
    const ida = sentido === "refazer";
    switch (op.tipo) {
      case "texto": {
        const valor = ida ? op.depois : op.antes;
        return gravar(() => aplicarTexto(op.id, valor), { aoFalhar });
      }
      case "recolher": {
        const valor = ida ? op.depois : op.antes;
        setRecolhidos((r) => ({ ...r, [op.id]: valor }));
        return gravar(() => definirRecolhido(op.id, valor), { aoFalhar });
      }
      case "posicao": {
        const valor = ida ? op.depois : op.antes;
        setPosicoes((p) => ({ ...p, [op.id]: valor }));
        return gravar(() => salvarPosicao(op.id, valor), { aoFalhar });
      }
      case "criar":
      case "excluir": {
        const lote = op.tipo === "criar" ? [op.no] : op.nos;
        const recriar = (op.tipo === "criar") === ida;
        if (recriar) {
          setNovos((l) => [...l.filter((n) => !lote.some((x) => x.id === n.id)), ...lote]);
          setRemovidos((s) => new Set([...s].filter((id) => !lote.some((x) => x.id === id))));
          return gravar(() => restaurarRamos(mapaId, lote), { aoFalhar });
        }
        setRemovidos((s) => new Set([...s, lote[0].id]));
        if (selecionado && lote.some((n) => n.id === selecionado)) setSelecionado(null);
        return gravar(() => excluirNo(lote[0].id), { aoFalhar });
      }
      case "aparencia": {
        const valor = ida ? op.depois : op.antes;
        setAparencias((a) => ({ ...a, [op.id]: valor }));
        return gravar(() => definirAparencia(op.id, valor), { aoFalhar });
      }
      case "reorganizar": {
        if (ida) {
          setPosicoes((p) => ({ ...p, ...Object.fromEntries(op.antes.map((m) => [m.id, null])) }));
          return gravar(() => limparPosicoes(mapaId), { aoFalhar });
        }
        setPosicoes((p) => ({ ...p, ...Object.fromEntries(op.antes.map((m) => [m.id, { x: m.x, y: m.y }])) }));
        return gravar(() => definirPosicoes(mapaId, op.antes), { aoFalhar });
      }
    }
  }

  function desfazer() {
    const r = tirarDoPassado(historico);
    if (!r) return;
    setHistorico(r.historico);
    aplicar(r.op, "desfazer", () => setHistorico((h) => devolverAoPassado(h, r.op)));
  }

  function refazer() {
    const r = tirarDoFuturo(historico);
    if (!r) return;
    setHistorico(r.historico);
    aplicar(r.op, "refazer", () => setHistorico((h) => devolverAoFuturo(h, r.op)));
  }

  // ------------------------------------------------------------------------
  // Gestos: um dedo/mouse no fundo move a tela; num ramo, toque seleciona e
  // arrasto move o ramo; dois dedos = pinça (zoom). Nada disso edita.
  // ------------------------------------------------------------------------

  function pontoNaArea(e: { clientX: number; clientY: number }) {
    const r = areaRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function iniciarPinca() {
    const [a, b] = [...ponteiros.current.values()];
    if (!a || !b || !camera) return;
    if (gesto.current.tipo === "ramo" && gesto.current.movido) setArrasto(null);
    gesto.current = { tipo: "pinca", distancia: Math.hypot(a.x - b.x, a.y - b.y) || 1, meioX: (a.x + b.x) / 2, meioY: (a.y + b.y) / 2, camera };
  }

  function aoApertar(e: PonteiroReact<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    if (alvo.closest("[data-sem-gesto]") || !camera) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    areaRef.current?.setPointerCapture(e.pointerId);
    ponteiros.current.set(e.pointerId, pontoNaArea(e));
    if (ponteiros.current.size === 2) return iniciarPinca();
    if (ponteiros.current.size > 2) return;

    const elRamo = alvo.closest<HTMLElement>("[data-ramo]");
    const id = elRamo?.dataset.ramo;
    const caixa = id ? layout.caixas.get(id) : undefined;
    const p = pontoNaArea(e);
    if (id && caixa && editando !== id) {
      gesto.current = {
        tipo: "ramo",
        id,
        inicioX: p.x,
        inicioY: p.y,
        rx: caixa.rx,
        ry: caixa.ry,
        movido: false,
        limiar: e.pointerType === "mouse" ? LIMIAR_ARRASTO.mouse : LIMIAR_ARRASTO.toque,
      };
    } else if (!id) {
      gesto.current = { tipo: "pan", inicioX: p.x, inicioY: p.y, camera, movido: false };
    }
  }

  function aoMover(e: PonteiroReact<HTMLDivElement>) {
    if (!ponteiros.current.has(e.pointerId)) return;
    const p = pontoNaArea(e);
    ponteiros.current.set(e.pointerId, p);
    const g = gesto.current;

    if (g.tipo === "pinca") {
      const [a, b] = [...ponteiros.current.values()];
      if (!a || !b) return;
      const meioX = (a.x + b.x) / 2;
      const meioY = (a.y + b.y) / 2;
      const z = zoomEm(g.camera, Math.hypot(a.x - b.x, a.y - b.y) / g.distancia, g.meioX, g.meioY);
      setCamera({ ...z, x: z.x + meioX - g.meioX, y: z.y + meioY - g.meioY });
      return;
    }
    if (g.tipo === "pan") {
      if (!g.movido && Math.hypot(p.x - g.inicioX, p.y - g.inicioY) < 3) return;
      g.movido = true;
      setCamera({ ...g.camera, x: g.camera.x + p.x - g.inicioX, y: g.camera.y + p.y - g.inicioY });
      return;
    }
    if (g.tipo === "ramo") {
      const dx = p.x - g.inicioX;
      const dy = p.y - g.inicioY;
      if (!g.movido && Math.hypot(dx, dy) < g.limiar) return;
      const ehRaiz = g.id === raiz?.id;
      // Ideia central, leitura, ou banco sem posições: arrastar move a tela.
      if (ehRaiz || somenteLeitura || !posicoesDisponiveis) {
        gesto.current = { tipo: "pan", inicioX: g.inicioX, inicioY: g.inicioY, camera: camera!, movido: true };
        return aoMover(e);
      }
      g.movido = true;
      setArrasto({ id: g.id, rx: g.rx + dx / camera!.escala, ry: g.ry + dy / camera!.escala });
    }
  }

  function aoSoltar(e: PonteiroReact<HTMLDivElement>) {
    if (!ponteiros.current.has(e.pointerId)) return;
    ponteiros.current.delete(e.pointerId);
    const g = gesto.current;
    if (g.tipo === "pinca") {
      // Sobrou um dedo: segue movendo a tela a partir dele.
      const resto = [...ponteiros.current.values()][0];
      gesto.current = resto && camera ? { tipo: "pan", inicioX: resto.x, inicioY: resto.y, camera, movido: true } : { tipo: "nenhum" };
      return;
    }
    gesto.current = { tipo: "nenhum" };

    if (g.tipo === "pan" && !g.movido) {
      setSelecionado(null);
      areaRef.current?.focus({ preventScroll: true });
    }
    if (g.tipo !== "ramo") return;

    if (g.movido && arrasto) {
      const no = porId.get(g.id);
      const antes: Posicao = no && typeof no.pos_x === "number" ? { x: no.pos_x, y: no.pos_y! } : null;
      setArrasto(null);
      gravarPosicao(g.id, antes, { x: Math.round(arrasto.rx), y: Math.round(arrasto.ry) });
      return;
    }
    if (g.movido) return;

    // Toque/clique: seleciona; 2º toque rápido no mesmo ramo = editar.
    const agora = Date.now();
    const duplo = ultimoToque.current?.id === g.id && agora - ultimoToque.current.quando < 350;
    ultimoToque.current = { id: g.id, quando: agora };
    setSelecionado(g.id);
    if (duplo && !somenteLeitura) setEditando(g.id);
    areaRef.current?.focus({ preventScroll: true });
  }

  function aoCancelar(e: PonteiroReact<HTMLDivElement>) {
    ponteiros.current.delete(e.pointerId);
    gesto.current = { tipo: "nenhum" };
    setArrasto(null);
  }

  // ------------------------------------------------------------------------
  // Teclado (só com o mapa em foco e fora de campo de texto).
  // ------------------------------------------------------------------------

  function navegar(id: string, tecla: string): string | null {
    const c = layout.caixas.get(id);
    const no = porId.get(id);
    if (!c || !no) return null;
    const visiveisDe = (pai: string) => (filhos.get(pai) ?? []).filter((f) => layout.caixas.has(f.id));
    if (tecla === "ArrowUp" || tecla === "ArrowDown") {
      if (!no.pai_id) return null;
      const irmaos = visiveisDe(no.pai_id)
        .filter((f) => layout.caixas.get(f.id)!.lado === c.lado)
        .sort((a, b) => layout.caixas.get(a.id)!.y - layout.caixas.get(b.id)!.y);
      const i = irmaos.findIndex((f) => f.id === id);
      return irmaos[i + (tecla === "ArrowUp" ? -1 : 1)]?.id ?? null;
    }
    const lado = tecla === "ArrowRight" ? 1 : -1;
    if (c.lado === 0) return visiveisDe(id).find((f) => layout.caixas.get(f.id)!.lado === lado)?.id ?? null;
    return c.lado === lado ? (visiveisDe(id)[0]?.id ?? null) : no.pai_id;
  }

  function aoTeclar(e: TecladoReact<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    if (alvo.closest("input, textarea, [contenteditable]") || editando) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      return e.shiftKey ? refazer() : desfazer();
    }
    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      return refazer();
    }
    if (e.key === "Escape") return setSelecionado(null);
    if (!selecionado) {
      if (e.key.startsWith("Arrow") && raiz) {
        e.preventDefault();
        setSelecionado(raiz.id);
      }
      return;
    }
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const proximo = navegar(selecionado, e.key);
      if (proximo) {
        setSelecionado(proximo);
        mostrarRamo(proximo);
      }
      return;
    }
    if (somenteLeitura) {
      if (e.key === " ") {
        e.preventDefault();
        alternarRecolhido(selecionado);
      }
      return;
    }
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      novoIrmao(selecionado);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      setEditando(selecionado);
    } else if (e.key === "Tab") {
      e.preventDefault();
      novoFilho(selecionado);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      excluir(selecionado);
    } else if (e.key === " ") {
      e.preventDefault();
      alternarRecolhido(selecionado);
    }
  }

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------

  const sel = selecionado ? porId.get(selecionado) : undefined;
  const selCaixa = selecionado ? layout.caixas.get(selecionado) : undefined;
  const status = erroAoSalvar ? "Não salvo — tente de novo" : pendente ? "Salvando…" : "Salvo";
  const botao =
    "flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm text-gaiamum-text transition hover:bg-gaiamum-surface-raised disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gaiamum-primary";

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={areaRef}
        tabIndex={0}
        role="application"
        aria-label="Mapa mental. Setas navegam entre ramos; Enter edita; Tab cria ramo dentro; Shift+Enter cria ramo abaixo; Delete exclui; Espaço recolhe."
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoCancelar}
        onKeyDown={aoTeclar}
        onDoubleClick={(e) => {
          const id = (e.target as HTMLElement).closest<HTMLElement>("[data-ramo]")?.dataset.ramo;
          if (id && !somenteLeitura) setEditando(id);
        }}
        className="relative h-[calc(100dvh-15rem)] min-h-[26rem] touch-none select-none overflow-hidden rounded-2xl border border-gaiamum-border bg-gaiamum-bg outline-none focus-visible:ring-2 focus-visible:ring-gaiamum-primary/50"
        style={{
          backgroundImage: "radial-gradient(var(--gaiamum-border) 1px, transparent 1px)",
          backgroundSize: camera ? `${24 * camera.escala}px ${24 * camera.escala}px` : "24px 24px",
          backgroundPosition: camera ? `${camera.x}px ${camera.y}px` : undefined,
        }}
      >
        {camera && (
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.escala})` }}>
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
              {layout.arestas.map((a) => {
                const pai = layout.caixas.get(a.de)!;
                const filho = layout.caixas.get(a.para)!;
                return (
                  <path
                    key={a.para}
                    d={caminhoDaAresta({ ...pai, sublinhado: visual.get(a.de)?.sublinhado }, { ...filho, sublinhado: visual.get(a.para)?.sublinhado }, estilo)}
                    fill="none"
                    stroke={visual.get(a.para)?.cor ?? corDoRamo(a.cor)}
                    strokeWidth={filho.nivel === 1 ? 3.5 : 2.5}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            {[...layout.caixas.values()].map((c) => (
              <Ramo
                key={c.id}
                caixa={c}
                cor={visual.get(c.id)?.cor ?? corDoRamo(c.cor)}
                sublinhado={visual.get(c.id)?.sublinhado ?? false}
                no={porId.get(c.id)}
                rascunho={rascunho?.id === c.id}
                selecionado={selecionado === c.id}
                editando={editando === c.id}
                ocultos={porId.get(c.id)?.recolhido ? contarDescendentes(filhos, c.id) : 0}
                somenteLeitura={somenteLeitura}
                aoExpandir={() => alternarRecolhido(c.id)}
                aoNovoFilho={() => novoFilho(c.id)}
                aoNovoIrmao={() => novoIrmao(c.id)}
                aoConfirmar={(texto) => {
                  if (rascunho?.id === c.id) return confirmarRascunho(texto);
                  const no = porId.get(c.id);
                  if (no) salvarTexto(no, texto);
                  setEditando(null);
                  areaRef.current?.focus({ preventScroll: true });
                }}
                aoCancelar={() => {
                  if (rascunho?.id === c.id) {
                    setSelecionado(rascunho.paiId);
                    setRascunho(null);
                  }
                  setEditando(null);
                  areaRef.current?.focus({ preventScroll: true });
                }}
              />
            ))}
          </div>
        )}

        {/* Topo: desfazer/refazer, status e zoom. */}
        <div data-sem-gesto className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-center justify-end gap-1 [&>*]:pointer-events-auto">
          {!somenteLeitura && (
            <div className="flex items-center rounded-full border border-gaiamum-border bg-gaiamum-surface/95 px-1 shadow-sm">
              <button type="button" onClick={desfazer} disabled={historico.passado.length === 0} className={botao} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
                ↶
              </button>
              <button type="button" onClick={refazer} disabled={historico.futuro.length === 0} className={botao} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer">
                ↷
              </button>
              <span role="status" className={`px-2 text-xs ${erroAoSalvar ? "text-gaiamum-danger" : "text-gaiamum-text-muted"}`}>
                {status}
              </span>
            </div>
          )}
          <div className="flex items-center rounded-full border border-gaiamum-border bg-gaiamum-surface/95 px-1 shadow-sm">
            <button type="button" onClick={() => zoomBotao(1 / 1.25)} className={botao} title="Afastar" aria-label="Afastar">
              −
            </button>
            <span className="w-11 text-center text-xs tabular-nums text-gaiamum-text-muted">{camera ? Math.round(camera.escala * 100) : 100}%</span>
            <button type="button" onClick={() => zoomBotao(1.25)} className={botao} title="Aproximar" aria-label="Aproximar">
              +
            </button>
            <button type="button" onClick={enquadrarTudo} className={botao} title="Ver o mapa inteiro" aria-label="Ver o mapa inteiro">
              ⤢
            </button>
            {!somenteLeitura && posicoesDisponiveis && (
              <button type="button" onClick={reorganizar} className={botao} title="Reorganizar automaticamente" aria-label="Reorganizar automaticamente">
                ✨
              </button>
            )}
          </div>
          <div role="group" aria-label="Estilo dos ramos" className="flex items-center rounded-full border border-gaiamum-border bg-gaiamum-surface/95 p-0.5 shadow-sm">
            {(
              [
                ["caixas", "▭ Caixas", "Todos os ramos com borda"],
                ["linhas", "〰 Linhas", "Ramos de dentro como texto sobre linha"],
              ] as const
            ).map(([valor, rotulo, dica]) => (
              <button
                key={valor}
                type="button"
                onClick={() => trocarEstilo(valor)}
                aria-pressed={estilo === valor}
                title={dica}
                className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gaiamum-primary ${
                  estilo === valor ? "bg-gaiamum-primary text-white" : "text-gaiamum-text-muted hover:text-gaiamum-text"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {/* Base: ações do ramo selecionado (alcance do polegar no celular). */}
        <div data-sem-gesto className="absolute inset-x-0 bottom-3 flex justify-center px-2">
          {sel && selCaixa && !editando ? (
            <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-gaiamum-border bg-gaiamum-surface/95 px-1.5 py-1 shadow-lg">
              {!somenteLeitura && (
                <>
                  <button type="button" onClick={() => novoFilho(sel.id)} className={botao} title="Ramo dentro (Tab)">
                    <span aria-hidden>＋</span>
                    <span className="ml-1 hidden text-xs sm:inline">Dentro</span>
                  </button>
                  {sel.pai_id && (
                    <button type="button" onClick={() => novoIrmao(sel.id)} className={botao} title="Ramo abaixo (Shift+Enter)">
                      <span aria-hidden>↧</span>
                      <span className="ml-1 hidden text-xs sm:inline">Abaixo</span>
                    </button>
                  )}
                  <button type="button" onClick={() => setEditando(sel.id)} className={botao} title="Editar texto (Enter)">
                    ✎<span className="ml-1 hidden text-xs sm:inline">Editar</span>
                  </button>
                </>
              )}
              {sel.pai_id && (filhos.get(sel.id) ?? []).length > 0 && (
                <button type="button" onClick={() => alternarRecolhido(sel.id)} className={botao} title="Recolher/expandir (Espaço)">
                  {sel.recolhido ? "▸" : "▾"}
                  <span className="ml-1 hidden text-xs sm:inline">{sel.recolhido ? "Expandir" : "Recolher"}</span>
                </button>
              )}
              {!somenteLeitura && (
                <button type="button" onClick={() => setNotaDe(sel)} className={botao} title="Nota">
                  📝<span className="ml-1 hidden text-xs sm:inline">Nota</span>
                </button>
              )}
              {!somenteLeitura && posicoesDisponiveis && (
                <MenuSuspenso
                  rotulo={`Cor e borda de ${sel.texto}`}
                  icone={
                    <span className="flex h-9 min-w-9 items-center justify-center px-2 text-sm text-gaiamum-text">
                      🎨<span className="ml-1 hidden text-xs sm:inline">Estilo</span>
                    </span>
                  }
                  classeBotao="rounded-full"
                  itens={(fechar) => (
                    <div className="flex w-56 flex-col gap-3 p-1.5">
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-gaiamum-text-muted">Cor</p>
                        <div className="grid grid-cols-5 gap-1.5">
                          {CORES_RAMO.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                fechar();
                                mudarAparencia(sel.id, { cor: c });
                              }}
                              aria-label={NOME_COR[c]}
                              aria-pressed={sel.cor === c}
                              title={NOME_COR[c]}
                              className={`h-8 w-8 rounded-full border-2 ${sel.cor === c ? "border-gaiamum-text" : "border-transparent"}`}
                              style={{ background: corEscolhida(c) }}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              fechar();
                              mudarAparencia(sel.id, { cor: null });
                            }}
                            aria-pressed={!sel.cor}
                            title="Automática (cor do ramo principal)"
                            className={`h-8 w-8 rounded-full border-2 text-[10px] text-gaiamum-text-muted ${!sel.cor ? "border-gaiamum-text" : "border-gaiamum-border"}`}
                          >
                            Auto
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-gaiamum-text-muted">Borda</p>
                        <div className="flex flex-col gap-0.5">
                          {(
                            [
                              ["caixa", "▭ Com borda"],
                              ["linha", "〰 Sem borda (linha)"],
                              [null, "Automática (Caixas | Linhas)"],
                            ] as [FormaRamo | null, string][]
                          ).map(([forma, rotulo]) => (
                            <ItemMenu
                              key={rotulo}
                              ativo={(sel.forma ?? null) === forma}
                              onClick={() => {
                                fechar();
                                mudarAparencia(sel.id, { forma });
                              }}
                            >
                              {rotulo}
                            </ItemMenu>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                />
              )}
              <MenuSuspenso
                rotulo={`Mais ações de ${sel.texto}`}
                icone={<span className="flex h-9 min-w-9 items-center justify-center px-2 text-base">⋯</span>}
                classeBotao="rounded-full"
                itens={(fechar) => (
                  <>
                    <Link href={`/mapas/${mapaId}?modo=lista${sel.pai_id ? `&foco=${sel.id}` : ""}`} className="rounded-lg px-3 py-2 text-sm text-gaiamum-text hover:bg-gaiamum-surface-raised">
                      🔍 Focar na lista
                    </Link>
                    {!somenteLeitura && selCaixa.manual && (
                      <ItemMenu
                        onClick={() => {
                          fechar();
                          gravarPosicao(sel.id, { x: sel.pos_x!, y: sel.pos_y! }, null);
                        }}
                      >
                        ↺ Voltar pra posição automática
                      </ItemMenu>
                    )}
                    {!somenteLeitura && sel.pai_id && (
                      <ItemMenu
                        perigo
                        onClick={() => {
                          fechar();
                          excluir(sel.id);
                        }}
                      >
                        Excluir
                      </ItemMenu>
                    )}
                  </>
                )}
              />
            </div>
          ) : (
            !editando && (
              <p className="pointer-events-none rounded-xl bg-gaiamum-surface/90 px-3 py-1.5 text-center text-xs text-gaiamum-text-muted shadow-sm">
                {somenteLeitura
                  ? "Toque num ramo para recolher · arraste para mover a tela · pinça ou Ctrl+roda para zoom"
                  : "Toque num ramo para ver as ações · arraste para mover · duplo toque edita"}
              </p>
            )
          )}
        </div>
      </div>

      {!posicoesDisponiveis && !somenteLeitura && (
        <p className="text-xs text-gaiamum-text-muted">
          Arrastar ramos e salvar a posição fica disponível depois de uma atualização do banco (migration 0060). Por enquanto, o mapa usa o layout automático.
        </p>
      )}

      {notaDe && <DialogoNota no={notaDe} aoFechar={() => setNotaDe(null)} aoSalvar={(texto) => salvarTexto(notaDe, texto)} />}
    </div>
  );
}

function Ramo({
  caixa,
  no,
  rascunho,
  selecionado,
  editando,
  ocultos,
  somenteLeitura,
  cor,
  sublinhado,
  aoExpandir,
  aoNovoFilho,
  aoNovoIrmao,
  aoConfirmar,
  aoCancelar,
}: {
  caixa: Caixa;
  no: NoMapa | undefined;
  rascunho: boolean;
  selecionado: boolean;
  editando: boolean;
  ocultos: number;
  somenteLeitura: boolean;
  cor: string;
  sublinhado: boolean;
  aoExpandir: () => void;
  aoNovoFilho: () => void;
  aoNovoIrmao: () => void;
  aoConfirmar: (texto: string) => void;
  aoCancelar: () => void;
}) {
  const e = estiloDoNivel(caixa.nivel);
  const texto = rascunho ? "" : (no?.texto ?? "");
  const lado = caixa.lado === -1 ? -1 : 1;

  const forma = sublinhado
    ? { borderBottom: `2.5px solid ${cor}`, borderRadius: 0 }
    : {
        border: `${caixa.nivel === 0 ? 3 : caixa.nivel === 1 ? 2 : 1.5}px solid ${cor}`,
        borderRadius: caixa.nivel === 0 ? 16 : caixa.nivel === 1 ? 12 : 10,
        background: "var(--gaiamum-surface)",
      };

  return (
    <div
      data-ramo={caixa.id}
      className="absolute"
      style={{ left: caixa.x - caixa.w / 2, top: caixa.y - caixa.h / 2, width: caixa.w, minHeight: caixa.h }}
    >
      <div
        className={`flex h-full w-full items-center justify-center ${selecionado ? "ring-2 ring-gaiamum-primary ring-offset-2 ring-offset-gaiamum-bg" : ""} ${
          somenteLeitura || editando ? "" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{
          ...forma,
          minHeight: caixa.h,
          padding: `${e.padY}px ${e.padX}px`,
          fontSize: e.fonte,
          lineHeight: `${e.linha}px`,
          fontWeight: caixa.nivel === 0 ? 600 : caixa.nivel === 1 ? 500 : 400,
          borderRadius: selecionado && sublinhado ? 6 : forma.borderRadius,
        }}
      >
        {editando ? (
          <CampoTextoRamo inicial={texto} aoConfirmar={aoConfirmar} aoCancelar={aoCancelar} />
        ) : (
          <span className={`block w-full break-words text-center text-gaiamum-text ${sublinhado ? "text-left" : ""}`}>
            {texto}
            {no?.nota && (
              <span aria-label="tem nota" title={no.nota} className="ml-1 text-xs">
                📝
              </span>
            )}
          </span>
        )}
      </div>

      {ocultos > 0 && (
        <button
          type="button"
          data-sem-gesto
          onClick={aoExpandir}
          aria-label={`Expandir ${ocultos} ramos escondidos`}
          className="absolute top-1/2 flex h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-gaiamum-surface px-1 text-[11px] font-semibold text-gaiamum-text"
          style={{ borderColor: cor, [lado === 1 ? "right" : "left"]: -30, top: sublinhado ? "100%" : "50%" }}
        >
          +{ocultos}
        </button>
      )}

      {selecionado && !editando && !somenteLeitura && !rascunho && (
        <>
          <button
            type="button"
            data-sem-gesto
            onClick={aoNovoFilho}
            aria-label="Novo ramo dentro"
            title="Novo ramo dentro"
            className="absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-gaiamum-success text-base font-bold text-white shadow-md"
            style={{ [lado === 1 ? "right" : "left"]: ocultos > 0 ? -66 : -38 }}
          >
            +
          </button>
          {no?.pai_id && (
            <button
              type="button"
              data-sem-gesto
              onClick={aoNovoIrmao}
              aria-label="Novo ramo abaixo"
              title="Novo ramo abaixo"
              className="absolute left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-gaiamum-success text-base font-bold text-white shadow-md"
              style={{ bottom: -38 }}
            >
              +
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Edição direta no ramo: Enter confirma, Esc cancela, sair do campo salva. */
function CampoTextoRamo({ inicial, aoConfirmar, aoCancelar }: { inicial: string; aoConfirmar: (t: string) => void; aoCancelar: () => void }) {
  const trava = useRef(false);
  return (
    <textarea
      data-sem-gesto
      autoFocus
      defaultValue={inicial}
      maxLength={MAX_TEXTO_NO}
      rows={1}
      placeholder={TEXTO_RASCUNHO}
      enterKeyHint="done"
      aria-label="Texto do ramo"
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          trava.current = true;
          aoConfirmar(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          trava.current = true;
          aoCancelar();
        }
      }}
      onBlur={(e) => {
        if (trava.current) return;
        trava.current = true;
        aoConfirmar(e.currentTarget.value);
      }}
      className="w-full min-w-[6rem] resize-none bg-transparent text-center text-gaiamum-text outline-none placeholder:text-gaiamum-text-muted"
      style={{ font: "inherit" }}
    />
  );
}

function DialogoNota({ no, aoFechar, aoSalvar }: { no: NoMapa; aoFechar: () => void; aoSalvar: (texto: string) => void }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <Dialog titulo="Ramo e nota" aoFechar={aoFechar} largura="md">
      <form
        className="mt-4 flex flex-col gap-4"
        action={(fd) => {
          const texto = String(fd.get("texto") ?? "");
          const nota = String(fd.get("nota") ?? "");
          if (texto.trim() && texto.trim() !== no.texto && (no.nota ?? "") === nota.trim()) {
            // Só o texto mudou: entra no desfazer como edição de texto.
            aoSalvar(texto);
            aoFechar();
            return;
          }
          executar(() => editarNo(no.id, texto, nota), { sucesso: "Salvo.", aoConcluir: aoFechar });
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Texto do ramo
          <input name="texto" required maxLength={MAX_TEXTO_NO} defaultValue={no.texto} className={CLASSE_CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Nota (opcional)
          <textarea name="nota" maxLength={MAX_NOTA_NO} rows={5} autoFocus defaultValue={no.nota ?? ""} className={CLASSE_CAMPO} />
        </label>
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
          {pendente ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </Dialog>
  );
}

