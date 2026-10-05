"use client";

import { useState, useTransition, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { criarProjeto } from "@/lib/ecc/actions";
import { criarProjetoComPlanejamentoIA, gerarSugestoesProjetoIA } from "@/lib/ecc/planejamento-ia-actions";
import { contarSelecionadas, prepararPreviaParaSelecao, type SugestaoNaPrevia, type SugestaoTarefaIA } from "@/lib/ecc/planejamento-ia";
import { gerarIdCliente } from "@/lib/ecc/kanban";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { GravadorVozAgenda } from "@/components/agenda/gravador-voz-agenda";
import { PreviaPlanejamento } from "@/components/projetos/previa-planejamento";
import { PassoPromptCopiavel } from "@/components/projetos/passo-prompt-copiavel";

/** `prompt` = "Planejar na sua IA" (prompt copiável, caminho principal da
 * IA, custo zero); `contexto`/`esclarecimento` = IA do Gaiamum (Gemini),
 * caminho secundário. Os dois terminam na mesma `previa`. */
type Passo = "inicial" | "prompt" | "contexto" | "esclarecimento" | "previa";

const CHAVE_RASCUNHO_PROMPT = "gaiamum-rascunho-plano:novo-projeto";

const ESTILO_BOTAO_SECUNDARIO =
  "rounded-lg border border-gaiamum-border px-4 py-2 text-sm font-medium text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text";
const ESTILO_BOTAO_PRIMARIO =
  "rounded-lg bg-gaiamum-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60";
const ESTILO_INPUT =
  "w-full rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary";

/** Saída sempre visível em toda etapa da IA: cria o projeto só com nome e
 * descrição, sem tarefas sugeridas — também é a saída quando a IA falha. */
function BotaoPularIA({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="self-center text-sm text-gaiamum-text-muted underline underline-offset-2 hover:text-gaiamum-text disabled:opacity-60"
    >
      Pular a IA e criar o projeto agora
    </button>
  );
}

function estadoInicial() {
  return {
    aberto: false,
    passo: "inicial" as Passo,
    /** De onde veio a prévia — o "Voltar" da prévia volta pro caminho certo. */
    origemPrevia: "prompt" as "prompt" | "contexto",
    nome: "",
    descricao: "",
    contexto: "",
    perguntas: [] as string[],
    respostas: [] as string[],
    previa: [] as SugestaoNaPrevia[],
    /** A IA do Gaiamum falhou — oferece o prompt copiável como saída. */
    iaInternaFalhou: false,
    erro: null as string | null,
    idempotencyKey: gerarIdCliente(),
  };
}

/**
 * Criação de projeto: "Criar projeto" direto é o caminho principal (IA nunca
 * é obrigatória — pedido do Fabio, 2026-10-05). Planejar com IA é opcional e
 * tem 2 caminhos: "Na sua IA" (prompt copiável, Fase 1 da frente de 05/10) e
 * "IA do Gaiamum" (Gemini, secundário). Todo estado fica aqui — o fluxo é
 * descartável até a confirmação.
 */
export function FormularioNovoProjeto() {
  const [estado, setEstado] = useState(estadoInicial);
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function abrir() {
    setEstado({ ...estadoInicial(), aberto: true });
  }

  function fechar() {
    setEstado(estadoInicial());
  }

  function irPara(passo: Passo) {
    setEstado((atual) => ({ ...atual, passo, erro: null }));
  }

  function setPrevia(acao: SetStateAction<SugestaoNaPrevia[]>) {
    setEstado((atual) => ({ ...atual, previa: typeof acao === "function" ? acao(atual.previa) : acao }));
  }

  function exigirNome(): boolean {
    if (estado.nome.trim()) return true;
    setEstado((atual) => ({ ...atual, erro: "Informe o nome do projeto." }));
    return false;
  }

  function criarPorContaPropria() {
    if (!exigirNome()) return;
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

  function receberPlanoColado(sugestoes: SugestaoTarefaIA[], descartados: number) {
    if (descartados > 0) toast.message(`${descartados} item(ns) do plano ficaram de fora (sem título ou acima do limite de 30).`);
    setEstado((atual) => ({ ...atual, passo: "previa", origemPrevia: "prompt", previa: prepararPreviaParaSelecao(sugestoes), erro: null }));
  }

  function gerarSugestoes(respostasEsclarecimento?: { pergunta: string; resposta: string }[]) {
    if (!estado.contexto.trim()) {
      setEstado((atual) => ({ ...atual, erro: "Conte um pouco sobre o que você quer realizar." }));
      return;
    }
    setEstado((atual) => ({ ...atual, erro: null, iaInternaFalhou: false }));
    iniciarTransicao(async () => {
      let resultado: Awaited<ReturnType<typeof gerarSugestoesProjetoIA>>;
      try {
        resultado = await gerarSugestoesProjetoIA(estado.contexto, respostasEsclarecimento);
      } catch {
        // Falha inesperada (rede, timeout da função) — nunca um beco sem
        // saída: dá pra usar a própria IA ou pular a IA.
        resultado = { status: "erro", mensagem: "A IA do Gaiamum não respondeu agora." };
      }
      if (resultado.status === "erro") {
        setEstado((atual) => ({ ...atual, erro: resultado.mensagem, iaInternaFalhou: true }));
      } else if (resultado.status === "precisa_esclarecimento") {
        setEstado((atual) => ({
          ...atual,
          passo: "esclarecimento",
          perguntas: resultado.perguntas,
          respostas: resultado.perguntas.map(() => ""),
        }));
      } else {
        setEstado((atual) => ({ ...atual, passo: "previa", origemPrevia: "contexto", previa: prepararPreviaParaSelecao(resultado.sugestoes) }));
      }
    });
  }

  function enviarEsclarecimento() {
    gerarSugestoes(
      estado.perguntas.map((pergunta, indice) => ({ pergunta, resposta: estado.respostas[indice]?.trim() || "(não respondido)" })),
    );
  }

  function regenerar() {
    if (!window.confirm("Gerar sugestões de novo substitui a prévia atual (suas seleções e edições se perdem). Continuar?")) return;
    gerarSugestoes();
  }

  function confirmar() {
    const selecionadas = estado.previa.filter((s) => s.selecionada);
    if (selecionadas.some((s) => !s.titulo.trim())) {
      setEstado((atual) => ({ ...atual, erro: "Todo item selecionado precisa de um título." }));
      return;
    }
    setEstado((atual) => ({ ...atual, erro: null }));
    iniciarTransicao(async () => {
      const resultado = await criarProjetoComPlanejamentoIA({
        nome: estado.nome,
        descricao: estado.descricao,
        idempotencyKey: estado.idempotencyKey,
        tarefas: selecionadas.map((s) => ({ titulo: s.titulo, descricao: s.descricao, checklist: s.checklist, marco: s.marco })),
      });
      if (resultado.status === "erro") {
        // Prévia preservada de propósito — só mostra o erro.
        setEstado((atual) => ({ ...atual, erro: resultado.mensagem }));
        return;
      }
      toast.success(selecionadas.length > 0 ? `Projeto criado com ${selecionadas.length} item(ns).` : "Projeto criado.");
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

            {estado.erro && (
              <div className="mb-3 flex flex-col gap-2">
                <p className="text-sm text-gaiamum-danger">{estado.erro}</p>
                {estado.iaInternaFalhou && (
                  <button
                    type="button"
                    onClick={() => setEstado((atual) => ({ ...atual, passo: "prompt", erro: null, iaInternaFalhou: false }))}
                    className={`self-start ${ESTILO_BOTAO_SECUNDARIO}`}
                  >
                    📋 Planejar na sua IA em vez disso
                  </button>
                )}
              </div>
            )}

            {estado.passo === "inicial" && (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
                  Nome do projeto
                  <input
                    autoFocus
                    value={estado.nome}
                    onChange={(e) => setEstado((atual) => ({ ...atual, nome: e.target.value }))}
                    onKeyDown={(e) => {
                      // Enter cria direto, sem IA — o caminho mais rápido.
                      if (e.key === "Enter") {
                        e.preventDefault();
                        criarPorContaPropria();
                      }
                    }}
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
                  <button type="button" onClick={criarPorContaPropria} disabled={pendente} className={ESTILO_BOTAO_PRIMARIO}>
                    {pendente ? "Criando..." : "Criar projeto"}
                  </button>
                  <p className="mt-2 text-xs text-gaiamum-text-muted">Opcional: quer ajuda da IA pra planejar as tarefas?</p>
                  <button
                    type="button"
                    onClick={() => exigirNome() && irPara("prompt")}
                    disabled={pendente}
                    className={`${ESTILO_BOTAO_SECUNDARIO} text-left`}
                  >
                    📋 Planejar na sua IA <span className="text-xs font-normal">· ChatGPT, Gemini, Claude… com conversa de verdade</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exigirNome() && irPara("contexto")}
                    disabled={pendente}
                    className={`${ESTILO_BOTAO_SECUNDARIO} text-left`}
                  >
                    ✨ IA do Gaiamum <span className="text-xs font-normal">· rápido, sem sair daqui</span>
                  </button>
                </div>
              </div>
            )}

            {estado.passo === "prompt" && (
              <PassoPromptCopiavel
                nomeProjeto={estado.nome}
                objetivoInicial={estado.contexto || estado.descricao}
                chaveRascunho={CHAVE_RASCUNHO_PROMPT}
                aoLerPlano={receberPlanoColado}
                rodape={
                  <div className="flex flex-col gap-3">
                    <button type="button" onClick={() => irPara("inicial")} className={`self-start ${ESTILO_BOTAO_SECUNDARIO}`}>
                      ← Voltar
                    </button>
                    <BotaoPularIA onClick={criarPorContaPropria} disabled={pendente} />
                  </div>
                }
              />
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
                  <button type="button" onClick={() => irPara("inicial")} className={ESTILO_BOTAO_SECUNDARIO}>
                    ← Voltar
                  </button>
                  <button type="button" onClick={() => gerarSugestoes()} disabled={pendente} className={ESTILO_BOTAO_PRIMARIO}>
                    {pendente ? "Gerando..." : "Gerar sugestões"}
                  </button>
                </div>
                <BotaoPularIA onClick={criarPorContaPropria} disabled={pendente} />
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
                  <button type="button" onClick={() => irPara("contexto")} className={ESTILO_BOTAO_SECUNDARIO}>
                    ← Voltar
                  </button>
                  <button type="button" onClick={enviarEsclarecimento} disabled={pendente} className={ESTILO_BOTAO_PRIMARIO}>
                    {pendente ? "Gerando..." : "Gerar sugestões"}
                  </button>
                </div>
                <BotaoPularIA onClick={criarPorContaPropria} disabled={pendente} />
              </div>
            )}

            {estado.passo === "previa" && (
              <div className="flex flex-col gap-3">
                <PreviaPlanejamento previa={estado.previa} setPrevia={setPrevia} />

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button type="button" onClick={() => irPara(estado.origemPrevia)} className={ESTILO_BOTAO_SECUNDARIO}>
                    ← Voltar
                  </button>
                  <div className="flex items-center gap-2">
                    {estado.origemPrevia === "contexto" && (
                      <button type="button" onClick={regenerar} disabled={pendente} className={ESTILO_BOTAO_SECUNDARIO}>
                        Regenerar
                      </button>
                    )}
                    <button type="button" onClick={confirmar} disabled={pendente} className={ESTILO_BOTAO_PRIMARIO}>
                      {pendente
                        ? "Criando..."
                        : totalSelecionadas > 0
                          ? `Criar projeto com os itens selecionados (${totalSelecionadas})`
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
