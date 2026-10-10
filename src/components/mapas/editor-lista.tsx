"use client";

import { createContext, useContext, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  colarListaNoRamo,
  criarNo,
  definirRecolhido,
  definirTudoRecolhido,
  editarNo,
  excluirNo,
  moverNo,
} from "@/lib/ecc/mapas/actions";
import { caminhoAte, contarDescendentes, filhosPorPai, ordemParaNovo } from "@/lib/ecc/mapas/arvore";
import { MAX_NOTA_NO, MAX_TEXTO_NO, type MovimentoNo, type NoMapa } from "@/lib/ecc/mapas/tipos";
import { Dialog } from "@/components/ui/dialog";
import { ItemMenu, MenuSuspenso } from "@/components/ui/menu-suspenso";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_BOTAO_SECUNDARIO, CLASSE_CAMPO } from "@/components/planner/estilos";

/** Onde o próximo ramo vai entrar enquanto a pessoa digita. */
type Rascunho = { paiId: string; depoisDe: string | null; texto?: string };
type Dialogo = { tipo: "nota" | "colar"; no: NoMapa } | null;
/** Marca que o campo já salvou/cancelou — o blur que vem depois não repete. */
type Trava = { current: boolean };

/** Tudo que os ramos precisam, sem passar prop por 6 níveis. Os
 * componentes ficam fora do `EditorLista` de propósito: componente
 * declarado dentro de outro é recriado a cada render e o campo em edição
 * perderia o foco a cada tecla. */
type Editor = {
  topoId: string;
  somenteLeitura: boolean;
  porId: Map<string, NoMapa>;
  filhos: Map<string | null, NoMapa[]>;
  editando: string | null;
  rascunho: Rascunho | null;
  setEditando: (id: string | null) => void;
  setRascunho: (r: Rascunho | null) => void;
  setDialogo: (d: Dialogo) => void;
  expandir: (id: string) => void;
  alternarRecolhido: (no: NoMapa) => void;
  salvarTexto: (no: NoMapa, texto: string) => void;
  criar: (r: Rascunho, texto: string, continuar: boolean) => void;
  mover: (no: NoMapa, movimento: MovimentoNo) => void;
  excluir: (no: NoMapa, perguntar: boolean) => void;
  hrefFoco: (id: string | null) => string;
};

const ContextoEditor = createContext<Editor | null>(null);

function useEditor(): Editor {
  const editor = useContext(ContextoEditor);
  if (!editor) throw new Error("Ramo fora do EditorLista.");
  return editor;
}

function ultimoFilho(editor: Editor, id: string): string | null {
  return (editor.filhos.get(id) ?? []).at(-1)?.id ?? null;
}

/**
 * Modo lista (outline) do mapa — o modo principal no celular. Atalhos como
 * no MindMeister: Enter cria o próximo ramo, Tab entra no ramo de cima,
 * Shift+Tab sai, Esc cancela, Backspace num ramo vazio sem filhos apaga.
 * No celular (sem Tab), o menu ⋯ de cada ramo tem os mesmos movimentos.
 *
 * Otimista onde é seguro: ramo novo e texto editado aparecem na hora (o id
 * do ramo novo nasce aqui); se o servidor recusar, volta ao que era.
 * "Focar" usa `?foco=<id>` na URL: o voltar do navegador funciona.
 */
export function EditorLista({
  mapaId,
  nos: nosServidor,
  focoId,
  somenteLeitura,
}: {
  mapaId: string;
  nos: NoMapa[];
  focoId: string | null;
  somenteLeitura: boolean;
}) {
  const { executar } = useAcaoPlanner();
  const [novos, setNovos] = useState<NoMapa[]>([]);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [recolhidos, setRecolhidos] = useState<Record<string, boolean>>({});
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [ultimoServidor, setUltimoServidor] = useState(nosServidor);

  const idsServidor = new Set(nosServidor.map((n) => n.id));
  // Chegou versão nova do servidor: ela vira a verdade. Só ficam os ramos
  // criados aqui que ainda não voltaram (senão um ramo criado e depois
  // excluído "ressuscitaria"), e as correções otimistas são descartadas.
  if (nosServidor !== ultimoServidor) {
    setUltimoServidor(nosServidor);
    setNovos((lista) => lista.filter((n) => !idsServidor.has(n.id)));
    setTextos({});
    if (!somenteLeitura) setRecolhidos({});
  }

  // Servidor + ramos criados aqui que ainda não voltaram na revalidação.
  const nos = [...nosServidor, ...novos.filter((n) => !idsServidor.has(n.id))].map((n) => ({
    ...n,
    texto: textos[n.id] ?? n.texto,
    recolhido: recolhidos[n.id] ?? n.recolhido,
  }));
  const porId = new Map(nos.map((n) => [n.id, n]));
  const filhos = filhosPorPai(nos);
  const raiz = nos.find((n) => n.pai_id === null) ?? null;
  const topo = (focoId && porId.get(focoId)) || raiz;
  if (!topo) return <p className="text-sm text-gaiamum-text-muted">Este mapa está vazio.</p>;
  const caminho = topo.id === raiz?.id ? [] : caminhoAte(nos, topo.id);

  const editor: Editor = {
    topoId: topo.id,
    somenteLeitura,
    porId,
    filhos,
    editando,
    rascunho,
    setEditando,
    setRascunho,
    setDialogo,
    hrefFoco: (id) => (id && id !== raiz?.id ? `/mapas/${mapaId}?foco=${id}` : `/mapas/${mapaId}`),
    expandir: (id) => setRecolhidos((rec) => ({ ...rec, [id]: false })),

    salvarTexto(no, texto) {
      const limpo = texto.trim();
      if (!limpo || limpo === no.texto) return;
      const anterior = textos[no.id];
      setTextos((t) => ({ ...t, [no.id]: limpo }));
      executar(() => editarNo(no.id, limpo), {
        desfazer: () => setTextos((t) => ({ ...t, [no.id]: anterior ?? no.texto })),
      });
    },

    criar(r, texto, continuar) {
      const limpo = texto.trim();
      if (!limpo) {
        setRascunho(null);
        return;
      }
      const id = crypto.randomUUID();
      const novo: NoMapa = {
        id,
        mapa_id: mapaId,
        pai_id: r.paiId,
        ordem: ordemParaNovo(nos, r.paiId, r.depoisDe),
        texto: limpo.slice(0, MAX_TEXTO_NO),
        nota: null,
        recolhido: false,
      };
      setNovos((lista) => [...lista, novo]);
      setRecolhidos((rec) => ({ ...rec, [r.paiId]: false }));
      setRascunho(continuar ? { paiId: r.paiId, depoisDe: id } : null);
      executar(() => criarNo(mapaId, r.paiId, limpo, r.depoisDe, id), {
        desfazer: () => setNovos((lista) => lista.filter((n) => n.id !== id)),
      });
    },

    mover(no, movimento) {
      executar(() => moverNo(no.id, movimento));
    },

    alternarRecolhido(no) {
      const valor = !no.recolhido;
      setRecolhidos((rec) => ({ ...rec, [no.id]: valor }));
      if (!somenteLeitura) {
        executar(() => definirRecolhido(no.id, valor), { desfazer: () => setRecolhidos((rec) => ({ ...rec, [no.id]: !valor })) });
      }
    },

    excluir(no, perguntar) {
      if (perguntar) {
        const dentro = contarDescendentes(filhos, no.id);
        const pergunta = dentro > 0 ? `Excluir "${no.texto}" e os ${dentro} ramos dentro dele?` : `Excluir "${no.texto}"?`;
        if (!window.confirm(pergunta)) return;
      }
      executar(() => excluirNo(no.id), { sucesso: perguntar ? "Ramo excluído." : undefined });
    },
  };

  function tudo(recolher: boolean) {
    setRecolhidos(Object.fromEntries(nos.filter((n) => n.pai_id !== null).map((n) => [n.id, recolher])));
    if (!somenteLeitura) executar(() => definirTudoRecolhido(mapaId, recolher));
  }

  const filhosTopo = filhos.get(topo.id) ?? [];
  const rascunhoNoTopo = rascunho?.paiId === topo.id ? rascunho : null;
  const botaoPequeno = `${CLASSE_BOTAO_SECUNDARIO} py-1.5 text-xs`;

  return (
    <ContextoEditor.Provider value={editor}>
      <div className="flex flex-col gap-4">
        {caminho.length > 0 && (
          <nav aria-label="Caminho até este ramo" className="text-sm text-gaiamum-text-muted">
            <ol className="flex flex-wrap items-center gap-1.5">
              {caminho.slice(0, -1).map((n) => (
                <li key={n.id} className="flex items-center gap-1.5">
                  <Link href={editor.hrefFoco(n.id)} className="max-w-[12rem] truncate hover:text-gaiamum-text hover:underline">
                    {n.texto}
                  </Link>
                  <span aria-hidden>›</span>
                </li>
              ))}
              <li aria-current="page" className="max-w-[12rem] truncate font-medium text-gaiamum-text">
                {topo.texto}
              </li>
            </ol>
          </nav>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editando === topo.id && !somenteLeitura ? (
              <CampoTexto no={topo} grande />
            ) : (
              <button
                type="button"
                disabled={somenteLeitura}
                onClick={() => setEditando(topo.id)}
                title={somenteLeitura ? undefined : "Clique pra editar"}
                className="w-full cursor-text rounded-lg px-1 text-left text-xl font-semibold text-gaiamum-text hover:bg-gaiamum-surface-raised disabled:cursor-default disabled:hover:bg-transparent"
              >
                {topo.texto}
              </button>
            )}
            {topo.nota && <p className="mt-1 whitespace-pre-wrap px-1 text-sm text-gaiamum-text-muted">{topo.nota}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {caminho.length > 0 && (
              <Link href={editor.hrefFoco(caminho.at(-2)?.id ?? null)} className={botaoPequeno}>
                ↑ Voltar um nível
              </Link>
            )}
            <button type="button" onClick={() => tudo(false)} className={botaoPequeno}>
              Expandir tudo
            </button>
            <button type="button" onClick={() => tudo(true)} className={botaoPequeno}>
              Recolher tudo
            </button>
            {!somenteLeitura && (
              <button type="button" onClick={() => setDialogo({ tipo: "nota", no: topo })} className={botaoPequeno}>
                📝 Nota
              </button>
            )}
          </div>
        </div>

        {filhosTopo.length === 0 && !rascunhoNoTopo ? (
          <div className="rounded-xl border border-dashed border-gaiamum-border px-4 py-8 text-center">
            <p className="font-medium text-gaiamum-text">Nenhum ramo ainda.</p>
            <p className="mt-1 text-sm text-gaiamum-text-muted">
              {somenteLeitura ? "Quem criou este mapa ainda não adicionou ramos." : "Adicione o primeiro ramo ou cole uma lista pronta."}
            </p>
          </div>
        ) : (
          <ListaRamos paiId={topo.id} itens={filhosTopo} rascunho={rascunhoNoTopo} />
        )}

        {!somenteLeitura && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRascunho({ paiId: topo.id, depoisDe: filhosTopo.at(-1)?.id ?? null })}
              className={CLASSE_BOTAO_PRIMARIO}
            >
              + Ramo
            </button>
            <button type="button" onClick={() => setDialogo({ tipo: "colar", no: topo })} className={CLASSE_BOTAO_SECUNDARIO}>
              📋 Colar lista
            </button>
          </div>
        )}

        {dialogo?.tipo === "nota" && <DialogoNota no={dialogo.no} aoFechar={() => setDialogo(null)} />}
        {dialogo?.tipo === "colar" && <DialogoColar mapaId={mapaId} no={dialogo.no} aoFechar={() => setDialogo(null)} />}
      </div>
    </ContextoEditor.Provider>
  );
}

/** Filhos de um ramo + o campo de ramo novo no lugar certo (depois de
 * `depoisDe`, ou no fim se ele ainda não voltou do servidor). */
function ListaRamos({ paiId, itens, rascunho, recuo = false }: { paiId: string; itens: NoMapa[]; rascunho: Rascunho | null; recuo?: boolean }) {
  const posicao = rascunho ? itens.findIndex((n) => n.id === rascunho.depoisDe) : -1;
  return (
    <ul className={recuo ? "ml-3 border-l border-gaiamum-border pl-3" : "flex flex-col"}>
      {itens.map((no, i) => (
        <Ramo key={no.id} no={no} campoNovoDepois={rascunho && posicao === i ? rascunho : null} />
      ))}
      {rascunho && posicao === -1 && <LinhaRascunho key={`novo-${paiId}`} r={rascunho} />}
    </ul>
  );
}

function Ramo({ no, campoNovoDepois }: { no: NoMapa; campoNovoDepois: Rascunho | null }) {
  const editor = useEditor();
  const meusFilhos = editor.filhos.get(no.id) ?? [];
  const ocultos = no.recolhido ? contarDescendentes(editor.filhos, no.id) : 0;
  const rascunhoDentro = editor.rascunho?.paiId === no.id ? editor.rascunho : null;
  const mostrarFilhos = (!no.recolhido && meusFilhos.length > 0) || rascunhoDentro;

  return (
    <>
      <li>
        <div className="group flex items-start gap-1 rounded-lg py-0.5 pr-1 hover:bg-gaiamum-surface-raised">
          {meusFilhos.length > 0 ? (
            <button
              type="button"
              onClick={() => editor.alternarRecolhido(no)}
              aria-expanded={!no.recolhido}
              aria-label={`${no.recolhido ? "Expandir" : "Recolher"} ${no.texto}`}
              className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs text-gaiamum-text-muted hover:bg-gaiamum-border/40 hover:text-gaiamum-text"
            >
              {no.recolhido ? "▸" : "▾"}
            </button>
          ) : (
            <span aria-hidden className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-gaiamum-text-muted/60" />
            </span>
          )}
          <div className="min-w-0 flex-1 py-0.5">
            {editor.editando === no.id ? (
              <CampoTexto no={no} />
            ) : (
              <button
                type="button"
                disabled={editor.somenteLeitura}
                onClick={() => editor.setEditando(no.id)}
                className="block w-full cursor-text rounded px-1 py-0.5 text-left text-sm text-gaiamum-text disabled:cursor-default"
              >
                <span className="whitespace-pre-wrap break-words">{no.texto}</span>
                {ocultos > 0 && (
                  <span className="ml-2 rounded-full bg-gaiamum-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-gaiamum-primary">
                    +{ocultos}
                  </span>
                )}
                {no.nota && <span className="mt-0.5 line-clamp-2 block text-xs text-gaiamum-text-muted">📝 {no.nota}</span>}
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center sm:opacity-0 sm:transition sm:focus-within:opacity-100 sm:group-hover:opacity-100">
            <MenuRamo no={no} />
          </div>
        </div>
        {mostrarFilhos && <ListaRamos paiId={no.id} itens={no.recolhido ? [] : meusFilhos} rascunho={rascunhoDentro} recuo />}
      </li>
      {campoNovoDepois && <LinhaRascunho key="campo-novo" r={campoNovoDepois} />}
    </>
  );
}

function CampoTexto({ no, grande = false }: { no: NoMapa; grande?: boolean }) {
  const editor = useEditor();
  const trava = useRef(false);

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    const valor = e.currentTarget.value;
    const ehTopo = no.id === editor.topoId;
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      trava.current = true;
      editor.salvarTexto(no, valor);
      editor.setEditando(null);
      // No topo, Enter abre um ramo dentro; nos outros, o irmão de baixo.
      editor.setRascunho(ehTopo || !no.pai_id ? { paiId: no.id, depoisDe: ultimoFilho(editor, no.id) } : { paiId: no.pai_id, depoisDe: no.id });
    } else if (e.key === "Escape") {
      trava.current = true;
      editor.setEditando(null);
    } else if (e.key === "Tab" && !ehTopo) {
      e.preventDefault();
      editor.salvarTexto(no, valor);
      editor.mover(no, e.shiftKey ? "fora" : "dentro");
    } else if (e.key === "Backspace" && valor === "" && !ehTopo && contarDescendentes(editor.filhos, no.id) === 0) {
      e.preventDefault();
      trava.current = true;
      editor.setEditando(null);
      editor.excluir(no, false);
    }
  }

  return (
    <input
      aria-label={`Texto de ${no.texto}`}
      autoFocus
      defaultValue={no.texto}
      maxLength={MAX_TEXTO_NO}
      enterKeyHint="done"
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={teclas}
      onBlur={(e) => {
        if (trava.current) return;
        trava.current = true;
        editor.salvarTexto(no, e.currentTarget.value);
        editor.setEditando(null);
      }}
      className={`${CLASSE_CAMPO} w-full ${grande ? "text-lg font-semibold" : "py-1"}`}
    />
  );
}

function LinhaRascunho({ r }: { r: Rascunho }) {
  const editor = useEditor();
  const trava: Trava = useRef(false);

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    const valor = e.currentTarget.value;
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!valor.trim()) {
        trava.current = true;
        editor.setRascunho(null);
        return;
      }
      editor.criar(r, valor, true);
      e.currentTarget.value = "";
    } else if (e.key === "Escape") {
      trava.current = true;
      editor.setRascunho(null);
    } else if (e.key === "Tab" && !e.shiftKey && r.depoisDe) {
      // Vira filho do ramo de cima.
      e.preventDefault();
      editor.expandir(r.depoisDe);
      editor.setRascunho({ paiId: r.depoisDe, depoisDe: ultimoFilho(editor, r.depoisDe), texto: valor });
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const pai = editor.porId.get(r.paiId);
      if (pai && pai.id !== editor.topoId && pai.pai_id) editor.setRascunho({ paiId: pai.pai_id, depoisDe: pai.id, texto: valor });
    }
  }

  return (
    <li className="flex items-center gap-2 py-1 pl-2">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-gaiamum-primary" />
      <label htmlFor="ramo-novo" className="sr-only">
        Novo ramo
      </label>
      <input
        id="ramo-novo"
        autoFocus
        defaultValue={r.texto}
        maxLength={MAX_TEXTO_NO}
        placeholder="Novo ramo… (Enter cria o próximo, Tab entra, Esc sai)"
        enterKeyHint="next"
        onKeyDown={teclas}
        onBlur={(e) => {
          if (trava.current) return;
          trava.current = true;
          editor.criar(r, e.currentTarget.value, false);
        }}
        className={`${CLASSE_CAMPO} w-full py-1.5`}
      />
    </li>
  );
}

function MenuRamo({ no }: { no: NoMapa }) {
  const editor = useEditor();
  const router = useRouter();
  const irmaos = no.pai_id ? (editor.filhos.get(no.pai_id) ?? []) : [];
  const i = irmaos.findIndex((n) => n.id === no.id);
  const pai = no.pai_id ? editor.porId.get(no.pai_id) : undefined;
  const podeSair = Boolean(pai && pai.pai_id !== null && pai.id !== editor.topoId);

  return (
    <MenuSuspenso
      rotulo={`Ações de ${no.texto}`}
      icone={<span className="px-1.5 py-0.5 text-base leading-none">⋯</span>}
      itens={(fechar) => {
        const item = (rotulo: string, acao: () => void, perigo = false) => (
          <ItemMenu
            perigo={perigo}
            onClick={() => {
              fechar();
              acao();
            }}
          >
            {rotulo}
          </ItemMenu>
        );
        return (
          <>
            {item("🔍 Focar neste ramo", () => router.push(editor.hrefFoco(no.id)))}
            {!editor.somenteLeitura && (
              <>
                {item("✎ Editar texto", () => editor.setEditando(no.id))}
                {item(no.nota ? "📝 Editar nota" : "📝 Adicionar nota", () => editor.setDialogo({ tipo: "nota", no }))}
                {item("＋ Ramo dentro", () => {
                  editor.expandir(no.id);
                  editor.setRascunho({ paiId: no.id, depoisDe: ultimoFilho(editor, no.id) });
                })}
                {item("📋 Colar lista aqui", () => editor.setDialogo({ tipo: "colar", no }))}
                {i > 0 && item("↑ Subir", () => editor.mover(no, "cima"))}
                {i >= 0 && i < irmaos.length - 1 && item("↓ Descer", () => editor.mover(no, "baixo"))}
                {i > 0 && item("→ Mover pra dentro do de cima", () => editor.mover(no, "dentro"))}
                {podeSair && item("← Mover pra fora", () => editor.mover(no, "fora"))}
                {item("Excluir", () => editor.excluir(no, true), true)}
              </>
            )}
          </>
        );
      }}
    />
  );
}

function DialogoNota({ no, aoFechar }: { no: NoMapa; aoFechar: () => void }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <Dialog titulo="Ramo e nota" aoFechar={aoFechar} largura="md">
      <form
        className="mt-4 flex flex-col gap-4"
        action={(fd) =>
          executar(() => editarNo(no.id, String(fd.get("texto") ?? ""), String(fd.get("nota") ?? "")), { sucesso: "Salvo.", aoConcluir: aoFechar })
        }
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

function DialogoColar({ mapaId, no, aoFechar }: { mapaId: string; no: NoMapa; aoFechar: () => void }) {
  const { pendente, executar } = useAcaoPlanner();
  return (
    <Dialog titulo={`Colar lista em “${no.texto}”`} aoFechar={aoFechar} largura="lg">
      <form
        className="mt-4 flex flex-col gap-4"
        action={(fd) =>
          executar(() => colarListaNoRamo(mapaId, no.id, String(fd.get("lista") ?? "")), { sucesso: "Lista adicionada.", aoConcluir: aoFechar })
        }
      >
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Uma ideia por linha. O recuo (espaços ou tab) vira sub-ramo; marcadores como -, • e 1. saem sozinhos.
          <textarea
            name="lista"
            required
            rows={10}
            autoFocus
            maxLength={50000}
            placeholder={"Lançamento\n  Copy\n  Anúncios\n    Meta\nOrçamento"}
            className={`${CLASSE_CAMPO} font-mono text-xs`}
          />
        </label>
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO_PRIMARIO}>
          {pendente ? "Adicionando..." : "Adicionar ramos"}
        </button>
      </form>
    </Dialog>
  );
}
