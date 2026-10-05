"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { Anexo, ChecklistItem, ColunaKanban, Etiqueta, MembroTenant, Tarefa, TarefaEtiqueta, TarefaMembro, Turno } from "@/lib/ecc/tipos";
import {
  ID_COLUNA_COMPROMISSOS,
  calcularNovaOrdem,
  calcularVelocidadeAutoScroll,
  encontrarColunaEmFoco,
  gerarIdCliente,
  tocarSomConcluido,
} from "@/lib/ecc/kanban";
import {
  alternarDivisaoEmTurnos,
  criarColuna,
  criarTarefa,
  definirColunaHoje,
  deletarTarefa,
  excluirColuna,
  iniciarHiperfoco,
  moverTarefa,
  renomearColuna,
  reordenarColunas,
} from "@/lib/ecc/actions";
import {
  FILTRO_QUADRO_VAZIO,
  contarEmFoco,
  filtrarTarefasDoQuadro,
  filtroQuadroAtivo,
  focoAtivoDoUsuario,
  prazosDeHoje,
  resumirProgressoQuadro,
  type FiltroQuadro,
} from "@/lib/ecc/kanban-cabecalho";
import { PopupHiperfocoIniciar } from "@/components/kanban/popup-hiperfoco-iniciar";
import { DetalheTarefa } from "@/components/kanban/detalhe-tarefa";
import { CartaoTarefa } from "@/components/kanban/cartao-tarefa";
import { BarraFerramentasQuadro, FaixaDoDia, ProgressoDoQuadro } from "@/components/kanban/cabecalho-quadro";
import { ItemMenu, MenuSuspenso } from "@/components/ui/menu-suspenso";
import {
  IconeCheckCirculo,
  IconeChevronBaixo,
  IconeChevronCima,
  IconeLua,
  IconeNascerDoSol,
  IconePontosVertical,
  IconeRelogio,
  IconeSol,
} from "@/components/kanban/icones-kanban";

const TURNOS: { valor: Turno; rotulo: string }[] = [
  { valor: "manha", rotulo: "🌅 Manhã" },
  { valor: "tarde", rotulo: "🌤️ Tarde" },
  { valor: "noite", rotulo: "🌙 Noite" },
];

/** Cabeçalho de cada turno dentro de "Hoje" (redesenho 2026-10-05) — os
 * rótulos com emoji de `TURNOS` continuam sendo os do menu "Mover para...". */
const CABECALHO_TURNO: Record<Turno, { nome: string; minusculo: string; icone: ReactNode }> = {
  manha: { nome: "Manhã", minusculo: "manhã", icone: <IconeNascerDoSol className="h-3.5 w-3.5 text-gaiamum-warning" /> },
  tarde: { nome: "Tarde", minusculo: "tarde", icone: <IconeSol className="h-3.5 w-3.5 text-gaiamum-warning" /> },
  noite: { nome: "Noite", minusculo: "noite", icone: <IconeLua className="h-3.5 w-3.5 text-gaiamum-accent" /> },
};

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
  faixaCompromisso,
  rotuloHoje,
  hojeChave,
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
  /** Item "Próximo compromisso" da faixa do dia — Server Component em
   * `<Suspense>`, montado na página (mesmo gate de acesso da coluna acima). */
  faixaCompromisso?: ReactNode;
  /** "domingo, 5 de outubro" — calculado no servidor (fuso Brasil). */
  rotuloHoje: string;
  /** "AAAA-MM-DD" de hoje no fuso Brasil — pra "prazo importante hoje". */
  hojeChave: string;
}) {
  const [tarefas, setTarefas] = useState(tarefasIniciais);
  const [tarefasIniciaisAnteriores, setTarefasIniciaisAnteriores] = useState(tarefasIniciais);
  const [colunas, setColunas] = useState(colunasIniciais);
  const [colunasIniciaisAnteriores, setColunasIniciaisAnteriores] = useState(colunasIniciais);
  const [tarefaAbertaId, setTarefaAbertaId] = useState<string | null>(null);
  const [colunaEditandoId, setColunaEditandoId] = useState<string | null>(null);
  const [colunaArrastadaId, setColunaArrastadaId] = useState<string | null>(null);
  const [criandoColuna, setCriandoColuna] = useState(false);
  // Pedido do Fabio (2026-10-01): a coluna "Concluído" cresce sem parar ao
  // longo de um projeto, empurrando a altura de TODAS as colunas (que agora
  // nivelam pela maior — ver o `grid` abaixo) e tirando o foco do que ainda
  // falta fazer. Botão exclusivo dela: oculta os cartões (só pra essa
  // coluna encolher), sem apagar nada — um toque mostra tudo de novo pra
  // conferência. Estado só de interface (nunca persiste no banco, nem
  // precisa — é um "esconder da vista" temporário, não uma preferência de
  // longo prazo), por isso começa OCULTO em toda visita nova à página: é
  // exatamente o comportamento padrão que resolve "a tela fica enorme com
  // o tempo".
  const [concluidosOcultos, setConcluidosOcultos] = useState(true);
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
  // Barra de navegação horizontal SUPERIOR (desktop/visão ampla) — pedido
  // de 2026-10-01: hoje só existe a barra nativa embaixo das colunas, que
  // exige descer até o fim pra alcançar. `larguraTotalQuadro` espelha o
  // `scrollWidth` real do quadro, pro "fantasma" dentro da barra ter a
  // largura certa pra rolar proporcionalmente.
  const barraSuperiorRef = useRef<HTMLDivElement>(null);
  const [larguraTotalQuadro, setLarguraTotalQuadro] = useState(0);
  // Posição de rolagem do quadro antes de abrir o modal de detalhe — pra
  // fechar "voltar pra mesma coluna/posição", pedido explícito do Fabio.
  const [posicaoAntesDoModal, setPosicaoAntesDoModal] = useState<{ left: number; top: number } | null>(null);
  // Cartão recém-movido pra coluna de foco (migration 0052,
  // `dispara_hiperfoco`) — abre o popup oferecendo o cronômetro de
  // hiperfoco. Não bloqueia o movimento em si: o cartão já trocou de
  // coluna antes deste popup abrir, "Sem alarme" só fecha sem nenhuma
  // Server Action.
  const [tarefaIniciandoHiperfocoId, setTarefaIniciandoHiperfocoId] = useState<string | null>(null);
  // Filtro VISUAL da toolbar (redesenho 2026-10-05) — só decide quais
  // cartões aparecem; nunca altera `tarefas`, ordem nem banco. Não persiste:
  // toda visita nova começa sem filtro.
  const [filtro, setFiltro] = useState<FiltroQuadro>(FILTRO_QUADRO_VAZIO);

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
    const colunaDestino = colunasIniciais.find((c) => c.id === novaColunaId);
    if (colunaDestino?.concluido) {
      tocarSomConcluido();
    }
    // Entrar na coluna de foco (migration 0052) oferece o popup de
    // cronômetro de hiperfoco — só quando REALMENTE muda de coluna (não ao
    // reordenar dentro da própria coluna de foco, que chamaria isto de
    // novo a cada arrasto sem sentido).
    const tarefaMovendo = tarefas.find((t) => t.id === tarefaId);
    if (colunaDestino?.dispara_hiperfoco && tarefaMovendo?.coluna_id !== novaColunaId) {
      setTarefaIniciandoHiperfocoId(tarefaId);
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

    const colunaDestino = colunasIniciais.find((c) => c.id === tarefaAlvo.coluna_id);
    if (colunaDestino?.concluido) {
      tocarSomConcluido();
    }
    const tarefaMovendo = tarefas.find((t) => t.id === tarefaArrastadaId);
    if (colunaDestino?.dispara_hiperfoco && tarefaMovendo?.coluna_id !== tarefaAlvo.coluna_id) {
      setTarefaIniciandoHiperfocoId(tarefaArrastadaId);
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

    const ids = titulos.map(() => gerarIdCliente());
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
      hiperfoco_iniciado_em: null,
      hiperfoco_user_id: null,
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

  // Nova coluna nasce logo DEPOIS de "Hoje" (regra definitiva, 2026-10-01)
  // — nunca no fim do quadro. Fallback (projeto antigo, sem "Hoje" ainda):
  // nasce na 1ª posição. Mesma lógica da Server Action `criarColuna`,
  // espelhada aqui só pro otimista aparecer na posição certa na hora, sem
  // esperar o servidor confirmar.
  function criarColunaOtimista(nome: string) {
    if (!nome.trim()) return;
    const id = gerarIdCliente();
    const novaColuna: ColunaKanban = {
      id,
      tenant_id: "",
      projeto_id: projetoId,
      nome,
      ordem: colunasAbertas.length,
      concluido: false,
      criado_em: new Date().toISOString(),
      dividida_em_turnos: false,
      hoje: false,
      dispara_hiperfoco: false,
    };
    const indiceHoje = colunasAbertas.findIndex((c) => c.hoje);
    const posicaoAlvo = indiceHoje === -1 ? 0 : indiceHoje + 1;
    const abertasComNova = [...colunasAbertas];
    abertasComNova.splice(posicaoAlvo, 0, novaColuna);
    setColunas([...abertasComNova, ...colunas.filter((c) => c.concluido)]);
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

    // Coluna rolável no ponto (x, y), se houver — `null` quando o dedo não
    // está sobre nenhuma coluna com scroll próprio.
    function colunaRolavelNoPonto(x: number, y: number): HTMLElement | null {
      const elementoNoPonto = document.elementFromPoint(x, y);
      const colunaEl = elementoNoPonto?.closest<HTMLElement>("[data-coluna-id]");
      if (!colunaEl) return null;
      const estilo = window.getComputedStyle(colunaEl);
      const rolavel = (estilo.overflowY === "auto" || estilo.overflowY === "scroll") && colunaEl.scrollHeight > colunaEl.clientHeight;
      return rolavel ? colunaEl : null;
    }

    function tick() {
      if (!ativo) return;
      const { x, y } = posicaoAtual;
      const larguraJanela = window.innerWidth;

      // Achado real de teste (2026-10-01): a zona de auto-scroll vertical
      // precisa ser relativa ao TOPO/RODAPÉ DA COLUNA, não da janela — o
      // cabeçalho fixo da página (título do projeto, navegação, barra de
      // colunas no mobile) ocupa boa parte do topo da tela, então "90px do
      // topo da JANELA" podia cair inteiramente dentro da área do
      // cabeçalho, sem nunca alcançar a coluna de verdade — levar um
      // cartão pro topo de uma coluna longa simplesmente não rolava nunca.
      // Quando o dedo não está sobre nenhuma coluna rolável (raro — ex.:
      // arrastando sobre a página, fora de qualquer coluna), cai no
      // fallback relativo à janela (comportamento anterior, preservado).
      const colunaRolavel = colunaRolavelNoPonto(x, y);
      if (colunaRolavel) {
        const rect = colunaRolavel.getBoundingClientRect();
        const velocidadeCima = calcularVelocidadeAutoScroll(y - rect.top, ZONA_AUTO_SCROLL_VERTICAL_PX, VELOCIDADE_MAX_VERTICAL_PX);
        const velocidadeBaixo = calcularVelocidadeAutoScroll(rect.bottom - y, ZONA_AUTO_SCROLL_VERTICAL_PX, VELOCIDADE_MAX_VERTICAL_PX);
        if (velocidadeCima > 0) colunaRolavel.scrollBy({ top: -velocidadeCima });
        else if (velocidadeBaixo > 0) colunaRolavel.scrollBy({ top: velocidadeBaixo });
      } else {
        const alturaJanela = window.innerHeight;
        const velocidadeCima = calcularVelocidadeAutoScroll(y, ZONA_AUTO_SCROLL_VERTICAL_PX, VELOCIDADE_MAX_VERTICAL_PX);
        const velocidadeBaixo = calcularVelocidadeAutoScroll(alturaJanela - y, ZONA_AUTO_SCROLL_VERTICAL_PX, VELOCIDADE_MAX_VERTICAL_PX);
        if (velocidadeCima > 0) window.scrollBy({ top: -velocidadeCima });
        else if (velocidadeBaixo > 0) window.scrollBy({ top: velocidadeBaixo });
      }

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
   * das demais ações de coluna.
   * Ao desligar, limpa `turno` das tarefas dessa coluna no estado local
   * também (a Server Action já faz isso no banco), senão os cartões só
   * voltariam a aparecer juntos depois do próximo `router.refresh()` —
   * decisão já tomada com o Fabio: nada se perde.
   * Ao ligar, cartões já existentes sem turno (achado real, 2026-10-01: eles
   * não desapareciam de fato, só ficavam invisíveis — nenhum dos 3
   * sub-blocos mostra `turno === null`) entram direto em "Manhã", igual à
   * Server Action — a pessoa reorganiza manualmente depois se quiser. */
  function alternarDivisaoTurnosOtimista(colunaId: string, dividida: boolean) {
    const tarefasAnteriores = tarefas;
    setColunas((atual) => atual.map((c) => (c.id === colunaId ? { ...c, dividida_em_turnos: dividida } : c)));
    if (!dividida) {
      setTarefas((atual) => atual.map((t) => (t.coluna_id === colunaId ? { ...t, turno: null } : t)));
    } else {
      setTarefas((atual) =>
        atual.map((t) => (t.coluna_id === colunaId && t.turno == null ? { ...t, turno: "manha" } : t)),
      );
    }

    iniciarTransicao(() => {
      alternarDivisaoEmTurnos(colunaId, projetoId, dividida).catch((err) => {
        setColunas((atual) => atual.map((c) => (c.id === colunaId ? { ...c, dividida_em_turnos: !dividida } : c)));
        setTarefas(tarefasAnteriores);
        toast.error(mensagemDeErro(err, "Falha ao atualizar a divisão em turnos."));
      });
    });
  }

  /** Marca uma coluna como "Hoje" — mesmo padrão otimista das demais ações
   * de coluna. Desmarca a anterior (se houver) e desliga a divisão em
   * turnos dela no estado local também, espelhando o que a Server Action
   * faz no banco (ela deixaria de satisfazer o CHECK constraint, migration
   * 0048, se continuasse dividida sem ser mais a Hoje). */
  function definirColunaHojeOtimista(colunaId: string) {
    const colunasAnteriores = colunas;
    const tarefasAnteriores = tarefas;
    const hojeAnteriorId = colunas.find((c) => c.hoje)?.id;
    setColunas((atual) =>
      atual.map((c) => {
        if (c.id === colunaId) return { ...c, hoje: true };
        if (c.id === hojeAnteriorId) return { ...c, hoje: false, dividida_em_turnos: false };
        return c;
      }),
    );
    if (hojeAnteriorId) {
      setTarefas((atual) => atual.map((t) => (t.coluna_id === hojeAnteriorId ? { ...t, turno: null } : t)));
    }

    iniciarTransicao(() => {
      definirColunaHoje(colunaId, projetoId).catch((err) => {
        setColunas(colunasAnteriores);
        setTarefas(tarefasAnteriores);
        toast.error(mensagemDeErro(err, 'Falha ao definir a coluna "Hoje".'));
      });
    });
  }

  // `definirColunaHiperfocoOtimista` existiu aqui (permitia marcar
  // manualmente qual coluna dispara o cronômetro de hiperfoco) — removida
  // por pedido do Fabio (2026-10-03): o foco agora só entra na coluna "Em
  // Desenvolvimento", que é fixa (não renomeável/excluível). Ver
  // `renomearColunaOtimista`/`apagarColuna` abaixo, que agora bloqueiam a
  // ação direto na interface pra essa coluna específica.

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

  // Recalcula a extensão da barra superior sempre que o conteúdo do quadro
  // muda de largura — "recalcule a extensão ao adicionar/reordenar colunas
  // ou redimensionar" (2026-10-01). `scrollWidth` não dispara ResizeObserver
  // sozinho num container com `overflow-x-auto` (o elemento em si não muda
  // de tamanho, só o conteúdo dele) — por isso o recálculo depende de
  // `colunas`/`tarefas` (cobre criar/mover/excluir cartão e coluna) MAIS um
  // listener de `resize` da janela (cobre redimensionar a tela).
  useEffect(() => {
    function recalcularLargura() {
      const largura = quadroRef.current?.scrollWidth ?? 0;
      setLarguraTotalQuadro(largura);
    }
    recalcularLargura();
    window.addEventListener("resize", recalcularLargura);
    return () => window.removeEventListener("resize", recalcularLargura);
  }, [colunas, tarefas]);

  // Sincroniza a barra superior com a rolagem real do quadro, nos dois
  // sentidos — "a barra superior deve ser alcançável sem descer até o fim".
  // `sincronizando` evita o loop óbvio (rolar uma dispara o scroll da
  // outra, que disparia de volta a 1ª, indefinidamente).
  useEffect(() => {
    const quadro = quadroRef.current;
    const barra = barraSuperiorRef.current;
    if (!quadro || !barra) return;
    let sincronizando = false;

    function aoRolarQuadro() {
      if (sincronizando) {
        sincronizando = false;
        return;
      }
      sincronizando = true;
      barra!.scrollLeft = quadro!.scrollLeft;
    }
    function aoRolarBarra() {
      if (sincronizando) {
        sincronizando = false;
        return;
      }
      sincronizando = true;
      quadro!.scrollLeft = barra!.scrollLeft;
    }

    quadro.addEventListener("scroll", aoRolarQuadro, { passive: true });
    barra.addEventListener("scroll", aoRolarBarra, { passive: true });
    return () => {
      quadro.removeEventListener("scroll", aoRolarQuadro);
      barra.removeEventListener("scroll", aoRolarBarra);
    };
  }, []);

  function irParaColuna(colunaId: string) {
    const el = quadroRef.current?.querySelector<HTMLElement>(`[data-coluna-card="${colunaId}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setColunaFocoId(colunaId);
  }

  const tarefaAberta = tarefas.find((t) => t.id === tarefaAbertaId) ?? null;
  const colunasAbertas = colunas.filter((c) => !c.concluido);
  const colunaFixa = colunas.find((c) => c.concluido) ?? null;
  const todasAsColunasNaOrdem = colunaFixa ? [...colunasAbertas, colunaFixa] : colunasAbertas;
  // Cabeçalho redesenhado (2026-10-05) — tudo derivado do estado local (o
  // mesmo que os cartões usam), então acompanha cada movimento otimista.
  const resumoProgresso = resumirProgressoQuadro(tarefas, colunaFixa?.id ?? null);
  const emFoco = contarEmFoco(tarefas, colunas);
  const prazosHoje = prazosDeHoje(tarefas, new Set(colunas.filter((c) => c.concluido).map((c) => c.id)), hojeChave);
  const focoAtivo = focoAtivoDoUsuario(tarefas, usuarioAtualId);
  const colunaDeFoco = colunas.find((c) => c.dispara_hiperfoco) ?? null;
  const filtrando = filtroQuadroAtivo(filtro);
  const idsVisiveis = filtrando
    ? new Set(
        filtrarTarefasDoQuadro(tarefas, filtro, {
          tarefasDoUsuario: new Set(
            tarefaMembrosIniciais.filter((m) => m.user_id === usuarioAtualId).map((m) => m.tarefa_id),
          ),
          etiquetasPorTarefa: tarefaEtiquetasIniciais.reduce((mapa, te) => {
            const conjunto = mapa.get(te.tarefa_id) ?? new Set<string>();
            conjunto.add(te.etiqueta_id);
            return mapa.set(te.tarefa_id, conjunto);
          }, new Map<string, Set<string>>()),
        }).map((t) => t.id),
      )
    : null;

  /** "+ Tarefa" da toolbar — sem fluxo próprio: leva até o campo "+
   * Adicionar tarefa" da coluna de entrada (a 1ª aberta que não é "Hoje" nem
   * a de foco — "Tarefas" num projeto padrão; senão a 1ª aberta) e foca
   * nele. A criação em si continua sendo `criarCartaoOtimista`, igual a
   * digitar direto no campo. */
  function focarNovaTarefa() {
    const alvo = colunasAbertas.find((c) => !c.hoje && !c.dispara_hiperfoco) ?? colunasAbertas[0];
    if (!alvo) return;
    const chave = alvo.dividida_em_turnos ? `${alvo.id}:manha` : alvo.id;
    const campo = quadroRef.current?.querySelector<HTMLInputElement>(`[data-input-novo-cartao="${chave}"]`);
    if (!campo) return;
    campo.focus({ preventScroll: true });
    campo.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setColunaFocoId(alvo.id);
  }
  // Opções do seletor/setas de navegação móvel (cabeçalho abaixo) — achado
  // real (2026-10-04): "Compromissos do dia" é um ReactNode solto (nunca
  // fez parte de `colunas`/`todasAsColunasNaOrdem`, que só tem
  // `ColunaKanban` de verdade), então o seletor nunca oferecia ir pra ela, e
  // o contador "Coluna X de Y" nunca contava com ela. Lista derivada SÓ pra
  // esta navegação — `colunasDoProjeto` (passada pro cartão, pro menu
  // "Mover para...") continua sendo `todasAsColunasNaOrdem` puro, já que
  // Compromissos nunca é um destino válido de cartão.
  const opcoesNavegacao = [
    ...(colunaCompromissos
      ? [{ id: ID_COLUNA_COMPROMISSOS, nome: "📅 Compromissos do dia", contagem: null as number | null }]
      : []),
    ...todasAsColunasNaOrdem.map((c) => ({
      id: c.id,
      nome: c.nome,
      contagem: tarefas.filter((t) => t.coluna_id === c.id).length,
    })),
  ];
  const indiceFoco = Math.max(0, opcoesNavegacao.findIndex((o) => o.id === colunaFocoId));
  const opcaoEmFoco = opcoesNavegacao[indiceFoco] ?? null;

  function renderColuna(coluna: ColunaKanban, ehFixa: boolean) {
    const tarefasDaColuna = tarefas.filter((t) => t.coluna_id === coluna.id).sort((a, b) => a.ordem - b.ordem);
    // Filtro visual da toolbar: só decide o que aparece — a contagem total e
    // todo cálculo de ordem (arrasto/"Mover para...") seguem sobre a lista
    // completa (`tarefas`).
    const visiveis = (lista: Tarefa[]) => (idsVisiveis ? lista.filter((t) => idsVisiveis.has(t.id)) : lista);
    const rotuloContagem = (lista: Tarefa[]) => (idsVisiveis ? `${visiveis(lista).length}/${lista.length}` : `${lista.length}`);
    // A coluna de foco ("Em Desenvolvimento", `dispara_hiperfoco`) também é
    // travada (pedido do Fabio, 2026-10-03): não pode ser renomeada,
    // arrastada ou excluída — "o foco só vai entrar na coluna em
    // desenvolvimento, retire essa história de botar o foco em qualquer
    // lugar". Mesma trava de interface que "Concluído" já tinha (`ehFixa`),
    // só que esta continua aceitando cartões/cartão novo normalmente — só a
    // IDENTIDADE da coluna (nome/posição/existência) é fixa, não o conteúdo.
    const colunaTravada = ehFixa || coluna.dispara_hiperfoco;
    const concluidoRecolhido = ehFixa && concluidosOcultos;

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
          // Âncora do botão "+ Tarefa" da toolbar (`focarNovaTarefa`).
          data-input-novo-cartao={turno ? `${coluna.id}:${turno}` : coluna.id}
          placeholder={turno ? `+ Adicionar tarefa para ${CABECALHO_TURNO[turno].minusculo}` : "+ Adicionar tarefa"}
          title="💡 GTD: se leva menos de 2 minutos, resolva agora — nem precisa virar cartão."
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            criarCartaoOtimista(coluna.id, e.currentTarget.value, turno);
            e.currentTarget.value = "";
          }}
          className={`w-full rounded-lg border px-2.5 py-1.5 text-[13px] text-gaiamum-text-muted outline-none transition placeholder:text-gaiamum-text-muted/90 focus:border-gaiamum-primary focus:bg-gaiamum-surface-raised focus:text-gaiamum-text ${
            turno
              ? "border-gaiamum-border/70 bg-gaiamum-surface-raised/40 hover:border-gaiamum-border-forte"
              : "border-transparent bg-transparent hover:border-gaiamum-border hover:bg-gaiamum-surface-raised/40"
          }`}
        />
      );
    }

    // Ícone do cabeçalho pela IDENTIDADE da coluna (flags), nunca pelo nome.
    const iconeColuna = ehFixa ? (
      <IconeCheckCirculo className="h-[18px] w-[18px] text-gaiamum-success" />
    ) : coluna.dispara_hiperfoco ? (
      <span className="text-base leading-none">🎯</span>
    ) : coluna.hoje ? (
      <IconeSol className="h-[18px] w-[18px] text-gaiamum-warning" />
    ) : (
      <IconeRelogio className="h-[18px] w-[18px] text-gaiamum-text-muted" />
    );

    // Larguras do mockup aprovado: "Hoje" um pouco mais larga (é o centro do
    // dia), Concluído recolhido estreito (não cresce à toa); as demais —
    // inclusive colunas criadas pela pessoa — no tamanho padrão.
    const larguraDesktop = concluidoRecolhido ? "sm:w-44" : coluna.hoje ? "sm:w-60" : "sm:w-56";

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
        // desktop — largura fixa por tipo de coluna (ver `larguraDesktop`),
        // várias lado a lado.
        // Altura: SEMPRE limitada com scroll próprio, via `style.maxHeight`
        // (não um arbitrary value do Tailwind baseado em `var()` — isso
        // confunde o scanner do Tailwind/Lightning CSS e gera warning de
        // build). O NIVELAMENTO entre colunas ("todas na altura da maior",
        // pedido de 2026-10-01) é o container pai (`display:grid`,
        // `items-stretch` a partir de `sm:`) esticando cada coluna — CSS
        // puro, ver `--altura-maxima-coluna-kanban` em globals.css.
        // "Hoje" com borda azul mais evidente (destaque do mockup aprovado).
        className={`flex w-[85vw] max-w-sm shrink-0 snap-center flex-col gap-2 overflow-y-auto rounded-xl bg-gaiamum-surface p-2.5 transition sm:snap-align-none ${larguraDesktop} ${
          coluna.hoje ? "border-2 border-gaiamum-primary/80 shadow-lg shadow-gaiamum-primary/10" : "border border-gaiamum-border"
        } ${colunaArrastadaId === coluna.id ? "opacity-50" : ""} ${colunaAlvoToqueId === coluna.id ? "ring-2 ring-gaiamum-primary" : ""}`}
        style={{ maxHeight: "var(--altura-maxima-coluna-kanban)" }}
      >
        <div className="sticky top-0 z-10 -mx-2.5 -mt-2.5 flex items-center gap-1.5 bg-gaiamum-surface px-3 pb-1.5 pt-3">
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
              draggable={!colunaTravada}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/coluna-id", coluna.id);
                setColunaArrastadaId(coluna.id);
              }}
              onDragEnd={() => setColunaArrastadaId(null)}
              onClick={() => !colunaTravada && setColunaEditandoId(coluna.id)}
              className={`flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-gaiamum-text ${
                colunaTravada ? "" : "cursor-grab hover:text-gaiamum-primary active:cursor-grabbing"
              }`}
              title={colunaTravada ? undefined : "Arraste pra reordenar, clique pra renomear"}
            >
              <span aria-hidden className="flex shrink-0 items-center">
                {iconeColuna}
              </span>
              <span className="truncate">{coluna.nome}</span>
              <span className="shrink-0 font-medium text-gaiamum-text-muted">({rotuloContagem(tarefasDaColuna)})</span>
            </h2>
          )}
          {coluna.hoje && colunaEditandoId !== coluna.id && (
            <span
              className="shrink-0 rounded-md border border-gaiamum-primary/40 bg-gaiamum-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-gaiamum-primary"
              title="Coluna Hoje — só ela pode ser dividida em turnos, e é onde novas colunas nascem"
            >
              Hoje
            </span>
          )}
          {/* Exclusivo da coluna "Concluído" (pedido do Fabio, 2026-10-01):
              ela só cresce ao longo de um projeto — some os cartões (sem
              apagar nada) pra ela parar de "puxar" a altura das outras
              colunas; um toque mostra tudo de novo. */}
          {ehFixa && tarefasDaColuna.length > 0 && (
            <button
              type="button"
              onClick={() => setConcluidosOcultos((atual) => !atual)}
              aria-label={concluidosOcultos ? "Mostrar os cartões concluídos" : "Ocultar os cartões concluídos"}
              title={
                concluidosOcultos
                  ? "Mostrar os cartões concluídos (só pra conferência)"
                  : "Ocultar os cartões concluídos de novo"
              }
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gaiamum-text-muted transition hover:bg-gaiamum-surface-raised hover:text-gaiamum-text"
            >
              {concluidosOcultos ? <IconeChevronBaixo /> : <IconeChevronCima />}
            </button>
          )}
          {/* Ações da coluna no menu ⋮ (antes eram textos/ícones soltos no
              cabeçalho) — mesmas ações, mesmas condições de exibição:
              "Definir Hoje" (nome mantido — "Planejar hoje" mudaria o
              sentido: isto marca QUAL coluna é a "Hoje", não planeja o dia),
              dividir em turnos (só na "Hoje" — regra aplicada também no
              servidor e por CHECK constraint, migration 0048), excluir (só
              quem pode excluir; nunca a de foco). "Definir foco" segue
              removido (pedido do Fabio, 2026-10-03). */}
          {!ehFixa && colunaEditandoId !== coluna.id && (
            <MenuSuspenso
              rotulo={`Ações da coluna ${coluna.nome}`}
              icone={<IconePontosVertical className="h-4 w-4" />}
              classeBotao="h-7 w-7"
              itens={(fechar) => (
                <>
                  {!colunaTravada && (
                    <ItemMenu
                      onClick={() => {
                        fechar();
                        setColunaEditandoId(coluna.id);
                      }}
                    >
                      Renomear coluna
                    </ItemMenu>
                  )}
                  {coluna.hoje ? (
                    <ItemMenu
                      ativo={coluna.dividida_em_turnos}
                      onClick={() => {
                        fechar();
                        alternarDivisaoTurnosOtimista(coluna.id, !coluna.dividida_em_turnos);
                      }}
                    >
                      ▥ {coluna.dividida_em_turnos ? "Desfazer divisão em turnos" : "Dividir em Manhã/Tarde/Noite"}
                    </ItemMenu>
                  ) : (
                    <ItemMenu
                      onClick={() => {
                        fechar();
                        definirColunaHojeOtimista(coluna.id);
                      }}
                    >
                      Definir Hoje
                    </ItemMenu>
                  )}
                  {podeExcluirTarefa && !coluna.dispara_hiperfoco && (
                    <ItemMenu
                      perigo
                      onClick={() => {
                        fechar();
                        apagarColuna(coluna.id);
                      }}
                    >
                      Excluir coluna
                    </ItemMenu>
                  )}
                </>
              )}
            />
          )}
        </div>

        {coluna.dispara_hiperfoco && (
          <span
            className="-mt-0.5 inline-flex items-center gap-1 self-start rounded-md border border-gaiamum-warning/40 bg-gaiamum-warning/15 px-2 py-0.5 text-[11px] font-semibold text-gaiamum-warning"
            title="Coluna de foco fixa — mover um cartão pra cá oferece o cronômetro de hiperfoco. Não pode ser renomeada, movida ou apagada."
          >
            🎯 Foco
          </span>
        )}

        {coluna.dividida_em_turnos ? (
          <div className="flex flex-col gap-3">
            {TURNOS.map(({ valor }) => {
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
                  className="flex flex-col gap-1.5 rounded-lg"
                >
                  <h3 className="flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gaiamum-text-muted">
                    {CABECALHO_TURNO[valor].icone}
                    {CABECALHO_TURNO[valor].nome} <span>({rotuloContagem(tarefasDoTurno)})</span>
                  </h3>
                  {renderCartoes(visiveis(tarefasDoTurno))}
                  {renderInputNovoCartao(valor)}
                </div>
              );
            })}
          </div>
        ) : concluidoRecolhido ? (
          tarefasDaColuna.length > 0 ? (
            <div className="flex flex-col gap-3 px-0.5 pt-1">
              <p className="flex items-center gap-2 text-sm text-gaiamum-text">
                <span aria-hidden>🎉</span>
                <span>
                  <span className="font-semibold">{tarefasDaColuna.length}</span>{" "}
                  {tarefasDaColuna.length === 1 ? "tarefa concluída" : "tarefas concluídas"}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setConcluidosOcultos(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised/50 py-2 text-xs font-medium text-gaiamum-text transition hover:border-gaiamum-primary hover:text-gaiamum-primary"
              >
                Mostrar cartões
                <IconeChevronBaixo className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <p className="px-0.5 pt-1 text-xs text-gaiamum-text-muted">Nenhuma tarefa concluída ainda.</p>
          )
        ) : (
          <>
            {renderCartoes(visiveis(tarefasDaColuna))}
            {/* Concluído é uma coluna só de "chegada" (pedido do Fabio,
                2026-10-01): nela nunca se cria cartão novo direto, só se
                recebe por arrasto/"Mover para...". Reforçado também no
                servidor (criarTarefa) e por trigger no banco (migration
                0050) — não é só esconder este campo. */}
            {!ehFixa && renderInputNovoCartao(null)}
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
      {/* Cabeçalho do quadro (redesenho 2026-10-05, mockup aprovado):
          progresso → faixa do dia → toolbar. Compacto de propósito — o
          quadro continua sendo o protagonista da tela. */}
      <div className="mb-4 flex flex-col gap-4">
        <ProgressoDoQuadro resumo={resumoProgresso} emFoco={emFoco} />
        <FaixaDoDia
          rotuloHoje={rotuloHoje}
          slotCompromisso={faixaCompromisso ?? null}
          prazos={prazosHoje}
          foco={focoAtivo}
          aoIrParaFoco={() => colunaDeFoco && irParaColuna(colunaDeFoco.id)}
        />
        <BarraFerramentasQuadro
          filtro={filtro}
          aoMudarFiltro={setFiltro}
          etiquetasDoTenant={etiquetasDoTenant}
          aoNovaTarefa={focarNovaTarefa}
          aoAbrirVisaoGeral={() => setVisaoGeralAberta(true)}
        />
        {filtrando && idsVisiveis && (
          <p className="-mt-1 text-xs text-gaiamum-text-muted">
            Mostrando {idsVisiveis.size} de {tarefas.length} cartões.{" "}
            <button
              type="button"
              onClick={() => setFiltro(FILTRO_QUADRO_VAZIO)}
              className="font-medium text-gaiamum-primary underline-offset-2 hover:underline"
            >
              Limpar filtros
            </button>
          </p>
        )}
      </div>

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
      {opcoesNavegacao.length > 0 && (
        <div className="mb-2 hidden items-center gap-2 max-[1023px]:flex [@media(pointer:coarse)]:flex">
          <button
            type="button"
            onClick={() => irParaColuna(opcoesNavegacao[Math.max(0, indiceFoco - 1)].id)}
            disabled={indiceFoco <= 0}
            aria-label="Coluna anterior"
            className="shrink-0 rounded-lg border border-gaiamum-border px-2.5 py-1.5 text-gaiamum-text-muted disabled:opacity-30"
          >
            ‹
          </button>

          <label className="flex min-w-0 flex-1 flex-col items-center">
            <span className="sr-only">Escolher coluna</span>
            <select
              value={opcaoEmFoco?.id ?? ""}
              onChange={(e) => irParaColuna(e.target.value)}
              className="w-full truncate rounded-lg border border-transparent bg-transparent text-center text-sm font-semibold text-gaiamum-text outline-none"
            >
              {opcoesNavegacao.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome} {o.contagem !== null ? `(${o.contagem})` : ""}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-gaiamum-text-muted">
              Coluna {indiceFoco + 1} de {opcoesNavegacao.length}
              {opcaoEmFoco?.contagem !== null ? ` · ${opcaoEmFoco?.contagem} cartão(ões)` : ""}
            </span>
          </label>

          <button
            type="button"
            onClick={() => irParaColuna(opcoesNavegacao[Math.min(opcoesNavegacao.length - 1, indiceFoco + 1)].id)}
            disabled={indiceFoco >= opcoesNavegacao.length - 1}
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

      {/* Barra de navegação horizontal SUPERIOR — pedido de 2026-10-01:
          "hoje o usuário precisa descer até o final das colunas para
          alcançar a barra horizontal". Só a partir de `lg:` (1024px) —
          abaixo disso já existe a barra de navegação por toque (acima),
          que cobre a mesma necessidade; mostrar as duas juntas seria
          redundante. Sincronizada nos 2 sentidos com a rolagem real do
          quadro (efeito acima). Setas "‹ ›" ao lado são um controle visível
          sempre presente — "se barras nativas ficarem ocultas pelo sistema
          operacional [overlay scrollbar, comum no macOS], ofereça controles
          visíveis de navegação como alternativa": não dependem de a
          scrollbar nativa desta barra estar visível pra funcionar. */}
      {todasAsColunasNaOrdem.length > 0 && (
        <div className="mb-2 hidden items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={() => quadroRef.current?.scrollBy({ left: -288, behavior: "smooth" })}
            aria-label="Rolar colunas para a esquerda"
            className="shrink-0 rounded-lg border border-gaiamum-border px-2 py-1 text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-primary"
          >
            ‹
          </button>
          <div ref={barraSuperiorRef} className="min-w-0 flex-1 overflow-x-auto" style={{ height: 14 }}>
            <div style={{ width: larguraTotalQuadro, height: 1 }} />
          </div>
          <button
            type="button"
            onClick={() => quadroRef.current?.scrollBy({ left: 288, behavior: "smooth" })}
            aria-label="Rolar colunas para a direita"
            className="shrink-0 rounded-lg border border-gaiamum-border px-2 py-1 text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-primary"
          >
            ›
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

      {/* `display:grid` + `grid-auto-flow:column` (não `flex`) — pedido de
          2026-10-01: "todas as colunas devem ter altura nivelada pela
          coluna com maior conteúdo renderizado" no desktop/visão ampla.
          `items-stretch` (ativo a partir de `sm:`, mesmo breakpoint que já
          decide "mostrar múltiplas colunas lado a lado") faz o PRÓPRIO
          motor de layout do navegador esticar cada coluna até a altura da
          maior da mesma linha — sem nenhum cálculo em JS, recalculado
          automaticamente a cada render (criar/mover/excluir/filtrar
          cartão). Cada coluna mantém seu teto de altura + scroll próprio
          (ver `renderColuna`), então o nivelamento converge pro teto
          disponível quando alguma coluna o atinge, e por "a mais alta
          delas" quando nenhuma atinge — nunca mais que isso, preservando
          área de drop utilizável nas vazias sem forçar um espaço vazio
          artificial quando não há necessidade.
          No celular em retrato (`items-start`, abaixo de `sm:`) o
          nivelamento fica DESLIGADO de propósito: só 1 coluna é visível por
          vez ali (scroll-snap), então "nivelar com a maior do quadro
          inteiro" obrigaria uma coluna curta a carregar altura vazia de
          uma coluna que nem está na tela — pedido explícito pra evitar
          isso. */}
      <div
        ref={quadroRef}
        className="grid min-w-0 auto-cols-[85vw] grid-flow-col items-start justify-start gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory sm:auto-cols-max sm:items-stretch sm:snap-none"
      >
        {/* `key` + `display:contents` (não afeta o layout de grid) — achado
            incidental pré-existente (não introduzido nesta rodada): React
            exige key quando um elemento solto é intercalado com uma lista
            `.map()` como filhos irmãos do mesmo pai; faltava aqui. */}
        {colunaCompromissos && (
          <div key="coluna-compromissos" className="contents">
            {colunaCompromissos}
          </div>
        )}
        {colunasAbertas.map((coluna) => renderColuna(coluna, false))}
        {colunaFixa && renderColuna(colunaFixa, true)}

        {/* "Concluído é sempre a última coluna de trabalho. O botão
            Adicionar coluna fica DEPOIS de Concluído. Esse botão é um
            controle, não uma coluna reordenável." (2026-10-01) — por isso
            vem depois de `colunaFixa` aqui (antes vinha antes dela), nunca
            participa de `colunasAbertas`/`reordenarColunas`, e o
            posicionamento DELE não decide onde a nova coluna nasce (isso é
            responsabilidade de `criarColunaOtimista`/`criarColuna`, que
            sempre inserem logo depois de "Hoje"). */}
        {criandoColuna ? (
          <div className="flex h-fit w-56 shrink-0 flex-col gap-2 self-start rounded-xl border border-gaiamum-border bg-gaiamum-surface p-3">
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
            title="Nova coluna (nasce logo depois de Hoje, não aqui no fim)"
            className="h-9 w-9 shrink-0 self-start rounded-xl border border-dashed border-gaiamum-border text-lg leading-none text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-primary"
          >
            +
          </button>
        )}
      </div>

      {/* A barra "Cartões concluídos (X/Y)" que ficava aqui no rodapé subiu
          pro cabeçalho (`ProgressoDoQuadro`, mesma fórmula) — redesenho
          2026-10-05: "praticamente escondida na parte inferior". */}

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

      {tarefaIniciandoHiperfocoId &&
        (() => {
          const tarefaParaHiperfoco = tarefas.find((t) => t.id === tarefaIniciandoHiperfocoId);
          if (!tarefaParaHiperfoco) return null;
          return (
            <PopupHiperfocoIniciar
              tituloTarefa={tarefaParaHiperfoco.titulo}
              aoFechar={() => setTarefaIniciandoHiperfocoId(null)}
              aoConfirmar={(minutos) =>
                iniciarHiperfoco(tarefaParaHiperfoco.id, projetoId, minutos).then(() => router.refresh())
              }
            />
          );
        })()}
    </div>
  );
}
