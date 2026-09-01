"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  Anexo,
  AtividadeTarefa,
  ChecklistItem,
  ColunaKanban,
  CorEtiqueta,
  Etiqueta,
  MembroTenant,
  Prioridade,
  Tarefa,
} from "@/lib/ecc/tipos";
import { CLASSE_COR_ETIQUETA, CLASSE_FUNDO_QUADRO, paraDatetimeLocal, tocarSomConcluido } from "@/lib/ecc/kanban";
import { MENSAGEM_POR_TIPO } from "@/lib/ecc/mensagens-atividade";
import { aplicarMencao, calcularBuscaMencao, dividirTextoPorMencoes } from "@/lib/ecc/mencoes";
import {
  adicionarChecklistItem,
  alternarChecklistItem,
  alternarMembroTarefa,
  atualizarDatasTarefa,
  atualizarDescricaoTarefa,
  atualizarPrioridadeTarefa,
  comentarNaTarefa,
  listarAtividadesDaTarefa,
  moverTarefa,
  removerChecklistItem,
} from "@/lib/ecc/actions";
import { adicionarEtiquetaNaTarefa, removerEtiquetaDaTarefa } from "@/lib/ecc/etiquetas";
import { enviarAnexoTarefa } from "@/lib/ecc/anexos";
import { AnexoArquivo } from "@/components/anexo-arquivo";
import { AvatarIniciais } from "@/components/avatar-iniciais";

const PRIORIDADES: Prioridade[] = ["P1", "P2", "P3", "P4"];
const CORES_ETIQUETA: CorEtiqueta[] = ["purple", "teal", "yellow", "blue", "coral", "lime"];

export function DetalheTarefa({
  tarefa,
  projetoId,
  colunasDoProjeto,
  membrosDoTenant,
  membrosDaTarefa,
  checklist,
  etiquetasDoTenant,
  etiquetasDaTarefa,
  anexos,
  aoFechar,
}: {
  tarefa: Tarefa;
  projetoId: string;
  colunasDoProjeto: ColunaKanban[];
  membrosDoTenant: MembroTenant[];
  membrosDaTarefa: string[];
  checklist: ChecklistItem[];
  etiquetasDoTenant: Etiqueta[];
  etiquetasDaTarefa: string[];
  anexos: Anexo[];
  aoFechar: () => void;
}) {
  const [descricao, setDescricao] = useState(tarefa.descricao ?? "");
  const [buscaEtiqueta, setBuscaEtiqueta] = useState("");
  const [atividades, setAtividades] = useState<AtividadeTarefa[] | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  // Menção @membro — mesmo padrão nos 3 campos de texto livre do cartão:
  // texto + cursor controlados, `busca` guarda o token em digitação (null =
  // dropdown fechado). Ao escolher uma sugestão, o cursor pendente é
  // reaplicado no DOM via ref, porque só atualizar o state não move o
  // cursor real do <input>/<textarea>.
  const [textoComentario, setTextoComentario] = useState("");
  const [cursorComentario, setCursorComentario] = useState(0);
  const [buscaMencaoComentario, setBuscaMencaoComentario] = useState<string | null>(null);
  const refComentario = useRef<HTMLInputElement>(null);
  const cursorPendenteComentarioRef = useRef<number | null>(null);

  const [cursorDescricao, setCursorDescricao] = useState(0);
  const [buscaMencaoDescricao, setBuscaMencaoDescricao] = useState<string | null>(null);
  const refDescricao = useRef<HTMLTextAreaElement>(null);
  const cursorPendenteDescricaoRef = useRef<number | null>(null);

  const [textoItem, setTextoItem] = useState("");
  const [cursorItem, setCursorItem] = useState(0);
  const [buscaMencaoItem, setBuscaMencaoItem] = useState<string | null>(null);
  const refItem = useRef<HTMLInputElement>(null);
  const cursorPendenteItemRef = useRef<number | null>(null);

  useEffect(() => {
    if (cursorPendenteComentarioRef.current !== null && refComentario.current) {
      refComentario.current.setSelectionRange(cursorPendenteComentarioRef.current, cursorPendenteComentarioRef.current);
      refComentario.current.focus();
      cursorPendenteComentarioRef.current = null;
    }
  }, [textoComentario]);

  useEffect(() => {
    if (cursorPendenteDescricaoRef.current !== null && refDescricao.current) {
      refDescricao.current.setSelectionRange(cursorPendenteDescricaoRef.current, cursorPendenteDescricaoRef.current);
      refDescricao.current.focus();
      cursorPendenteDescricaoRef.current = null;
    }
  }, [descricao]);

  useEffect(() => {
    if (cursorPendenteItemRef.current !== null && refItem.current) {
      refItem.current.setSelectionRange(cursorPendenteItemRef.current, cursorPendenteItemRef.current);
      refItem.current.focus();
      cursorPendenteItemRef.current = null;
    }
  }, [textoItem]);

  function sugestoesMencao(busca: string | null): MembroTenant[] {
    if (busca === null) return [];
    return membrosDoTenant.filter((m) => m.email.toLowerCase().includes(busca.toLowerCase()));
  }

  /** Chip destacado (bolinha + parte do e-mail antes do @) no lugar do
   * `@email` cru — usado na timeline de comentários e nos itens do
   * checklist já salvos. Descrição fica de fora (é sempre <textarea>). */
  function renderTextoComMencoes(texto: string) {
    return dividirTextoPorMencoes(texto, membrosDoTenant).map((parte, indice) =>
      parte.membro ? (
        <span key={indice} className="inline-flex items-center gap-1 align-middle">
          <AvatarIniciais email={parte.membro.email} tamanho="sm" />
          <span className="font-medium text-gaiamum-text">{parte.membro.email.split("@")[0]}</span>
        </span>
      ) : (
        <span key={indice}>{parte.texto}</span>
      ),
    );
  }

  function aoMudarComentario(valor: string, cursor: number) {
    setTextoComentario(valor);
    setCursorComentario(cursor);
    setBuscaMencaoComentario(calcularBuscaMencao(valor, cursor));
  }

  function escolherMencaoComentario(email: string) {
    const { novoTexto, novoCursor } = aplicarMencao(textoComentario, cursorComentario, email);
    cursorPendenteComentarioRef.current = novoCursor;
    setTextoComentario(novoTexto);
    setBuscaMencaoComentario(null);
  }

  function aoMudarDescricao(valor: string, cursor: number) {
    setDescricao(valor);
    setCursorDescricao(cursor);
    setBuscaMencaoDescricao(calcularBuscaMencao(valor, cursor));
  }

  function escolherMencaoDescricao(email: string) {
    const { novoTexto, novoCursor } = aplicarMencao(descricao, cursorDescricao, email);
    cursorPendenteDescricaoRef.current = novoCursor;
    setDescricao(novoTexto);
    setBuscaMencaoDescricao(null);
  }

  function aoMudarItem(valor: string, cursor: number) {
    setTextoItem(valor);
    setCursorItem(cursor);
    setBuscaMencaoItem(calcularBuscaMencao(valor, cursor));
  }

  function escolherMencaoItem(email: string) {
    const { novoTexto, novoCursor } = aplicarMencao(textoItem, cursorItem, email);
    cursorPendenteItemRef.current = novoCursor;
    setTextoItem(novoTexto);
    setBuscaMencaoItem(null);
  }

  useEffect(() => {
    let cancelado = false;
    listarAtividadesDaTarefa(tarefa.id).then((dados) => {
      if (!cancelado) setAtividades(dados);
    });
    return () => {
      cancelado = true;
    };
  }, [tarefa.id]);

  function nomeDoAutor(userId: string): string {
    const membro = membrosDoTenant.find((m) => m.user_id === userId);
    return membro?.email ?? "alguém";
  }

  function comentar(formData: FormData) {
    iniciarTransicao(async () => {
      await comentarNaTarefa(tarefa.id, projetoId, formData);
      setTextoComentario("");
      setBuscaMencaoComentario(null);
      const dados = await listarAtividadesDaTarefa(tarefa.id);
      setAtividades(dados);
    });
  }

  const etiquetasAnexadas = etiquetasDoTenant.filter((e) => etiquetasDaTarefa.includes(e.id));
  const sugestoesEtiqueta =
    buscaEtiqueta.trim() === ""
      ? []
      : etiquetasDoTenant.filter(
          (e) =>
            !etiquetasDaTarefa.includes(e.id) && e.nome.toLowerCase().includes(buscaEtiqueta.trim().toLowerCase()),
        );
  const nomeJaExiste = etiquetasDoTenant.some((e) => e.nome.toLowerCase() === buscaEtiqueta.trim().toLowerCase());

  function anexarEtiqueta(nome: string, cor?: CorEtiqueta) {
    if (!nome.trim()) return;
    setBuscaEtiqueta("");
    iniciarTransicao(async () => {
      await adicionarEtiquetaNaTarefa(tarefa.id, projetoId, nome, cor);
      router.refresh();
    });
  }

  function desanexarEtiqueta(etiquetaId: string) {
    iniciarTransicao(async () => {
      await removerEtiquetaDaTarefa(tarefa.id, etiquetaId, projetoId);
      router.refresh();
    });
  }

  const concluidos = checklist.filter((item) => item.concluido).length;

  function salvarDescricao() {
    iniciarTransicao(async () => {
      const formData = new FormData();
      formData.set("descricao", descricao);
      await atualizarDescricaoTarefa(tarefa.id, projetoId, formData);
      router.refresh();
    });
  }

  function salvarDatas(campo: "data_inicio" | "data_limite", valor: string) {
    iniciarTransicao(async () => {
      const formData = new FormData();
      formData.set("data_inicio", campo === "data_inicio" ? valor : (tarefa.data_inicio ?? ""));
      // O <input type="datetime-local"> devolve hora local sem fuso — new
      // Date(valor) interpreta como hora local do navegador, .toISOString()
      // converte pra UTC certo antes de salvar. Sem isso, o horário exibido
      // depois de salvar não batia com o que a pessoa digitou.
      const dataLimiteValor =
        campo === "data_limite" ? (valor ? new Date(valor).toISOString() : "") : (tarefa.data_limite ?? "");
      formData.set("data_limite", dataLimiteValor);
      await atualizarDatasTarefa(tarefa.id, projetoId, formData);
      router.refresh();
    });
  }

  function mudarPrioridade(prioridade: Prioridade) {
    iniciarTransicao(async () => {
      await atualizarPrioridadeTarefa(tarefa.id, projetoId, prioridade);
      router.refresh();
    });
  }

  function moverPara(novaColunaId: string) {
    if (colunasDoProjeto.find((c) => c.id === novaColunaId)?.concluido) {
      tocarSomConcluido();
    }
    iniciarTransicao(async () => {
      await moverTarefa(tarefa.id, projetoId, novaColunaId);
      router.refresh();
    });
  }

  function alternarMembro(userId: string) {
    iniciarTransicao(async () => {
      await alternarMembroTarefa(tarefa.id, userId, projetoId);
      router.refresh();
    });
  }

  function alternarItem(itemId: string, concluido: boolean) {
    iniciarTransicao(async () => {
      await alternarChecklistItem(itemId, tarefa.id, concluido, projetoId);
      router.refresh();
    });
  }

  function removerItem(itemId: string) {
    iniciarTransicao(async () => {
      await removerChecklistItem(itemId, tarefa.id, projetoId);
      router.refresh();
    });
  }

  function adicionarItem(formData: FormData) {
    iniciarTransicao(async () => {
      await adicionarChecklistItem(tarefa.id, projetoId, formData);
      setTextoItem("");
      setBuscaMencaoItem(null);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onClick={aoFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gaiamum-text">{tarefa.titulo}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {pendente && <span className="text-xs text-gaiamum-text-muted">Salvando…</span>}
            <button type="button" onClick={aoFechar} className="text-gaiamum-text-muted hover:text-gaiamum-text">
              ✕
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
            Coluna
            <select
              value={tarefa.coluna_id}
              onChange={(e) => moverPara(e.target.value)}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
            >
              {colunasDoProjeto.map((coluna) => (
                <option key={coluna.id} value={coluna.id}>
                  {coluna.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
            Prioridade
            <select
              value={tarefa.prioridade}
              onChange={(e) => mudarPrioridade(e.target.value as Prioridade)}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
            Data de início
            <input
              type="date"
              defaultValue={tarefa.data_inicio ?? ""}
              onChange={(e) => salvarDatas("data_inicio", e.target.value)}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
            Data e hora de entrega
            <input
              type="datetime-local"
              defaultValue={tarefa.data_limite ? paraDatetimeLocal(tarefa.data_limite) : ""}
              onChange={(e) => salvarDatas("data_limite", e.target.value)}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
            />
          </label>
        </div>

        <div className="relative mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gaiamum-text-muted">Etiquetas</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {etiquetasAnexadas.map((etiqueta) => (
              <span
                key={etiqueta.id}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${CLASSE_COR_ETIQUETA[etiqueta.cor]}`}
              >
                {etiqueta.nome}
                <button
                  type="button"
                  onClick={() => desanexarEtiqueta(etiqueta.id)}
                  className="opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              value={buscaEtiqueta}
              onChange={(e) => setBuscaEtiqueta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nomeJaExiste) {
                  e.preventDefault();
                  anexarEtiqueta(buscaEtiqueta);
                }
              }}
              placeholder="Nomear ou buscar etiqueta..."
              className="min-w-[140px] flex-1 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1 text-xs text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
          </div>

          {buscaEtiqueta.trim() !== "" && (
            <div className="absolute top-full z-10 mt-1 flex w-full flex-col gap-1.5 rounded-lg border border-gaiamum-border bg-gaiamum-surface p-1.5 shadow-lg">
              {sugestoesEtiqueta.map((etiqueta) => (
                <button
                  key={etiqueta.id}
                  type="button"
                  onClick={() => anexarEtiqueta(etiqueta.nome)}
                  className="flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gaiamum-surface-raised"
                >
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${CLASSE_COR_ETIQUETA[etiqueta.cor]}`}>
                    {etiqueta.nome}
                  </span>
                </button>
              ))}
              {!nomeJaExiste && (
                <div className="flex flex-col gap-1 px-2 py-1">
                  <span className="text-xs text-gaiamum-text-muted">
                    Escolha a cor da etiqueta &quot;{buscaEtiqueta.trim()}&quot;
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CORES_ETIQUETA.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        title={cor}
                        onClick={() => anexarEtiqueta(buscaEtiqueta, cor)}
                        className={`h-6 w-6 rounded-full ${CLASSE_FUNDO_QUADRO[cor]} ring-offset-2 ring-offset-gaiamum-surface transition hover:ring-2 hover:ring-gaiamum-text-muted`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gaiamum-text-muted">Descrição</span>
          <textarea
            ref={refDescricao}
            rows={3}
            value={descricao}
            onChange={(e) => aoMudarDescricao(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onBlur={salvarDescricao}
            placeholder="Adicionar uma descrição... (use @ pra mencionar alguém)"
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
          {sugestoesMencao(buscaMencaoDescricao).length > 0 && (
            <div className="absolute top-full z-10 mt-1 flex w-full flex-col gap-0.5 rounded-lg border border-gaiamum-border bg-gaiamum-surface p-1.5 shadow-lg">
              {sugestoesMencao(buscaMencaoDescricao).map((membro) => (
                <button
                  key={membro.user_id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolherMencaoDescricao(membro.email)}
                  className="flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gaiamum-surface-raised"
                >
                  <AvatarIniciais email={membro.email} tamanho="sm" />
                  {membro.email}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          <span className="text-xs font-medium text-gaiamum-text-muted">Membros</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {membrosDoTenant.map((membro) => {
              const ativo = membrosDaTarefa.includes(membro.user_id);
              return (
                <button
                  key={membro.user_id}
                  type="button"
                  onClick={() => alternarMembro(membro.user_id)}
                  title={membro.email}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                    ativo
                      ? "bg-gaiamum-primary text-white"
                      : "border border-gaiamum-border bg-gaiamum-surface-raised text-gaiamum-text-muted hover:border-gaiamum-primary"
                  }`}
                >
                  {membro.email.slice(0, 2).toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gaiamum-text-muted">Checklist</span>
            {checklist.length > 0 && (
              <span className="text-xs text-gaiamum-text-muted">
                {concluidos}/{checklist.length}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.concluido}
                  onChange={(e) => alternarItem(item.id, e.target.checked)}
                  className="h-4 w-4 accent-[var(--gaiamum-primary)]"
                />
                <span
                  className={`flex-1 text-sm ${item.concluido ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"}`}
                >
                  {renderTextoComMencoes(item.texto)}
                </span>
                <button
                  type="button"
                  onClick={() => removerItem(item.id)}
                  className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="relative mt-2">
            <form action={adicionarItem} className="flex gap-2">
              <input
                ref={refItem}
                name="texto"
                value={textoItem}
                onChange={(e) => aoMudarItem(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                required
                placeholder="Adicionar item (use @ pra mencionar alguém)"
                className="flex-1 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-1.5 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
              <button
                type="submit"
                className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-sm text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
              >
                Adicionar
              </button>
            </form>
            {sugestoesMencao(buscaMencaoItem).length > 0 && (
              <div className="absolute top-full z-10 mt-1 flex w-full flex-col gap-0.5 rounded-lg border border-gaiamum-border bg-gaiamum-surface p-1.5 shadow-lg">
                {sugestoesMencao(buscaMencaoItem).map((membro) => (
                  <button
                    key={membro.user_id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => escolherMencaoItem(membro.email)}
                    className="flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gaiamum-surface-raised"
                  >
                    <AvatarIniciais email={membro.email} tamanho="sm" />
                    {membro.email}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <span className="text-xs font-medium text-gaiamum-text-muted">Anexos</span>
          <div className="mt-1.5">
            <AnexoArquivo
              anexos={anexos}
              enviar={(formData) => enviarAnexoTarefa(tarefa.id, projetoId, formData)}
              caminhoRevalidar={`/projetos/${projetoId}/tarefas`}
            />
          </div>
        </div>

        <div className="mt-5">
          <span className="text-xs font-medium text-gaiamum-text-muted">Comentários</span>

          <div className="relative mt-1.5">
            <form action={comentar} className="flex gap-2">
              <input
                ref={refComentario}
                name="texto"
                value={textoComentario}
                onChange={(e) =>
                  aoMudarComentario(e.target.value, e.target.selectionStart ?? e.target.value.length)
                }
                required
                placeholder="Comentar... (use @ pra mencionar alguém)"
                className="flex-1 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-1.5 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
              <button
                type="submit"
                className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-sm text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
              >
                Enviar
              </button>
            </form>
            {sugestoesMencao(buscaMencaoComentario).length > 0 && (
              <div className="absolute top-full z-10 mt-1 flex w-full flex-col gap-0.5 rounded-lg border border-gaiamum-border bg-gaiamum-surface p-1.5 shadow-lg">
                {sugestoesMencao(buscaMencaoComentario).map((membro) => (
                  <button
                    key={membro.user_id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => escolherMencaoComentario(membro.email)}
                    className="flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gaiamum-surface-raised"
                  >
                    <AvatarIniciais email={membro.email} tamanho="sm" />
                    {membro.email}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {atividades === null && <p className="text-xs text-gaiamum-text-muted">Carregando...</p>}
            {atividades !== null && atividades.length === 0 && (
              <p className="text-xs text-gaiamum-text-muted">Nenhum comentário ainda.</p>
            )}
            {atividades?.map((atividade) => (
              <div key={atividade.id} className="text-xs text-gaiamum-text-muted">
                <span className="font-medium text-gaiamum-text">{nomeDoAutor(atividade.user_id)}</span>{" "}
                {atividade.tipo === "comentario" ? (
                  <>comentou: &quot;{renderTextoComMencoes(atividade.detalhe.texto ?? "")}&quot;</>
                ) : (
                  MENSAGEM_POR_TIPO[atividade.tipo](atividade.detalhe)
                )}
                <span className="ml-1 text-gaiamum-text-muted">
                  · {new Date(atividade.criado_em).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
