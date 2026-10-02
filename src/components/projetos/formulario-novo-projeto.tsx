"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { criarProjeto } from "@/lib/ecc/actions";
import { criarProjetoComPlanejamentoIA, gerarSugestoesProjetoIA } from "@/lib/ecc/planejamento-ia-actions";
import {
  contarSelecionadas,
  limparSelecao,
  novaSugestaoManual,
  prepararPreviaParaSelecao,
  selecionarEssenciais,
  selecionarTodas,
  type SugestaoNaPrevia,
} from "@/lib/ecc/planejamento-ia";
import { gerarIdCliente } from "@/lib/ecc/kanban";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { GravadorVozAgenda } from "@/components/agenda/gravador-voz-agenda";

type Passo = "inicial" | "contexto" | "esclarecimento" | "previa";

const ESTILO_BOTAO_SECUNDARIO =
  "rounded-lg border border-gaiamum-border px-4 py-2 text-sm font-medium text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text";
const ESTILO_BOTAO_PRIMARIO =
  "rounded-lg bg-gaiamum-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60";
const ESTILO_INPUT =
  "w-full rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary";

function estadoInicial() {
  return {
    aberto: false,
    passo: "inicial" as Passo,
    nome: "",
    descricao: "",
    contexto: "",
    perguntas: [] as string[],
    respostas: [] as string[],
    previa: [] as SugestaoNaPrevia[],
    expandidas: new Set<string>(),
    erro: null as string | null,
    idempotencyKey: gerarIdCliente(),
  };
}

/**
 * Criação de projeto — substitui o formulário inline simples por um modal
 * com dois caminhos: "Criar por conta própria" (igual a sempre, sem nenhuma
 * chamada de IA) ou "Planejar com IA" (descrever o objetivo por texto/voz →
 * revisar/selecionar sugestões → confirmar). Pedido do Fabio, handoff
 * canônico checkpoint #62.
 *
 * Todo o estado do assistente fica aqui (um único componente) de propósito:
 * o fluxo inteiro é transitório e descartável até a confirmação — não há
 * necessidade de Context/estado global, e manter tudo junto deixa óbvio que
 * "navegar entre etapas preserva as escolhas" (é só não desmontar nada).
 */
export function FormularioNovoProjeto() {
  const [estado, setEstado] = useState(estadoInicial);
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function abrir() {
    setEstado(estadoInicial());
    setEstado((atual) => ({ ...atual, aberto: true }));
  }

  function fechar() {
    setEstado(estadoInicial());
  }

  function voltar(passoAnterior: Passo) {
    setEstado((atual) => ({ ...atual, passo: passoAnterior, erro: null }));
  }

  function criarPorContaPropria() {
    if (!estado.nome.trim()) {
      setEstado((atual) => ({ ...atual, erro: "Informe o nome do projeto." }));
      return;
    }
    iniciarTransicao(async () => {
      try {
        const formData = new FormData();
        formData.set("nome", estado.nome);
        formData.set("descricao", estado.descricao);
        const resultado = await criarProjeto(formData);
        toast.success("Projeto criado.");
        fechar();
        router.push(`/projetos/${resultado.id}/tarefas`);
      } catch (erro) {
        setEstado((atual) => ({ ...atual, erro: mensagemDeErro(erro, "Falha ao criar projeto.") }));
      }
    });
  }

  function irParaContexto() {
    if (!estado.nome.trim()) {
      setEstado((atual) => ({ ...atual, erro: "Informe o nome do projeto." }));
      return;
    }
    setEstado((atual) => ({ ...atual, passo: "contexto", erro: null }));
  }

  function gerarSugestoes(respostasEsclarecimento?: { pergunta: string; resposta: string }[]) {
    if (!estado.contexto.trim()) {
      setEstado((atual) => ({ ...atual, erro: "Conte um pouco sobre o que você quer realizar." }));
      return;
    }
    setEstado((atual) => ({ ...atual, erro: null }));
    iniciarTransicao(async () => {
      const resultado = await gerarSugestoesProjetoIA(estado.contexto, respostasEsclarecimento);
      if (resultado.status === "erro") {
        setEstado((atual) => ({ ...atual, erro: resultado.mensagem }));
      } else if (resultado.status === "precisa_esclarecimento") {
        setEstado((atual) => ({
          ...atual,
          passo: "esclarecimento",
          perguntas: resultado.perguntas,
          respostas: resultado.perguntas.map(() => ""),
        }));
      } else {
        setEstado((atual) => ({ ...atual, passo: "previa", previa: prepararPreviaParaSelecao(resultado.sugestoes) }));
      }
    });
  }

  function enviarEsclarecimento() {
    const respostasEsclarecimento = estado.perguntas.map((pergunta, indice) => ({
      pergunta,
      resposta: estado.respostas[indice]?.trim() || "(não respondido)",
    }));
    gerarSugestoes(respostasEsclarecimento);
  }

  function regenerar() {
    if (!window.confirm("Gerar sugestões de novo substitui a prévia atual (suas seleções e edições se perdem). Continuar?")) return;
    gerarSugestoes();
  }

  function atualizarSugestao(idTemp: string, patch: Partial<SugestaoNaPrevia>) {
    setEstado((atual) => ({ ...atual, previa: atual.previa.map((s) => (s.idTemp === idTemp ? { ...s, ...patch } : s)) }));
  }

  function alternarExpandida(idTemp: string) {
    setEstado((atual) => {
      const expandidas = new Set(atual.expandidas);
      if (expandidas.has(idTemp)) expandidas.delete(idTemp);
      else expandidas.add(idTemp);
      return { ...atual, expandidas };
    });
  }

  function removerItemChecklist(idTemp: string, indice: number) {
    setEstado((atual) => ({
      ...atual,
      previa: atual.previa.map((s) => (s.idTemp === idTemp ? { ...s, checklist: s.checklist.filter((_, i) => i !== indice) } : s)),
    }));
  }

  function adicionarItemChecklist(idTemp: string, texto: string) {
    if (!texto.trim()) return;
    setEstado((atual) => ({
      ...atual,
      previa: atual.previa.map((s) => (s.idTemp === idTemp ? { ...s, checklist: [...s.checklist, texto.trim()] } : s)),
    }));
  }

  function adicionarTarefaManual() {
    const nova = novaSugestaoManual();
    setEstado((atual) => ({
      ...atual,
      previa: [...atual.previa, nova],
      expandidas: new Set(atual.expandidas).add(nova.idTemp),
    }));
  }

  function removerSugestao(idTemp: string) {
    setEstado((atual) => ({ ...atual, previa: atual.previa.filter((s) => s.idTemp !== idTemp) }));
  }

  function confirmar() {
    const selecionadas = estado.previa.filter((s) => s.selecionada);
    if (selecionadas.some((s) => !s.titulo.trim())) {
      setEstado((atual) => ({ ...atual, erro: "Toda tarefa selecionada precisa de um título." }));
      return;
    }
    setEstado((atual) => ({ ...atual, erro: null }));
    iniciarTransicao(async () => {
      const resultado = await criarProjetoComPlanejamentoIA({
        nome: estado.nome,
        descricao: estado.descricao,
        idempotencyKey: estado.idempotencyKey,
        tarefas: selecionadas.map((s) => ({ titulo: s.titulo, descricao: s.descricao, checklist: s.checklist })),
      });
      if (resultado.status === "erro") {
        // Prévia preservada de propósito — não reseta `estado` aqui, só
        // mostra o erro; a pessoa pode tentar confirmar de novo sem perder
        // nada do que já revisou/editou.
        setEstado((atual) => ({ ...atual, erro: resultado.mensagem }));
        return;
      }
      toast.success(selecionadas.length > 0 ? `Projeto criado com ${selecionadas.length} tarefa(s).` : "Projeto criado.");
      fechar();
      router.push(`/projetos/${resultado.projetoId}/tarefas`);
    });
  }

  const totalSelecionadas = contarSelecionadas(estado.previa);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="rounded-2xl border border-dashed border-gaiamum-border bg-gaiamum-surface px-5 py-4 text-left text-sm font-medium text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-primary"
      >
        + Novo projeto
      </button>

      {estado.aberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          onClick={fechar}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-gaiamum-border bg-gaiamum-surface p-5 sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gaiamum-text">Novo projeto</h2>
              <button type="button" onClick={fechar} className="text-gaiamum-text-muted hover:text-gaiamum-text">
                ✕
              </button>
            </div>

            {estado.erro && <p className="mb-3 text-sm text-gaiamum-danger">{estado.erro}</p>}

            {estado.passo === "inicial" && (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
                  Nome do projeto
                  <input
                    autoFocus
                    value={estado.nome}
                    onChange={(e) => setEstado((atual) => ({ ...atual, nome: e.target.value }))}
                    className={ESTILO_INPUT}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
                  Descrição (opcional)
                  <input
                    value={estado.descricao}
                    onChange={(e) => setEstado((atual) => ({ ...atual, descricao: e.target.value }))}
                    className={ESTILO_INPUT}
                  />
                </label>

                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm font-medium text-gaiamum-text">Quer ajuda para planejar este projeto?</p>
                  <button type="button" onClick={irParaContexto} disabled={pendente} className={ESTILO_BOTAO_PRIMARIO}>
                    ✨ Planejar com IA
                  </button>
                  <button type="button" onClick={criarPorContaPropria} disabled={pendente} className={ESTILO_BOTAO_SECUNDARIO}>
                    {pendente ? "Criando..." : "Criar por conta própria"}
                  </button>
                </div>
              </div>
            )}

            {estado.passo === "contexto" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gaiamum-text-muted">
                  Conte o que você quer realizar. Se souber, inclua prazo, orçamento, quantidade de pessoas e quem vai ajudar.
                </p>
                <textarea
                  autoFocus
                  rows={5}
                  value={estado.contexto}
                  onChange={(e) => setEstado((atual) => ({ ...atual, contexto: e.target.value }))}
                  placeholder="Ex: Quero organizar o aniversário de oito anos do meu filho para 30 pessoas. Vou organizar sozinho, quero fazer em um salão e tenho orçamento de R$ 3.000."
                  className={ESTILO_INPUT}
                />
                <GravadorVozAgenda onTranscricaoFinal={(texto) => setEstado((atual) => ({ ...atual, contexto: texto }))} />
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" onClick={() => voltar("inicial")} className={ESTILO_BOTAO_SECUNDARIO}>
                    ← Voltar
                  </button>
                  <button type="button" onClick={() => gerarSugestoes()} disabled={pendente} className={ESTILO_BOTAO_PRIMARIO}>
                    {pendente ? "Gerando..." : "Gerar sugestões"}
                  </button>
                </div>
              </div>
            )}

            {estado.passo === "esclarecimento" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gaiamum-text-muted">Só mais um detalhe antes de sugerir as tarefas:</p>
                {estado.perguntas.map((pergunta, indice) => (
                  <label key={indice} className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
                    {pergunta}
                    <input
                      value={estado.respostas[indice] ?? ""}
                      onChange={(e) =>
                        setEstado((atual) => ({
                          ...atual,
                          respostas: atual.respostas.map((r, i) => (i === indice ? e.target.value : r)),
                        }))
                      }
                      className={ESTILO_INPUT}
                    />
                  </label>
                ))}
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" onClick={() => voltar("contexto")} className={ESTILO_BOTAO_SECUNDARIO}>
                    ← Voltar
                  </button>
                  <button type="button" onClick={enviarEsclarecimento} disabled={pendente} className={ESTILO_BOTAO_PRIMARIO}>
                    {pendente ? "Gerando..." : "Gerar sugestões"}
                  </button>
                </div>
              </div>
            )}

            {estado.passo === "previa" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-gaiamum-text">Escolha o que faz sentido para seu projeto.</p>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEstado((a) => ({ ...a, previa: selecionarEssenciais(a.previa) }))} className={ESTILO_BOTAO_SECUNDARIO}>
                    Selecionar essenciais
                  </button>
                  <button type="button" onClick={() => setEstado((a) => ({ ...a, previa: selecionarTodas(a.previa) }))} className={ESTILO_BOTAO_SECUNDARIO}>
                    Selecionar todas
                  </button>
                  <button type="button" onClick={() => setEstado((a) => ({ ...a, previa: limparSelecao(a.previa) }))} className={ESTILO_BOTAO_SECUNDARIO}>
                    Limpar seleção
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {estado.previa.map((sugestao) => (
                    <div key={sugestao.idTemp} className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised p-3">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={sugestao.selecionada}
                          onChange={(e) => atualizarSugestao(sugestao.idTemp, { selecionada: e.target.checked })}
                          className="mt-1.5 h-5 w-5 shrink-0 accent-gaiamum-primary"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              value={sugestao.titulo}
                              onChange={(e) => atualizarSugestao(sugestao.idTemp, { titulo: e.target.value })}
                              placeholder="Título da tarefa"
                              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-gaiamum-text outline-none focus:border-gaiamum-primary"
                            />
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                sugestao.recomendacao === "essencial"
                                  ? "bg-gaiamum-primary/15 text-gaiamum-primary"
                                  : "bg-gaiamum-border/50 text-gaiamum-text-muted"
                              }`}
                            >
                              {sugestao.recomendacao === "essencial" ? "Essencial" : "Opcional"}
                            </span>
                          </div>
                          <textarea
                            value={sugestao.descricao}
                            onChange={(e) => atualizarSugestao(sugestao.idTemp, { descricao: e.target.value })}
                            placeholder="Descrição curta (opcional)"
                            rows={1}
                            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gaiamum-text-muted outline-none focus:border-gaiamum-primary"
                          />

                          <button
                            type="button"
                            onClick={() => alternarExpandida(sugestao.idTemp)}
                            className="self-start text-xs text-gaiamum-text-muted underline hover:text-gaiamum-text"
                          >
                            {estado.expandidas.has(sugestao.idTemp)
                              ? "Ocultar checklist"
                              : sugestao.checklist.length > 0
                                ? `Ver checklist (${sugestao.checklist.length})`
                                : "+ Adicionar checklist"}
                          </button>

                          {estado.expandidas.has(sugestao.idTemp) && (
                            <div className="flex flex-col gap-1 rounded border border-dashed border-gaiamum-border p-2">
                              {sugestao.checklist.map((item, indice) => (
                                <div key={indice} className="flex items-center gap-2">
                                  <span className="text-xs text-gaiamum-text-muted">☐</span>
                                  <span className="flex-1 text-xs text-gaiamum-text">{item}</span>
                                  <button
                                    type="button"
                                    onClick={() => removerItemChecklist(sugestao.idTemp, indice)}
                                    className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <input
                                placeholder="+ Adicionar passo"
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  adicionarItemChecklist(sugestao.idTemp, e.currentTarget.value);
                                  e.currentTarget.value = "";
                                }}
                                className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gaiamum-text outline-none focus:border-gaiamum-primary"
                              />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removerSugestao(sugestao.idTemp)}
                          title="Remover sugestão"
                          className="shrink-0 text-gaiamum-text-muted hover:text-gaiamum-danger"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={adicionarTarefaManual} className={`self-start ${ESTILO_BOTAO_SECUNDARIO}`}>
                  + Adicionar tarefa manualmente
                </button>

                <p className="text-sm text-gaiamum-text-muted">Você selecionou {totalSelecionadas} tarefa(s).</p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button type="button" onClick={() => voltar("contexto")} className={ESTILO_BOTAO_SECUNDARIO}>
                    ← Voltar
                  </button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={regenerar} disabled={pendente} className={ESTILO_BOTAO_SECUNDARIO}>
                      Regenerar
                    </button>
                    <button type="button" onClick={confirmar} disabled={pendente} className={ESTILO_BOTAO_PRIMARIO}>
                      {pendente
                        ? "Criando..."
                        : totalSelecionadas > 0
                          ? `Criar projeto com as tarefas selecionadas (${totalSelecionadas})`
                          : "Criar projeto sem tarefas"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
