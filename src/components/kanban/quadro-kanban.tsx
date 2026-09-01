"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { Anexo, ChecklistItem, ColunaKanban, Etiqueta, MembroTenant, Tarefa, TarefaEtiqueta, TarefaMembro } from "@/lib/ecc/tipos";
import { tocarSomConcluido } from "@/lib/ecc/kanban";
import {
  criarColuna,
  criarTarefa,
  deletarTarefa,
  excluirColuna,
  moverTarefa,
  renomearColuna,
  reordenarColunas,
} from "@/lib/ecc/actions";
import { DetalheTarefa } from "@/components/kanban/detalhe-tarefa";
import { CartaoTarefa } from "@/components/kanban/cartao-tarefa";
import { BarraProgresso } from "@/components/ui/barra-progresso";

export function QuadroKanban({
  projetoId,
  colunasIniciais,
  tarefasIniciais,
  membrosDoTenant,
  tarefaMembrosIniciais,
  checklistItensIniciais,
  etiquetasDoTenant,
  tarefaEtiquetasIniciais,
  anexosIniciais,
  alarmePorTarefa,
  usuarioAtualId,
  podeExcluirTarefa,
}: {
  projetoId: string;
  colunasIniciais: ColunaKanban[];
  tarefasIniciais: Tarefa[];
  membrosDoTenant: MembroTenant[];
  tarefaMembrosIniciais: TarefaMembro[];
  checklistItensIniciais: ChecklistItem[];
  etiquetasDoTenant: Etiqueta[];
  tarefaEtiquetasIniciais: TarefaEtiqueta[];
  anexosIniciais: Anexo[];
  alarmePorTarefa: Record<string, number>;
  usuarioAtualId: string | null;
  podeExcluirTarefa: boolean;
}) {
  const [tarefas, setTarefas] = useState(tarefasIniciais);
  const [tarefasIniciaisAnteriores, setTarefasIniciaisAnteriores] = useState(tarefasIniciais);
  const [colunas, setColunas] = useState(colunasIniciais);
  const [colunasIniciaisAnteriores, setColunasIniciaisAnteriores] = useState(colunasIniciais);
  const [tarefaAbertaId, setTarefaAbertaId] = useState<string | null>(null);
  const [colunaEditandoId, setColunaEditandoId] = useState<string | null>(null);
  const [colunaArrastadaId, setColunaArrastadaId] = useState<string | null>(null);
  const [criandoColuna, setCriandoColuna] = useState(false);
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();
  const inputNovaColunaRef = useRef<HTMLInputElement>(null);

  // Mantém o estado local em dia com o que o servidor manda depois de um
  // router.refresh() (ex.: ao fechar o modal de detalhe da tarefa, que edita
  // vários campos por lá). Update durante o render (padrão recomendado pelo
  // React pra "ajustar estado quando uma prop muda"), não num useEffect —
  // evita um passo de render extra.
  if (tarefasIniciais !== tarefasIniciaisAnteriores) {
    setTarefasIniciaisAnteriores(tarefasIniciais);
    setTarefas(tarefasIniciais);
  }
  if (colunasIniciais !== colunasIniciaisAnteriores) {
    setColunasIniciaisAnteriores(colunasIniciais);
    setColunas(colunasIniciais);
  }

  function moverPara(tarefaId: string, novaColunaId: string) {
    if (colunasIniciais.find((c) => c.id === novaColunaId)?.concluido) {
      tocarSomConcluido();
    }
    const colunaAnterior = tarefas.find((t) => t.id === tarefaId)?.coluna_id;
    setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, coluna_id: novaColunaId } : t)));
    iniciarTransicao(() => {
      moverTarefa(tarefaId, projetoId, novaColunaId).catch((err) => {
        if (colunaAnterior) {
          setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, coluna_id: colunaAnterior } : t)));
        }
        toast.error(mensagemDeErro(err, "Falha ao mover cartão."));
      });
    });
  }

  function excluir(tarefaId: string) {
    if (!window.confirm("Apagar este cartão? Essa ação não pode ser desfeita.")) return;
    const tarefaRemovida = tarefas.find((t) => t.id === tarefaId);
    setTarefas((atual) => atual.filter((t) => t.id !== tarefaId));
    iniciarTransicao(() => {
      deletarTarefa(tarefaId, projetoId).catch((err) => {
        if (tarefaRemovida) setTarefas((atual) => [...atual, tarefaRemovida]);
        toast.error(mensagemDeErro(err, "Falha ao apagar cartão."));
      });
    });
  }

  // Cartão aparece na hora, sem esperar o servidor confirmar — mesmo padrão
  // de moverPara/excluir acima. Os ids nascem no cliente (crypto.randomUUID)
  // e vão junto pro insert, então o otimista e o real são a mesma linha, sem
  // precisar reconciliar depois. Se a Server Action falhar, desfaz.
  function criarCartaoOtimista(colunaId: string, tituloBruto: string) {
    const titulos = tituloBruto
      .split("\n")
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0);
    if (titulos.length === 0) return;

    const ids = titulos.map(() => crypto.randomUUID());
    const agora = new Date().toISOString();
    const novas: Tarefa[] = titulos.map((titulo, indice) => ({
      id: ids[indice],
      tenant_id: "",
      projeto_id: projetoId,
      titulo,
      descricao: null,
      coluna_id: colunaId,
      prioridade: "P3",
      data_inicio: null,
      data_limite: null,
      tempo_estimado_min: null,
      tempo_realizado_min: null,
      criado_em: agora,
    }));

    setTarefas((atual) => [...atual, ...novas]);

    const formData = new FormData();
    formData.set("titulo", tituloBruto);
    iniciarTransicao(() => {
      criarTarefa(projetoId, colunaId, formData, ids).catch((err) => {
        setTarefas((atual) => atual.filter((t) => !ids.includes(t.id)));
        toast.error(mensagemDeErro(err, "Falha ao criar tarefa."));
      });
    });
  }

  // Mesma lógica: fecha a edição e troca o nome na hora, sem esperar
  // resposta do servidor.
  function renomearColunaOtimista(colunaId: string, novoNome: string) {
    if (!novoNome.trim()) {
      setColunaEditandoId(null);
      return;
    }
    const nomeAnterior = colunas.find((c) => c.id === colunaId)?.nome ?? "";
    setColunas((atual) => atual.map((c) => (c.id === colunaId ? { ...c, nome: novoNome } : c)));
    setColunaEditandoId(null);

    const formData = new FormData();
    formData.set("nome", novoNome);
    iniciarTransicao(() => {
      renomearColuna(colunaId, projetoId, formData).catch((err) => {
        setColunas((atual) => atual.map((c) => (c.id === colunaId ? { ...c, nome: nomeAnterior } : c)));
        toast.error(mensagemDeErro(err, "Falha ao renomear coluna."));
      });
    });
  }

  function criarColunaOtimista(nome: string) {
    if (!nome.trim()) return;
    const id = crypto.randomUUID();
    const novaColuna: ColunaKanban = {
      id,
      tenant_id: "",
      projeto_id: projetoId,
      nome,
      ordem: colunasAbertas.length,
      concluido: false,
      criado_em: new Date().toISOString(),
    };
    setColunas((atual) => [...colunasAbertas, novaColuna, ...atual.filter((c) => c.concluido)]);
    setCriandoColuna(false);

    const formData = new FormData();
    formData.set("nome", nome);
    iniciarTransicao(() => {
      criarColuna(projetoId, formData).catch((err) => {
        setColunas((atual) => atual.filter((c) => c.id !== id));
        toast.error(mensagemDeErro(err, "Falha ao criar coluna."));
      });
    });
  }

  function soltarColuna(colunaAlvoId: string) {
    if (!colunaArrastadaId || colunaArrastadaId === colunaAlvoId) return;

    const ordemAnterior = colunas;
    const abertas = colunas.filter((c) => !c.concluido);
    const fixa = colunas.filter((c) => c.concluido);
    const semArrastada = abertas.filter((c) => c.id !== colunaArrastadaId);
    const arrastada = abertas.find((c) => c.id === colunaArrastadaId);
    const indiceAlvo = semArrastada.findIndex((c) => c.id === colunaAlvoId);
    if (!arrastada || indiceAlvo === -1) return;

    semArrastada.splice(indiceAlvo, 0, arrastada);
    setColunas([...semArrastada, ...fixa]);
    setColunaArrastadaId(null);
    iniciarTransicao(() => {
      reordenarColunas(projetoId, semArrastada.map((c) => c.id)).catch((err) => {
        setColunas(ordemAnterior);
        toast.error(mensagemDeErro(err, "Falha ao reordenar colunas."));
      });
    });
  }

  function apagarColuna(colunaId: string) {
    if (!window.confirm("Apagar esta coluna?")) return;
    const colunaRemovida = colunas.find((c) => c.id === colunaId);
    setColunas((atual) => atual.filter((c) => c.id !== colunaId));
    iniciarTransicao(() => {
      excluirColuna(colunaId, projetoId).catch((err) => {
        if (colunaRemovida) setColunas((atual) => [...atual, colunaRemovida]);
        toast.error(mensagemDeErro(err, "Falha ao excluir coluna."));
      });
    });
  }

  function fecharModal() {
    setTarefaAbertaId(null);
    router.refresh();
  }

  const tarefaAberta = tarefas.find((t) => t.id === tarefaAbertaId) ?? null;
  const colunasAbertas = colunas.filter((c) => !c.concluido);
  const colunaFixa = colunas.find((c) => c.concluido) ?? null;
  const tarefasConcluidas = colunaFixa ? tarefas.filter((t) => t.coluna_id === colunaFixa.id).length : 0;
  const percentualConcluido = tarefas.length > 0 ? Math.round((tarefasConcluidas / tarefas.length) * 100) : 0;

  function renderColuna(coluna: ColunaKanban, ehFixa: boolean) {
    const tarefasDaColuna = tarefas.filter((t) => t.coluna_id === coluna.id);

    return (
      <div
        key={coluna.id}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const colunaArrastada = e.dataTransfer.getData("text/coluna-id");
          if (colunaArrastada) {
            soltarColuna(coluna.id);
            return;
          }
          const tarefaId = e.dataTransfer.getData("text/tarefa-id");
          if (tarefaId) moverPara(tarefaId, coluna.id);
        }}
        className={`flex min-h-[16rem] w-64 shrink-0 flex-col gap-2.5 rounded-xl border border-gaiamum-border bg-gaiamum-surface p-3 transition ${
          colunaArrastadaId === coluna.id ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          {colunaEditandoId === coluna.id ? (
            <input
              name="nome"
              defaultValue={coluna.nome}
              autoFocus
              onBlur={(e) => renomearColunaOtimista(coluna.id, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setColunaEditandoId(null);
              }}
              className="w-full flex-1 rounded border border-gaiamum-primary bg-gaiamum-surface-raised px-2 py-0.5 text-sm text-gaiamum-text outline-none"
            />
          ) : (
            <h2
              draggable={!ehFixa}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/coluna-id", coluna.id);
                setColunaArrastadaId(coluna.id);
              }}
              onDragEnd={() => setColunaArrastadaId(null)}
              onClick={() => !ehFixa && setColunaEditandoId(coluna.id)}
              className={`text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted ${
                ehFixa ? "" : "cursor-grab hover:text-gaiamum-text active:cursor-grabbing"
              }`}
              title={ehFixa ? undefined : "Arraste pra reordenar, clique pra renomear"}
            >
              {coluna.nome} <span className="text-gaiamum-text">({tarefasDaColuna.length})</span>
            </h2>
          )}
          {!ehFixa && podeExcluirTarefa && colunaEditandoId !== coluna.id && (
            <button
              type="button"
              onClick={() => apagarColuna(coluna.id)}
              className="shrink-0 text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
              title="Excluir coluna"
            >
              ✕
            </button>
          )}
        </div>

        {tarefasDaColuna.map((tarefa) => {
          const membrosDaTarefa = tarefaMembrosIniciais.filter((m) => m.tarefa_id === tarefa.id);
          const souResponsavel = Boolean(
            usuarioAtualId && membrosDaTarefa.some((m) => m.user_id === usuarioAtualId),
          );

          return (
            <CartaoTarefa
              key={tarefa.id}
              tarefa={tarefa}
              coluna={coluna}
              projetoId={projetoId}
              checklistDaTarefa={checklistItensIniciais.filter((c) => c.tarefa_id === tarefa.id)}
              anexosDaTarefa={anexosIniciais.filter((a) => a.entidade_id === tarefa.id)}
              membrosDaTarefa={membrosDaTarefa}
              membrosDoTenant={membrosDoTenant}
              etiquetasDaTarefa={tarefaEtiquetasIniciais.filter((te) => te.tarefa_id === tarefa.id)}
              etiquetasDoTenant={etiquetasDoTenant}
              souResponsavel={souResponsavel}
              podeExcluir={podeExcluirTarefa}
              onAbrir={() => setTarefaAbertaId(tarefa.id)}
              onExcluir={() => excluir(tarefa.id)}
            />
          );
        })}

        <input
          name="titulo"
          placeholder="+ Adicionar cartão"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            criarCartaoOtimista(coluna.id, e.currentTarget.value);
            e.currentTarget.value = "";
          }}
          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-gaiamum-text-muted outline-none transition hover:border-gaiamum-border focus:border-gaiamum-primary focus:bg-gaiamum-surface-raised focus:text-gaiamum-text"
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {colunasAbertas.map((coluna) => renderColuna(coluna, false))}

        {criandoColuna ? (
          <div className="flex h-fit w-56 shrink-0 flex-col gap-2 rounded-xl border border-gaiamum-border bg-gaiamum-surface p-3">
            <input
              ref={inputNovaColunaRef}
              autoFocus
              placeholder="Nome da coluna"
              onKeyDown={(e) => {
                if (e.key === "Escape") setCriandoColuna(false);
                if (e.key === "Enter") {
                  criarColunaOtimista(e.currentTarget.value);
                }
              }}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => criarColunaOtimista(inputNovaColunaRef.current?.value ?? "")}
                className="rounded-lg bg-gaiamum-primary px-3 py-1 text-xs font-medium text-white transition hover:bg-gaiamum-primary-dark"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => setCriandoColuna(false)}
                className="text-xs text-gaiamum-text-muted hover:text-gaiamum-text"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCriandoColuna(true)}
            title="Nova coluna"
            className="h-9 w-9 shrink-0 self-start rounded-xl border border-dashed border-gaiamum-border text-lg leading-none text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-primary"
          >
            +
          </button>
        )}

        {colunaFixa && renderColuna(colunaFixa, true)}
      </div>

      {tarefas.length > 0 && (
        <div className="mt-6 max-w-md">
          <BarraProgresso percentual={percentualConcluido} rotulo={`Cartões concluídos (${tarefasConcluidas}/${tarefas.length})`} />
        </div>
      )}

      {tarefaAberta && (
        <DetalheTarefa
          tarefa={tarefaAberta}
          projetoId={projetoId}
          colunasDoProjeto={colunas}
          membrosDoTenant={membrosDoTenant}
          membrosDaTarefa={tarefaMembrosIniciais
            .filter((m) => m.tarefa_id === tarefaAberta.id)
            .map((m) => m.user_id)}
          checklist={checklistItensIniciais.filter((c) => c.tarefa_id === tarefaAberta.id)}
          etiquetasDoTenant={etiquetasDoTenant}
          etiquetasDaTarefa={tarefaEtiquetasIniciais
            .filter((te) => te.tarefa_id === tarefaAberta.id)
            .map((te) => te.etiqueta_id)}
          anexos={anexosIniciais.filter((a) => a.entidade_id === tarefaAberta.id)}
          antecedenciaAlarme={alarmePorTarefa[tarefaAberta.id] ?? null}
          aoFechar={fecharModal}
        />
      )}
    </>
  );
}
