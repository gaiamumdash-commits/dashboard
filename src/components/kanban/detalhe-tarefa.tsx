"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  Anexo,
  AtividadeTarefa,
  ChecklistItem,
  ColunaKanban,
  Etiqueta,
  MembroTenant,
  Prioridade,
  Tarefa,
} from "@/lib/ecc/tipos";
import { CLASSE_COR_ETIQUETA, paraDatetimeLocal, tocarSomConcluido } from "@/lib/ecc/kanban";
import { MENSAGEM_POR_TIPO } from "@/lib/ecc/mensagens-atividade";
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

const PRIORIDADES: Prioridade[] = ["P1", "P2", "P3", "P4"];

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

  function anexarEtiqueta(nome: string) {
    if (!nome.trim()) return;
    setBuscaEtiqueta("");
    iniciarTransicao(async () => {
      await adicionarEtiquetaNaTarefa(tarefa.id, projetoId, nome);
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
                if (e.key === "Enter") {
                  e.preventDefault();
                  anexarEtiqueta(buscaEtiqueta);
                }
              }}
              placeholder="Nomear ou buscar etiqueta..."
              className="min-w-[140px] flex-1 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1 text-xs text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
          </div>

          {buscaEtiqueta.trim() !== "" && (
            <div className="absolute top-full z-10 mt-1 flex w-full flex-col gap-1 rounded-lg border border-gaiamum-border bg-gaiamum-surface p-1.5 shadow-lg">
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
              <button
                type="button"
                onClick={() => anexarEtiqueta(buscaEtiqueta)}
                className="rounded px-2 py-1 text-left text-sm text-gaiamum-primary hover:bg-gaiamum-surface-raised"
              >
                + Criar etiqueta &quot;{buscaEtiqueta.trim()}&quot;
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gaiamum-text-muted">Descrição</span>
          <textarea
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onBlur={salvarDescricao}
            placeholder="Adicionar uma descrição..."
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
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
                  {item.texto}
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

          <form action={adicionarItem} className="mt-2 flex gap-2">
            <input
              name="texto"
              required
              placeholder="Adicionar item"
              className="flex-1 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-1.5 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
            <button
              type="submit"
              className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-sm text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
            >
              Adicionar
            </button>
          </form>
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

          <form action={comentar} className="mt-1.5 flex gap-2">
            <input
              name="texto"
              required
              placeholder="Comentar..."
              className="flex-1 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-1.5 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
            <button
              type="submit"
              className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-sm text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
            >
              Enviar
            </button>
          </form>

          <div className="mt-3 flex flex-col gap-2">
            {atividades === null && <p className="text-xs text-gaiamum-text-muted">Carregando...</p>}
            {atividades !== null && atividades.length === 0 && (
              <p className="text-xs text-gaiamum-text-muted">Nenhum comentário ainda.</p>
            )}
            {atividades?.map((atividade) => (
              <div key={atividade.id} className="text-xs text-gaiamum-text-muted">
                <span className="font-medium text-gaiamum-text">{nomeDoAutor(atividade.user_id)}</span>{" "}
                {MENSAGEM_POR_TIPO[atividade.tipo](atividade.detalhe)}
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
