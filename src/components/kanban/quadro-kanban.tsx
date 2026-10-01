"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { Anexo, ChecklistItem, ColunaKanban, Etiqueta, MembroTenant, Tarefa, TarefaEtiqueta, TarefaMembro, Turno } from "@/lib/ecc/tipos";
import { calcularNovaOrdem, calcularVelocidadeAutoScroll, encontrarColunaEmFoco, tocarSomConcluido } from "@/lib/ecc/kanban";
import {
  alternarDivisaoEmTurnos,
  criarColuna,
  criarTarefa,
  deletarTarefa,
  excluirColuna,
  moverTarefa,
  renomearColuna,
  reordenarColunas,
} from "@/lib/ecc/actions";

const TURNOS: { valor: Turno; rotulo: string }[] = [
  { valor: "manha", rotulo: "🌅 Manhã" },
  { valor: "tarde", rotulo: "🌤️ Tarde" },
  { valor: "noite", rotulo: "🌙 Noite" },
];
import { DetalheTarefa } from "@/components/kanban/detalhe-tarefa";
import { CartaoTarefa } from "@/components/kanban/cartao-tarefa";
import { BarraProgresso } from "@/components/ui/barra-progresso";

// Zonas de auto-scroll durante um arrasto de cartão por TOQUE — pedido do
// Fabio (2026-09-30): "rolagem automática perto do topo/rodapé" e "alcançar
// outras colunas durante o arrasto por navegação nas bordas". Constantes
// isoladas aqui pra ficar fácil recalibrar sem caçar números mágicos no meio
// da lógica — a velocidade em si é calculada por `calcularVelocidadeAutoScroll`
// (função pura, testada em kanban.test.ts).
const ZONA_AUTO_SCROLL_VERTICAL_PX = 90;
const VELOCIDADE_MAX_VERTICAL_PX = 16;
const ZONA_AUTO_SCROLL_HORIZONTAL_PX = 56;
const VELOCIDADE_MAX_HORIZONTAL_PX = 10;

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
  souOwner,
  tarefasComContaGerada,
  colunaCompromissos,
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
  souOwner: boolean;
  tarefasComContaGerada: string[];
  /** Coluna fixa à esquerda (compromissos do dia) — montada no servidor. */
  colunaCompromissos?: ReactNode;
}) {
  const [tarefas, setTarefas] = useState(tarefasIniciais);
  const [tarefasIniciaisAnteriores, setTarefasIniciaisAnteriores] = useState(tarefasIniciais);
  const [colunas, setColunas] = useState(colunasIniciais);
  const [colunasIniciaisAnteriores, setColunasIniciaisAnteriores] = useState(colunasIniciais);
  const [tarefaAbertaId, setTarefaAbertaId] = useState<string | null>(null);
  const [colunaEditandoId, setColunaEditandoId] = useState<string | null>(null);
  const [colunaArrastadaId, setColunaArrastadaId] = useState<string | null>(null);
  const [criandoColuna, setCriandoColuna] = useState(false);
  // Arrasto de cartão por toque (celular/tablet) — implementação paralela ao
  // `draggable` nativo acima, que só reage a mouse. Ver comentário em
  // CartaoTarefa.tsx pra detalhe da técnica (alça dedicada ou segurar
  // ~300ms confirmam arrasto). `x`/`y` seguem o dedo pro "fantasma" abaixo;
  // a coluna-alvo e o cartão-alvo (pra reordenar na posição exata, não só
  // "cair no fim da coluna") são recalculados a cada movimento via
  // `elementFromPoint`.
  const [arrastoToque, setArrastoToque] = useState<{ tarefaId: string; titulo: string; x: number; y: number } | null>(null);
  const [colunaAlvoToqueId, setColunaAlvoToqueId] = useState<string | null>(null);
  const [alvoCartaoToque, setAlvoCartaoToque] = useState<{ tarefaId: string; posicao: "antes" | "depois" } | null>(null);
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();
  const inputNovaColunaRef = useRef<HTMLInputElement>(null);

  // Layout mobile (celular em pé/deitado) — uma coluna por vez, com
  // scroll-snap horizontal. Ver seção 3 do prompt de consolidação
  // (2026-09-30): cabeçalho com nome/contagem/posição, seletor de coluna
  // como alternativa ao gesto, "Visão geral" em retrato e paisagem.
  const quadroRef = useRef<HTMLDivElement>(null);
  const [colunaFocoId, setColunaFocoId] = useState<string | null>(colunasIniciais.find((c) => !c.concluido)?.id ?? null);
  const [visaoGeralAberta, setVisaoGeralAberta] = useState(false);
  // Posição de rolagem do quadro antes de abrir o modal de detalhe — pra
  // fechar "voltar pra mesma coluna/posição", pedido explícito do Fabio.
  const [posicaoAntesDoModal, setPosicaoAntesDoModal] = useState<{ left: number; top: number } | null>(null);

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

  // Solto na área vazia da coluna (não em cima de um cartão específico) —
  // vai pro fim dela (ou início, via "Mover para..." / extremidade
  // explícita). `soltarSobreCartao` abaixo cobre o caso de reordenar em
  // cima de um cartão específico (inclusive dentro da mesma coluna).
  function moverPara(tarefaId: string, novaColunaId: string, novoTurno: Turno | null = null, extremidade: "inicio" | "fim" = "fim") {
    if (colunasIniciais.find((c) => c.id === novaColunaId)?.concluido) {
      tocarSomConcluido();
    }
    const tarefaAtual = tarefas.find((t) => t.id === tarefaId);
    const colunaAnterior = tarefaAtual?.coluna_id;
    const ordemAnterior = tarefaAtual?.ordem;
    const turnoAnterior = tarefaAtual?.turno ?? null;
    const ordensDaColunaAlvo = tarefas
      .filter((t) => t.coluna_id === novaColunaId && t.turno === novoTurno && t.id !== tarefaId)
      .map((t) => t.ordem);
    const minOrdem = ordensDaColunaAlvo.length > 0 ? Math.min(...ordensDaColunaAlvo) : null;
    const maxOrdem = ordensDaColunaAlvo.length > 0 ? Math.max(...ordensDaColunaAlvo) : null;
    const novaOrdem = extremidade === "inicio" ? calcularNovaOrdem(null, minOrdem) : calcularNovaOrdem(maxOrdem, null);

    setTarefas((atual) =>
      atual.map((t) => (t.id === tarefaId ? { ...t, coluna_id: novaColunaId, ordem: novaOrdem, turno: novoTurno } : t)),
    );
    iniciarTransicao(() => {
      moverTarefa(tarefaId, projetoId, novaColunaId, novaOrdem, novoTurno).catch((err) => {
        if (colunaAnterior) {
          setTarefas((atual) =>
            atual.map((t) =>
              t.id === tarefaId
                ? { ...t, coluna_id: colunaAnterior, ordem: ordemAnterior ?? t.ordem, turno: turnoAnterior }
                : t,
            ),
          );
        }
        toast.error(mensagemDeErro(err, "Falha ao mover cartão."));
      });
    });
  }

  /** Solto em cima de um cartão específico (`tarefaAlvoId`) — reordena pra
   * ficar exatamente antes/depois dele, dentro da coluna desse cartão-alvo
   * (que pode ser a mesma coluna de origem ou outra). */
  function soltarSobreCartao(tarefaArrastadaId: string, tarefaAlvoId: string, posicao: "antes" | "depois") {
    if (tarefaArrastadaId === tarefaAlvoId) return;
    const tarefaAlvo = tarefas.find((t) => t.id === tarefaAlvoId);
    if (!tarefaAlvo) return;
    const turnoAlvo = tarefaAlvo.turno ?? null;

    if (colunasIniciais.find((c) => c.id === tarefaAlvo.coluna_id)?.concluido) {
      tocarSomConcluido();
    }

    const ordenadasDaColunaAlvo = tarefas
      .filter((t) => t.coluna_id === tarefaAlvo.coluna_id && t.turno === turnoAlvo && t.id !== tarefaArrastadaId)
      .sort((a, b) => a.ordem - b.ordem);
    const indiceAlvo = ordenadasDaColunaAlvo.findIndex((t) => t.id === tarefaAlvoId);
    if (indiceAlvo === -1) return;

    const [ordemAntes, ordemDepois] =
      posicao === "antes"
        ? [ordenadasDaColunaAlvo[indiceAlvo - 1]?.ordem ?? null, ordenadasDaColunaAlvo[indiceAlvo].ordem]
        : [ordenadasDaColunaAlvo[indiceAlvo].ordem, ordenadasDaColunaAlvo[indiceAlvo + 1]?.ordem ?? null];
    const novaOrdem = calcularNovaOrdem(ordemAntes, ordemDepois);

    const tarefaArrastada = tarefas.find((t) => t.id === tarefaArrastadaId);
    const colunaAnterior = tarefaArrastada?.coluna_id;
    const ordemAnterior = tarefaArrastada?.ordem;
    const turnoAnterior = tarefaArrastada?.turno ?? null;

    setTarefas((atual) =>
      atual.map((t) =>
        t.id === tarefaArrastadaId ? { ...t, coluna_id: tarefaAlvo.coluna_id, ordem: novaOrdem, turno: turnoAlvo } : t,
      ),
    );
    iniciarTransicao(() => {
      moverTarefa(tarefaArrastadaId, projetoId, tarefaAlvo.coluna_id, novaOrdem, turnoAlvo).catch((err) => {
        if (colunaAnterior) {
          setTarefas((atual) =>
            atual.map((t) =>
              t.id === tarefaArrastadaId
                ? { ...t, coluna_id: colunaAnterior, ordem: ordemAnterior ?? t.ordem, turno: turnoAnterior }
                : t,
            ),
          );
        }
        toast.error(mensagemDeErro(err, "Falha ao reordenar cartão."));
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
  function criarCartaoOtimista(colunaId: string, tituloBruto: string, turno: Turno | null = null) {
    const titulos = tituloBruto
      .split("\n")
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0);
    if (titulos.length === 0) return;

    const ids = titulos.map(() => crypto.randomUUID());
    const agora = new Date().toISOString();
    const ordensDaColuna = tarefas.filter((t) => t.coluna_id === colunaId && t.turno === turno).map((t) => t.ordem);
    const ordemBase = ordensDaColuna.length > 0 ? Math.max(...ordensDaColuna) : 0;
    const novas: Tarefa[] = titulos.map((titulo, indice) => ({
      id: ids[indice],
      tenant_id: "",
      projeto_id: projetoId,
      titulo,
      descricao: null,
      coluna_id: colunaId,
      ordem: ordemBase + (indice + 1) * 1000,
      prioridade: "P3",
      is_marco: false,
      data_inicio: null,
      data_limite: null,
      tempo_estimado_min: null,
      tempo_realizado_min: null,
      criado_em: agora,
      aguardando_de: null,
      valor_estimado: null,
      turno,
    }));

    setTarefas((atual) => [...atual, ...novas]);

    const formData = new FormData();
    formData.set("titulo", tituloBruto);
    iniciarTransicao(() => {
      criarTarefa(projetoId, colunaId, formData, ids, turno).catch((err) => {
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
      dividida_em_turnos: false,
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

  function iniciarArrastoToque(tarefaId: string, titulo: string, x: number, y: number) {
    setArrastoToque({ tarefaId, titulo, x, y });
  }

  /** Recalcula, a partir de um ponto da tela, a coluna-alvo e (se o ponto
   * está em cima de outro cartão) o cartão-alvo + posição antes/depois —
   * mesma indicação visual que o D&D nativo (`onDragOver` em
   * CartaoTarefa.tsx) já mostra, agora também durante arrasto por toque
   * ("mostrar claramente destino e posição de inserção antes de soltar"). */
  function calcularAlvoNoPonto(x: number, y: number, tarefaArrastadaId: string) {
    const elemento = document.elementFromPoint(x, y);
    // Numa coluna dividida em turnos, cada sub-seção tem `data-turno` além
    // de `data-coluna-id` (no mesmo elemento) — uma coluna normal só tem
    // `data-coluna-id`. Buscar por `[data-coluna-id]` cobre os dois casos.
    const colunaEl = elemento?.closest<HTMLElement>("[data-coluna-id]");
    const cartaoEl = elemento?.closest<HTMLElement>("[data-tarefa-id]");

    let alvoCartao: { tarefaId: string; posicao: "antes" | "depois" } | null = null;
    if (cartaoEl && cartaoEl.dataset.tarefaId && cartaoEl.dataset.tarefaId !== tarefaArrastadaId) {
      const rect = cartaoEl.getBoundingClientRect();
      alvoCartao = { tarefaId: cartaoEl.dataset.tarefaId, posicao: y < rect.top + rect.height / 2 ? "antes" : "depois" };
    }

    return { colunaId: colunaEl?.dataset.colunaId ?? null, turno: (colunaEl?.dataset.turno as Turno | undefined) ?? null, alvoCartao };
  }

  // `tarefaId` chega explícito por parâmetro (fechado no closure estável do
  // próprio CartaoTarefa, igual já era feito em `iniciarArrastoToque`) — NÃO
  // reaproveita `arrastoToque.tarefaId` do estado. Achado real de teste
  // automatizado (2026-09-30): como `setArrastoToque` é assíncrono/batched,
  // um 1º touchmove disparado muito perto do touchstart (sem o React ter
  // tido chance de re-renderizar entre os dois) via ler `arrastoToque` do
  // closure como ainda `null` — a função silenciosamente não fazia nada.
  // Isso não é só uma garantia teórica: foi reproduzido via simulação de
  // toque antes desta correção. Receber o id por parâmetro elimina
  // completamente essa classe de bug (stale closure), em vez de só torná-la
  // menos provável.
  function moverArrastoToque(tarefaId: string, x: number, y: number) {
    setArrastoToque((atual) => (atual ? { ...atual, x, y } : atual));
    const { colunaId, alvoCartao } = calcularAlvoNoPonto(x, y, tarefaId);
    setColunaAlvoToqueId(colunaId);
    setAlvoCartaoToque(alvoCartao);
  }

  function soltarArrastoToque(tarefaId: string, x: number, y: number) {
    const { colunaId, turno, alvoCartao } = calcularAlvoNoPonto(x, y, tarefaId);
    if (alvoCartao) {
      soltarSobreCartao(tarefaId, alvoCartao.tarefaId, alvoCartao.posicao);
    } else if (colunaId) {
      moverPara(tarefaId, colunaId, turno);
    }
    setArrastoToque(null);
    setColunaAlvoToqueId(null);
    setAlvoCartaoToque(null);
  }

  // Auto-scroll durante o arrasto por toque — "rolagem automática perto do
  // topo e do rodapé" (vertical, dentro da coluna ou da página, conforme
  // qual delas realmente rola) e "alcançar outras colunas por navegação nas
  // bordas" (horizontal, rola o quadro inteiro, nunca troca de coluna
  // sozinho — só desloca a visão; a troca de verdade só acontece ao soltar).
  useEffect(() => {
    if (!arrastoToque) return;
    let ativo = true;
    // Posição atual do dedo, mantida por um listener PRÓPRIO deste efeito
    // (não um ref do componente compartilhado com o resto do código) — o
    // loop de rAF abaixo precisa ler a posição mais recente a cada frame,
    // mesmo com o dedo parado perto da borda (sem nenhum touchmove novo
    // disparando), o que só um valor mutável fora do ciclo de render
    // resolve sem recriar o loop a cada movimento.
    const posicaoAtual = { x: arrastoToque.x, y: arrastoToque.y };
    function aoMoverDocumento(e: TouchEvent) {
      const toque = e.touches[0];
      if (toque) {
        posicaoAtual.x = toque.clientX;
        posicaoAtual.y = toque.clientY;
      }
    }
    document.addEventListener("touchmove", aoMoverDocumento, { passive: true });

    function rolarVerticalNoPonto(x: number, y: number, delta: number) {
      const elementoNoPonto = document.elementFromPoint(x, y);
      const colunaEl = elementoNoPonto?.closest<HTMLElement>("[data-coluna-id]");
      if (colunaEl) {
        const estilo = window.getComputedStyle(colunaEl);
        const rolavel = (estilo.overflowY === "auto" || estilo.overflowY === "scroll") && colunaEl.scrollHeight > colunaEl.clientHeight;
        if (rolavel) {
          colunaEl.scrollBy({ top: delta });
          return;
        }
      }
      window.scrollBy({ top: delta });
    }

    function tick() {
      if (!ativo) return;
      const { x, y } = posicaoAtual;
      const alturaJanela = window.innerHeight;
      const larguraJanela = window.innerWidth;

      const velocidadeCima = calcularVelocidadeAutoScroll(y, ZONA_AUTO_SCROLL_VERTICAL_PX, VELOCIDADE_MAX_VERTICAL_PX);
      const velocidadeBaixo = calcularVelocidadeAutoScroll(
        alturaJanela - y,
        ZONA_AUTO_SCROLL_VERTICAL_PX,
        VELOCIDADE_MAX_VERTICAL_PX,
      );
      if (velocidadeCima > 0) rolarVerticalNoPonto(x, y, -velocidadeCima);
      else if (velocidadeBaixo > 0) rolarVerticalNoPonto(x, y, velocidadeBaixo);

      const velocidadeEsquerda = calcularVelocidadeAutoScroll(x, ZONA_AUTO_SCROLL_HORIZONTAL_PX, VELOCIDADE_MAX_HORIZONTAL_PX);
      const velocidadeDireita = calcularVelocidadeAutoScroll(
        larguraJanela - x,
        ZONA_AUTO_SCROLL_HORIZONTAL_PX,
        VELOCIDADE_MAX_HORIZONTAL_PX,
      );
      if (velocidadeEsquerda > 0) quadroRef.current?.scrollBy({ left: -velocidadeEsquerda });
      else if (velocidadeDireita > 0) quadroRef.current?.scrollBy({ left: velocidadeDireita });

      frameId = requestAnimationFrame(tick);
    }

    let frameId = requestAnimationFrame(tick);
    return () => {
      ativo = false;
      cancelAnimationFrame(frameId);
      document.removeEventListener("touchmove", aoMoverDocumento);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só liga/desliga o loop conforme o arrasto começa/termina; a posição corrente vem do listener local de touchmove, não de `arrastoToque`.
  }, [Boolean(arrastoToque)]);

  /** Liga/desliga a divisão de uma coluna em turnos — mesmo padrão otimista
   * das demais ações de coluna. Ao desligar, limpa `turno` das tarefas dessa
   * coluna no estado local também (a Server Action já faz isso no banco),
   * senão os cartões só voltariam a aparecer juntos depois do próximo
   * `router.refresh()` — decisão já tomada com o Fabio: nada se perde. */
  function alternarDivisaoTurnosOtimista(colunaId: string, dividida: boolean) {
    const tarefasAnteriores = tarefas;
    setColunas((atual) => atual.map((c) => (c.id === colunaId ? { ...c, dividida_em_turnos: dividida } : c)));
    if (!dividida) {
      setTarefas((atual) => atual.map((t) => (t.coluna_id === colunaId ? { ...t, turno: null } : t)));
    }

    iniciarTransicao(() => {
      alternarDivisaoEmTurnos(colunaId, projetoId, dividida).catch((err) => {
        setColunas((atual) => atual.map((c) => (c.id === colunaId ? { ...c, dividida_em_turnos: !dividida } : c)));
        if (!dividida) setTarefas(tarefasAnteriores);
        toast.error(mensagemDeErro(err, "Falha ao atualizar a divisão em turnos."));
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

  function abrirModal(tarefaId: string) {
    setTarefaAbertaId(tarefaId);
  }

  function fecharModal() {
    setTarefaAbertaId(null);
    router.refresh();
  }

  // Guarda/restaura a rolagem do quadro ao abrir/fechar o modal de detalhe
  // — "fechar retorna à mesma coluna e posição aproximada", pedido
  // explícito do Fabio. Um useEffect (não uma função chamada a partir de um
  // callback passado como prop) é o lugar certo pra ler/gravar `.current`
  // de um ref — o acesso só acontece depois que `tarefaAbertaId` já mudou,
  // nunca durante o render em si.
  useEffect(() => {
    if (tarefaAbertaId) {
      const container = quadroRef.current;
      setPosicaoAntesDoModal(container ? { left: container.scrollLeft, top: window.scrollY } : null);
      return;
    }
    if (!posicaoAntesDoModal) return;
    const { left, top } = posicaoAntesDoModal;
    // Depois do próximo paint (senão o router.refresh() do fechar pode
    // remontar o conteúdo e zerar a rolagem de novo).
    const frameId = requestAnimationFrame(() => {
      quadroRef.current?.scrollTo({ left });
      window.scrollTo({ top });
    });
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à troca de aberto/fechado; `posicaoAntesDoModal` é lido, não deve reexecutar sozinho.
  }, [tarefaAbertaId]);

  // Qual coluna está "em foco" durante a rolagem horizontal do quadro no
  // celular — recalculado a cada scroll (throttle simples via rAF) e ao
  // montar. Alimenta o cabeçalho mobile (nome/contagem/posição) e o
  // seletor de coluna.
  useEffect(() => {
    const container = quadroRef.current;
    if (!container) return;
    let pendente = false;

    function atualizar() {
      pendente = false;
      const el = quadroRef.current;
      if (!el) return;
      const cartoesDeColuna = Array.from(el.querySelectorAll<HTMLElement>("[data-coluna-card]"));
      const medidas = cartoesDeColuna.map((c) => ({
        id: c.dataset.colunaCard!,
        offsetLeft: c.offsetLeft,
        largura: c.offsetWidth,
      }));
      const centroVisivel = el.scrollLeft + el.clientWidth / 2;
      const focoId = encontrarColunaEmFoco(medidas, centroVisivel);
      if (focoId) setColunaFocoId(focoId);
    }

    function aoRolar() {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(atualizar);
    }

    atualizar();
    container.addEventListener("scroll", aoRolar, { passive: true });
    return () => container.removeEventListener("scroll", aoRolar);
  }, [colunas]);

  function irParaColuna(colunaId: string) {
    const el = quadroRef.current?.querySelector<HTMLElement>(`[data-coluna-card="${colunaId}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setColunaFocoId(colunaId);
  }

  const tarefaAberta = tarefas.find((t) => t.id === tarefaAbertaId) ?? null;
  const colunasAbertas = colunas.filter((c) => !c.concluido);
  const colunaFixa = colunas.find((c) => c.concluido) ?? null;
  const todasAsColunasNaOrdem = colunaFixa ? [...colunasAbertas, colunaFixa] : colunasAbertas;
  const tarefasConcluidas = colunaFixa ? tarefas.filter((t) => t.coluna_id === colunaFixa.id).length : 0;
  const percentualConcluido = tarefas.length > 0 ? Math.round((tarefasConcluidas / tarefas.length) * 100) : 0;
  const indiceFoco = Math.max(0, todasAsColunasNaOrdem.findIndex((c) => c.id === colunaFocoId));
  const colunaEmFoco = todasAsColunasNaOrdem[indiceFoco] ?? null;
  const contagemColunaFoco = colunaEmFoco ? tarefas.filter((t) => t.coluna_id === colunaEmFoco.id).length : 0;

  function renderColuna(coluna: ColunaKanban, ehFixa: boolean) {
    const tarefasDaColuna = tarefas.filter((t) => t.coluna_id === coluna.id).sort((a, b) => a.ordem - b.ordem);

    function renderCartoes(tarefasDoEscopo: Tarefa[]) {
      return tarefasDoEscopo.map((tarefa) => {
        const membrosDaTarefa = tarefaMembrosIniciais.filter((m) => m.tarefa_id === tarefa.id);
        const souResponsavel = Boolean(usuarioAtualId && membrosDaTarefa.some((m) => m.user_id === usuarioAtualId));

        return (
          <CartaoTarefa
            key={tarefa.id}
            tarefa={tarefa}
            coluna={coluna}
            colunasDoProjeto={todasAsColunasNaOrdem}
            projetoId={projetoId}
            checklistDaTarefa={checklistItensIniciais.filter((c) => c.tarefa_id === tarefa.id)}
            anexosDaTarefa={anexosIniciais.filter((a) => a.entidade_id === tarefa.id)}
            membrosDaTarefa={membrosDaTarefa}
            membrosDoTenant={membrosDoTenant}
            etiquetasDaTarefa={tarefaEtiquetasIniciais.filter((te) => te.tarefa_id === tarefa.id)}
            etiquetasDoTenant={etiquetasDoTenant}
            souResponsavel={souResponsavel}
            podeExcluir={podeExcluirTarefa}
            onAbrir={() => abrirModal(tarefa.id)}
            onExcluir={() => excluir(tarefa.id)}
            aoIniciarArrastoToque={(x, y) => iniciarArrastoToque(tarefa.id, tarefa.titulo, x, y)}
            aoMoverToque={(x, y) => moverArrastoToque(tarefa.id, x, y)}
            aoSoltarToque={(x, y) => soltarArrastoToque(tarefa.id, x, y)}
            emArrastoToque={arrastoToque?.tarefaId === tarefa.id}
            aoSoltarSobre={(tarefaArrastadaId, posicao) => soltarSobreCartao(tarefaArrastadaId, tarefa.id, posicao)}
            indicadorDrop={alvoCartaoToque?.tarefaId === tarefa.id ? alvoCartaoToque.posicao : null}
            aoMoverPara={(colunaId, turno, extremidade) => moverPara(tarefa.id, colunaId, turno, extremidade)}
          />
        );
      });
    }

    function renderInputNovoCartao(turno: Turno | null) {
      return (
        <input
          name="titulo"
          placeholder="+ Adicionar cartão"
          title="💡 GTD: se leva menos de 2 minutos, resolva agora — nem precisa virar cartão."
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            criarCartaoOtimista(coluna.id, e.currentTarget.value, turno);
            e.currentTarget.value = "";
          }}
          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-gaiamum-text-muted outline-none transition hover:border-gaiamum-border focus:border-gaiamum-primary focus:bg-gaiamum-surface-raised focus:text-gaiamum-text"
        />
      );
    }

    return (
      <div
        key={coluna.id}
        data-coluna-id={coluna.id}
        data-coluna-card={coluna.id}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const colunaArrastada = e.dataTransfer.getData("text/coluna-id");
          if (colunaArrastada) {
            soltarColuna(coluna.id);
            return;
          }
          // Numa coluna dividida, quem trata o drop de tarefa é a sub-seção
          // do turno (abaixo, com `stopPropagation`) — aqui só sobra o caso
          // de soltar na "moldura" da coluna, fora de qualquer turno.
          if (!coluna.dividida_em_turnos) {
            const tarefaId = e.dataTransfer.getData("text/tarefa-id");
            if (tarefaId) moverPara(tarefaId, coluna.id);
          }
        }}
        // Largura: 85vw (quase a tela toda) só em retrato estreito (<640px);
        // a partir de 640px (`sm:`) — que já cobre celular DEITADO, não só
        // desktop — volta a 256px fixo, permitindo várias colunas lado a
        // lado ("ao deitar, aproveitar a largura pra mostrar mais colunas").
        // Altura: limitada com scroll PRÓPRIO até 1024px (`lg:`) — cobre
        // tanto retrato quanto paisagem de celular/tablet (telas baixas,
        // onde a página inteira rolar seria pior); só acima de 1024px
        // (desktop real) a coluna volta a crescer livremente como sempre
        // (comportamento desktop existente, inalterado).
        className={`flex w-[85vw] max-w-sm shrink-0 snap-center flex-col gap-2.5 overflow-y-auto rounded-xl border border-gaiamum-border bg-gaiamum-surface p-3 transition max-h-[calc(100dvh-13rem)] sm:w-64 sm:snap-align-none lg:h-fit lg:max-h-none lg:overflow-visible ${
          colunaArrastadaId === coluna.id ? "opacity-50" : ""
        } ${colunaAlvoToqueId === coluna.id ? "ring-2 ring-gaiamum-primary" : ""}`}
      >
        <div className="sticky top-0 z-10 -mx-3 -mt-3 flex items-center justify-between gap-2 bg-gaiamum-surface px-3 pt-3 pb-1.5 lg:static lg:mx-0 lg:mt-0 lg:px-0 lg:pt-0">
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
          {!ehFixa && (
            <div className="flex shrink-0 items-center gap-2">
              {colunaEditandoId !== coluna.id && (
                <button
                  type="button"
                  onClick={() => alternarDivisaoTurnosOtimista(coluna.id, !coluna.dividida_em_turnos)}
                  className={`text-xs ${
                    coluna.dividida_em_turnos
                      ? "text-gaiamum-primary hover:text-gaiamum-primary-dark"
                      : "text-gaiamum-text-muted hover:text-gaiamum-text"
                  }`}
                  title={coluna.dividida_em_turnos ? "Desfazer divisão em Manhã/Tarde/Noite" : "Dividir em Manhã/Tarde/Noite"}
                >
                  ▥
                </button>
              )}
              {podeExcluirTarefa && colunaEditandoId !== coluna.id && (
                <button
                  type="button"
                  onClick={() => apagarColuna(coluna.id)}
                  className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
                  title="Excluir coluna"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {coluna.dividida_em_turnos ? (
          <div className="flex flex-col gap-3">
            {TURNOS.map(({ valor, rotulo }) => {
              const tarefasDoTurno = tarefasDaColuna.filter((t) => (t.turno ?? null) === valor);
              return (
                <div
                  key={valor}
                  data-coluna-id={coluna.id}
                  data-turno={valor}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.stopPropagation();
                    const tarefaId = e.dataTransfer.getData("text/tarefa-id");
                    if (tarefaId) moverPara(tarefaId, coluna.id, valor);
                  }}
                  className="flex flex-col gap-2 rounded-lg border border-dashed border-gaiamum-border p-2"
                >
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gaiamum-text-muted">
                    {rotulo} <span className="text-gaiamum-text">({tarefasDoTurno.length})</span>
                  </h3>
                  {renderCartoes(tarefasDoTurno)}
                  {renderInputNovoCartao(valor)}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {renderCartoes(tarefasDaColuna)}
            {renderInputNovoCartao(null)}
          </>
        )}
      </div>
    );
  }

  return (
    // `min-w-0` é a correção de um achado real de teste (Playwright,
    // 390px): sem isso, um container flex filho com `overflow-x-auto`
    // (o quadro abaixo) não é limitado pelo pai — ele cresce pra caber TODO
    // o conteúdo (todas as colunas lado a lado) e é a PÁGINA INTEIRA que
    // ganha rolagem horizontal, exatamente o que o Fabio pediu pra evitar
    // ("evitar rolagem horizontal acidental da página inteira"). Comum em
    // layouts flex — o filho só respeita a largura do pai com `min-width:0`
    // explícito (o padrão do flexbox é `min-width: auto`, que deixa o
    // conteúdo ditar o tamanho mínimo).
    <div className="min-w-0">
      {/* Cabeçalho de navegação — celular (colunas empilhadas por
          scroll-snap) e também celular/tablet EM PAISAGEM. "Mostrar título,
          contagem e indicação da coluna atual", "seletor de coluna como
          alternativa ao gesto", "Visão geral em retrato e paisagem" —
          pedidos explícitos do Fabio, 2026-09-30.
          Critério de visibilidade NÃO é só a largura (`sm:`): um celular
          deitado facilmente ultrapassa 640px de largura (ex.: 844px) e cairia
          no breakpoint "desktop", escondendo a barra — mas continua sendo
          touch, não mouse. Por isso soma `pointer: coarse` (toque) como
          critério independente de largura: mostra em qualquer tela pequena
          OU em qualquer dispositivo de toque, e só esconde de verdade num
          desktop real (ponteiro fino) com tela grande — "considere
          dispositivos híbridos: largura da tela e capacidade de entrada são
          coisas diferentes", dito explicitamente no pedido. Evita regressão
          em notebook/tablet touch: a barra aparece a mais ali, sem remover
          nada do comportamento desktop existente (colunas continuam w-64,
          lado a lado, arrasto nativo). */}
      {todasAsColunasNaOrdem.length > 0 && (
        <div className="mb-2 hidden items-center gap-2 max-[1023px]:flex [@media(pointer:coarse)]:flex">
          <button
            type="button"
            onClick={() => irParaColuna(todasAsColunasNaOrdem[Math.max(0, indiceFoco - 1)].id)}
            disabled={indiceFoco <= 0}
            aria-label="Coluna anterior"
            className="shrink-0 rounded-lg border border-gaiamum-border px-2.5 py-1.5 text-gaiamum-text-muted disabled:opacity-30"
          >
            ‹
          </button>

          <label className="flex min-w-0 flex-1 flex-col items-center">
            <span className="sr-only">Escolher coluna</span>
            <select
              value={colunaEmFoco?.id ?? ""}
              onChange={(e) => irParaColuna(e.target.value)}
              className="w-full truncate rounded-lg border border-transparent bg-transparent text-center text-sm font-semibold text-gaiamum-text outline-none"
            >
              {todasAsColunasNaOrdem.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({tarefas.filter((t) => t.coluna_id === c.id).length})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-gaiamum-text-muted">
              Coluna {indiceFoco + 1} de {todasAsColunasNaOrdem.length} · {contagemColunaFoco} cartão(ões)
            </span>
          </label>

          <button
            type="button"
            onClick={() => irParaColuna(todasAsColunasNaOrdem[Math.min(todasAsColunasNaOrdem.length - 1, indiceFoco + 1)].id)}
            disabled={indiceFoco >= todasAsColunasNaOrdem.length - 1}
            aria-label="Próxima coluna"
            className="shrink-0 rounded-lg border border-gaiamum-border px-2.5 py-1.5 text-gaiamum-text-muted disabled:opacity-30"
          >
            ›
          </button>

          <button
            type="button"
            onClick={() => setVisaoGeralAberta(true)}
            className="shrink-0 rounded-lg border border-gaiamum-border px-2.5 py-1.5 text-xs font-medium text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-primary"
          >
            ⊞ Visão geral
          </button>
        </div>
      )}

      {/* "O usuário deseja também usar pinça para afastar e enxergar o
          quadro" — avaliado (ver relatório do incremento): um gesto de
          pinça custom aqui competiria com o zoom nativo do navegador e com
          a rolagem/arrasto já existentes, risco de regressão desproporcional
          ao ganho. O botão "Visão geral" acima cobre a mesma necessidade
          (ver tudo de uma vez) de forma robusta; zoom nativo do navegador
          continua livre (nada aqui captura gesto de pinça). Pinça dedicada
          fica documentada como melhoria futura, não implementada agora. */}

      <div ref={quadroRef} className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scroll-smooth sm:snap-none">
        {/* `key` + `display:contents` (não afeta o layout flex) — achado
            incidental pré-existente (não introduzido nesta rodada): React
            exige key quando um elemento solto é intercalado com uma lista
            `.map()` como filhos irmãos do mesmo pai; faltava aqui. */}
        {colunaCompromissos && (
          <div key="coluna-compromissos" className="contents">
            {colunaCompromissos}
          </div>
        )}
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

      {arrastoToque && (
        <div
          style={{ position: "fixed", left: arrastoToque.x + 14, top: arrastoToque.y + 14, pointerEvents: "none", zIndex: 60 }}
          className="max-w-[14rem] truncate rounded-lg border border-gaiamum-primary bg-gaiamum-surface-raised px-3 py-1.5 text-sm font-medium text-gaiamum-text shadow-lg"
        >
          {arrastoToque.titulo}
        </div>
      )}

      {visaoGeralAberta && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setVisaoGeralAberta(false)}
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-gaiamum-border bg-gaiamum-surface p-4 sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">Visão geral do quadro</h2>
              <button type="button" onClick={() => setVisaoGeralAberta(false)} className="text-gaiamum-text-muted hover:text-gaiamum-text">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {todasAsColunasNaOrdem.map((c) => {
                const tarefasDaColuna = tarefas.filter((t) => t.coluna_id === c.id).sort((a, b) => a.ordem - b.ordem);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setVisaoGeralAberta(false);
                      irParaColuna(c.id);
                    }}
                    className={`flex flex-col gap-1 rounded-lg border p-2 text-left transition hover:border-gaiamum-primary ${
                      colunaFocoId === c.id ? "border-gaiamum-primary" : "border-gaiamum-border"
                    }`}
                  >
                    <span className="truncate text-xs font-semibold text-gaiamum-text">
                      {c.nome} ({tarefasDaColuna.length})
                    </span>
                    <span className="flex flex-col gap-0.5">
                      {tarefasDaColuna.slice(0, 3).map((t) => (
                        <span key={t.id} className="truncate text-[11px] text-gaiamum-text-muted">
                          {t.titulo}
                        </span>
                      ))}
                      {tarefasDaColuna.length === 0 && <span className="text-[11px] text-gaiamum-text-muted">Vazia</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
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
          souOwner={souOwner}
          jaGerouConta={tarefasComContaGerada.includes(tarefaAberta.id)}
          aoFechar={fecharModal}
        />
      )}
    </div>
  );
}
