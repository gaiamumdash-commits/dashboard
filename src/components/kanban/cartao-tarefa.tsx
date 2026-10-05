"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type {
  Anexo,
  ChecklistItem,
  ColunaKanban,
  Etiqueta,
  MembroTenant,
  Tarefa,
  TarefaEtiqueta,
  TarefaMembro,
  Turno,
} from "@/lib/ecc/tipos";
import { CLASSE_COR_ETIQUETA, CLASSE_PRAZO, estadoHiperfoco, minutosRestantesHiperfoco, tocarAlarmeHiperfoco, urgenciaDoPrazo } from "@/lib/ecc/kanban";
import { atualizarTituloTarefa, encerrarHiperfoco, renovarHiperfoco } from "@/lib/ecc/actions";
import { AvatarIniciais } from "@/components/avatar-iniciais";
import { MoverParaMenu } from "@/components/kanban/mover-para-menu";
import { PopupHiperfocoVencido } from "@/components/kanban/popup-hiperfoco-vencido";

const TURNOS: { valor: Turno; rotulo: string }[] = [
  { valor: "manha", rotulo: "🌅 Manhã" },
  { valor: "tarde", rotulo: "🌤️ Tarde" },
  { valor: "noite", rotulo: "🌙 Noite" },
];

/** Cartão em 2 andares: o de cima só renomeia (clique no título vira um
 * campo de texto), o de baixo abre o cartão por dentro. Mover de coluna é
 * por arrasto OU pelo menu "Mover para..." (ver `MoverParaMenu`) — os dois
 * caminhos convivem, pedido explícito do Fabio (2026-09-30): o arrasto
 * mobile FUNCIONA e deve ser PRESERVADO/MELHORADO, "Mover para..." é uma
 * ALTERNATIVA pras operações difíceis por arrasto (ex.: fim → início de uma
 * coluna longa), nunca um substituto.
 *
 * Toque: dois caminhos pra iniciar arrasto, sem ambiguidade entre eles —
 * achado real da sessão anterior (2026-09-30): "começar a rolar devagar
 * dispara arrasto por engano" acontecia porque QUALQUER toque no cartão
 * (inclusive o começo de uma rolagem) entrava na corrida contra o
 * temporizador de long-press.
 *   1. Alça dedicada (⠿, canto esquerdo do andar de cima): inicia arrasto
 *      IMEDIATO ao toque, sem espera — forma "clara e precisa" pedida pelo
 *      Fabio, sem ambiguidade nenhuma com rolagem (só arrasta quem tocou
 *      exatamente ali).
 *   2. Pressionar e segurar em qualquer parte do cartão (~300ms, como já
 *      era): preservado como estava, mas agora cancela o temporizador
 *      também se o CONTAINER da coluna disparar um evento de rolagem real
 *      enquanto o toque ainda está pendente — cobre o caso de o navegador
 *      já estar rolando (inércia) mesmo com o dedo quase parado.
 * `draggable`/`onDragStart` nativo (abaixo) continua só pra mouse — não
 * muda nesta rodada, mouse nunca teve essa ambiguidade com rolagem. */
export function CartaoTarefa({
  tarefa,
  coluna,
  colunasDoProjeto,
  projetoId,
  checklistDaTarefa,
  anexosDaTarefa,
  membrosDaTarefa,
  membrosDoTenant,
  etiquetasDaTarefa,
  etiquetasDoTenant,
  souResponsavel,
  podeExcluir,
  onAbrir,
  onExcluir,
  aoIniciarArrastoToque,
  aoMoverToque,
  aoSoltarToque,
  emArrastoToque,
  aoSoltarSobre,
  indicadorDrop,
  aoMoverPara,
}: {
  tarefa: Tarefa;
  coluna: ColunaKanban;
  /** Todas as colunas do projeto (aberta + fixa) — alimenta o menu "Mover
   * para...", que precisa listar todas as opções de destino. */
  colunasDoProjeto: ColunaKanban[];
  projetoId: string;
  checklistDaTarefa: ChecklistItem[];
  anexosDaTarefa: Anexo[];
  membrosDaTarefa: TarefaMembro[];
  membrosDoTenant: MembroTenant[];
  etiquetasDaTarefa: TarefaEtiqueta[];
  etiquetasDoTenant: Etiqueta[];
  souResponsavel: boolean;
  podeExcluir: boolean;
  onAbrir: () => void;
  onExcluir: () => void;
  aoIniciarArrastoToque: (x: number, y: number) => void;
  aoMoverToque: (x: number, y: number) => void;
  aoSoltarToque: (x: number, y: number) => void;
  emArrastoToque: boolean;
  /** Solto em cima de outro cartão (não na coluna vazia) — reordena dentro
   * da coluna, na posição exata onde soltou (metade de cima = antes, metade
   * de baixo = depois), não só troca de coluna. */
  aoSoltarSobre: (tarefaArrastadaId: string, posicao: "antes" | "depois") => void;
  /** Durante o arrasto por TOQUE de outro cartão, se ESTE cartão é o alvo
   * (mouse por cima dele) — mesma indicação visual que o D&D nativo já
   * mostra via `onDragOver`, pra "clareza e precisão" também no toque. */
  indicadorDrop?: "antes" | "depois" | null;
  /** Alternativa ao arrasto — move (ou reordena pro início/fim da mesma
   * coluna) sem precisar arrastar nada. */
  aoMoverPara: (novaColunaId: string, turno: Turno | null, extremidade: "inicio" | "fim") => void;
}) {
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [posicaoDrop, setPosicaoDrop] = useState<"antes" | "depois" | null>(null);
  const [menuMoverAberto, setMenuMoverAberto] = useState(false);
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  const cardRef = useRef<HTMLDivElement>(null);
  const alcaRef = useRef<HTMLButtonElement>(null);
  // true logo depois de um arrasto por toque terminar — suprime o "clique
  // fantasma" que o navegador dispara depois de touchend, que abriria o
  // modal de detalhe sem querer assim que o dedo solta o cartão.
  const suprimirProximoCliqueRef = useRef(false);
  // Sempre aponta pros callbacks mais recentes sem forçar o efeito abaixo a
  // reanexar os ouvintes a cada render (as funções recebidas via prop
  // nascem de novo a cada vez, já que são closures fechadas sobre `tarefa`).
  const callbacksRef = useRef({ aoIniciarArrastoToque, aoMoverToque, aoSoltarToque });
  useEffect(() => {
    callbacksRef.current = { aoIniciarArrastoToque, aoMoverToque, aoSoltarToque };
  });

  useEffect(() => {
    const elemento = cardRef.current;
    if (!elemento) return;

    const estado = { x: 0, y: 0, timer: null as number | null, arrastando: false };
    const LIMIAR_ESPERA_MS = 300;
    const LIMIAR_MOVIMENTO_PX = 8;
    let containerRolavel: HTMLElement | null = null;

    function cancelarTimerPendente() {
      if (estado.timer !== null) {
        window.clearTimeout(estado.timer);
        estado.timer = null;
      }
      if (containerRolavel) {
        containerRolavel.removeEventListener("scroll", cancelarPorRolagemReal);
        containerRolavel = null;
      }
    }

    // Se o container da coluna realmente rolou (o navegador já processou
    // rolagem nativa) enquanto o long-press ainda estava "pensando",
    // cancela o arrasto — é rolagem, não arrasto, mesmo que o dedo pareça
    // quase parado (rolagem com inércia se move sem o dedo acompanhar 1:1).
    function cancelarPorRolagemReal() {
      if (!estado.arrastando) cancelarTimerPendente();
    }

    function onTouchStart(e: TouchEvent) {
      // Dentro do campo de renomear (input aberto) ou de um controle
      // próprio (alça, menu "Mover para...", excluir): deixa o
      // comportamento nativo de cada um em paz, sem competir por arrasto.
      if ((e.target as HTMLElement).closest("input, [data-sem-arrasto]")) return;
      const toque = e.touches[0];
      estado.x = toque.clientX;
      estado.y = toque.clientY;
      estado.arrastando = false;
      containerRolavel = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-coluna-id]");
      containerRolavel?.addEventListener("scroll", cancelarPorRolagemReal, { passive: true });
      estado.timer = window.setTimeout(() => {
        estado.arrastando = true;
        navigator.vibrate?.(15);
        callbacksRef.current.aoIniciarArrastoToque(toque.clientX, toque.clientY);
      }, LIMIAR_ESPERA_MS);
    }

    function onTouchMove(e: TouchEvent) {
      const toque = e.touches[0];
      if (!estado.arrastando) {
        // Ainda esperando confirmar o "segurar": se o dedo já andou demais,
        // é rolagem normal — cancela o timer e deixa o navegador rolar.
        if (
          estado.timer !== null &&
          (Math.abs(toque.clientX - estado.x) > LIMIAR_MOVIMENTO_PX || Math.abs(toque.clientY - estado.y) > LIMIAR_MOVIMENTO_PX)
        ) {
          cancelarTimerPendente();
        }
        return;
      }
      // Arrasto já confirmado: trava a rolagem da página pro gesto inteiro.
      e.preventDefault();
      callbacksRef.current.aoMoverToque(toque.clientX, toque.clientY);
    }

    function onTouchEnd(e: TouchEvent) {
      cancelarTimerPendente();
      if (estado.arrastando) {
        const toque = e.changedTouches[0];
        callbacksRef.current.aoSoltarToque(toque.clientX, toque.clientY);
        suprimirProximoCliqueRef.current = true;
        window.setTimeout(() => {
          suprimirProximoCliqueRef.current = false;
        }, 400);
      }
      estado.arrastando = false;
    }

    elemento.addEventListener("touchstart", onTouchStart, { passive: true });
    elemento.addEventListener("touchmove", onTouchMove, { passive: false });
    elemento.addEventListener("touchend", onTouchEnd, { passive: true });
    elemento.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      elemento.removeEventListener("touchstart", onTouchStart);
      elemento.removeEventListener("touchmove", onTouchMove);
      elemento.removeEventListener("touchend", onTouchEnd);
      elemento.removeEventListener("touchcancel", onTouchEnd);
      cancelarTimerPendente();
    };
  }, []);

  // Alça dedicada (⠿) — inicia arrasto na hora, sem esperar 300ms: quem
  // tocou ali já demonstrou intenção clara de arrastar (a área é pequena e
  // separada do resto do cartão, então não compete com rolagem/toque
  // normal). Ouvintes nativos, mesmo motivo do resto do arquivo:
  // `preventDefault` em touchmove só funciona com `{ passive: false }`.
  useEffect(() => {
    const alca = alcaRef.current;
    if (!alca) return;

    function onTouchStart(e: TouchEvent) {
      e.stopPropagation();
      const toque = e.touches[0];
      navigator.vibrate?.(15);
      callbacksRef.current.aoIniciarArrastoToque(toque.clientX, toque.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      e.stopPropagation();
      const toque = e.touches[0];
      callbacksRef.current.aoMoverToque(toque.clientX, toque.clientY);
    }
    function onTouchEnd(e: TouchEvent) {
      e.stopPropagation();
      const toque = e.changedTouches[0];
      callbacksRef.current.aoSoltarToque(toque.clientX, toque.clientY);
      suprimirProximoCliqueRef.current = true;
      window.setTimeout(() => {
        suprimirProximoCliqueRef.current = false;
      }, 400);
    }

    alca.addEventListener("touchstart", onTouchStart, { passive: true });
    alca.addEventListener("touchmove", onTouchMove, { passive: false });
    alca.addEventListener("touchend", onTouchEnd, { passive: true });
    alca.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      alca.removeEventListener("touchstart", onTouchStart);
      alca.removeEventListener("touchmove", onTouchMove);
      alca.removeEventListener("touchend", onTouchEnd);
      alca.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const urgencia = urgenciaDoPrazo(tarefa, coluna.concluido);
  const concluidos = checklistDaTarefa.filter((c) => c.concluido).length;

  // Temporizador de hiperfoco (migration 0052) — recalculado a partir de 2
  // timestamps absolutos, nunca de um timer relativo guardado só em
  // memória (sobrevive a reload). `[, forcarRecalculo]` força um re-render
  // periódico SÓ enquanto este cartão tem um timer ativo — não cria
  // interval nenhum nos outros cartões.
  const [, forcarRecalculo] = useState(0);
  const [popupVencidoAberto, setPopupVencidoAberto] = useState(false);
  const avisouEsgotadoRef = useRef<string | null>(null);
  const hiperfoco = estadoHiperfoco(tarefa.hiperfoco_iniciado_em, tarefa.tempo_estimado_min);

  useEffect(() => {
    if (!tarefa.hiperfoco_iniciado_em) return;
    const id = window.setInterval(() => forcarRecalculo((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, [tarefa.hiperfoco_iniciado_em]);

  useEffect(() => {
    // Dispara o alarme e abre o popup de renovação só 1 vez por "ciclo" do
    // timer (chave = `hiperfoco_iniciado_em`) — sem isso, o interval acima
    // reabriria o popup a cada 15s enquanto a pessoa ainda está decidindo.
    if (hiperfoco === "esgotado" && tarefa.hiperfoco_iniciado_em && avisouEsgotadoRef.current !== tarefa.hiperfoco_iniciado_em) {
      avisouEsgotadoRef.current = tarefa.hiperfoco_iniciado_em;
      tocarAlarmeHiperfoco();
      setPopupVencidoAberto(true);
    }
  }, [hiperfoco, tarefa.hiperfoco_iniciado_em]);

  function renovarHiperfocoDaTarefa(minutos: number) {
    return renovarHiperfoco(tarefa.id, projetoId, minutos).then(() => router.refresh());
  }

  function pararHiperfocoDaTarefa() {
    return encerrarHiperfoco(tarefa.id, projetoId).then(() => router.refresh());
  }

  function salvarTitulo(novoTitulo: string) {
    setEditandoTitulo(false);
    if (!novoTitulo.trim() || novoTitulo.trim() === tarefa.titulo) return;
    iniciarTransicao(async () => {
      await atualizarTituloTarefa(tarefa.id, projetoId, novoTitulo);
      router.refresh();
    });
  }

  function aoClicarAbrir() {
    if (suprimirProximoCliqueRef.current) return;
    onAbrir();
  }

  return (
    <div
      ref={cardRef}
      data-tarefa-id={tarefa.id}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/tarefa-id", tarefa.id)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("text/tarefa-id")) return;
        e.preventDefault();
        e.stopPropagation();
        const meio = e.currentTarget.getBoundingClientRect().top + e.currentTarget.getBoundingClientRect().height / 2;
        setPosicaoDrop(e.clientY < meio ? "antes" : "depois");
      }}
      onDragLeave={() => setPosicaoDrop(null)}
      onDrop={(e) => {
        const tarefaArrastadaId = e.dataTransfer.getData("text/tarefa-id");
        if (!tarefaArrastadaId || tarefaArrastadaId === tarefa.id) {
          setPosicaoDrop(null);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        aoSoltarSobre(tarefaArrastadaId, posicaoDrop ?? "depois");
        setPosicaoDrop(null);
      }}
      className={`relative cursor-grab overflow-visible rounded-xl border-2 bg-gaiamum-surface-raised shadow-sm transition hover:shadow-md active:cursor-grabbing ${
        souResponsavel ? "border-gaiamum-border-forte border-l-4 border-l-gaiamum-primary" : "border-gaiamum-border-forte"
      } ${emArrastoToque ? "opacity-40" : ""} ${
        (posicaoDrop ?? indicadorDrop) === "antes"
          ? "border-t-2 border-t-gaiamum-primary"
          : (posicaoDrop ?? indicadorDrop) === "depois"
            ? "border-b-2 border-b-gaiamum-primary"
            : ""
      } ${
        // Cronômetro de foco (migration 0052) — `!` força a prioridade sobre
        // as classes de borda acima (responsável/drop), que usam a mesma
        // propriedade CSS. "esgotado" sempre prevalece sobre "metade".
        hiperfoco === "esgotado"
          ? "!border-gaiamum-danger"
          : hiperfoco === "metade"
            ? "!border-gaiamum-warning bg-gaiamum-warning/10"
            : ""
      }`}
    >
      <div className="overflow-hidden rounded-[10px]">
        {/* Traço de urgência — só em P1, pedido do Fabio pra chamar mais
            atenção nos cartões mais urgentes. bg-gaiamum-danger é fixo
            (#ef4444) nos 3 temas, já com contraste ok em claro e escuro. */}
        {tarefa.prioridade === "P1" && <div className="h-1.5 bg-gaiamum-danger" />}

        {/* Andar 1 — título, só renomeia */}
        <div className="flex items-center gap-1 border-b border-gaiamum-border-forte bg-gaiamum-titulo-cartao px-2 py-1.5">
          <button
            ref={alcaRef}
            type="button"
            data-sem-arrasto
            title="Arrastar cartão"
            aria-label="Arrastar cartão"
            // Alvo de toque de 44×44px em qualquer dispositivo de toque
            // (critério de acessibilidade padrão iOS/Android) — achado real
            // (2026-10-04, Fabio: "tenho muita dificuldade de... colocar o
            // cartão, não tá fluido"): antes era só `px-1 py-1` com um ícone
            // `text-sm`, bem menor que isso, fácil de errar o toque com o
            // dedo (precisão de mouse ≠ precisão de dedo). Em mouse
            // (`pointer:fine`) continua compacto — não precisa do mesmo
            // tamanho generoso, e um alvo grande ali só ocuparia espaço à
            // toa no cabeçalho do cartão.
            className="flex shrink-0 cursor-grab touch-none items-center justify-center rounded text-gaiamum-text-muted active:cursor-grabbing sm:hover:text-gaiamum-text [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 [@media(pointer:coarse)]:text-lg [@media(pointer:fine)]:px-1 [@media(pointer:fine)]:py-1 [@media(pointer:fine)]:text-sm [@media(pointer:fine)]:leading-none"
            style={{ touchAction: "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            ⠿
          </button>
          {coluna.concluido && (
            <Image
              src="/brand/crab-mark.png"
              alt=""
              width={14}
              height={14}
              className="shrink-0"
              title="Concluído!"
            />
          )}
          {editandoTitulo ? (
            <input
              autoFocus
              defaultValue={tarefa.titulo}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => salvarTitulo(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditandoTitulo(false);
              }}
              className="w-full rounded border border-gaiamum-primary bg-gaiamum-surface-raised px-1.5 py-0.5 text-sm text-gaiamum-text outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditandoTitulo(true)}
              title="Clique para renomear"
              className="flex-1 truncate text-left text-sm font-medium text-gaiamum-text hover:text-gaiamum-primary"
            >
              {tarefa.titulo}
            </button>
          )}
          <button
            type="button"
            data-sem-arrasto
            onClick={(e) => {
              e.stopPropagation();
              setMenuMoverAberto((atual) => !atual);
            }}
            title="Mover para..."
            aria-label="Mover para outra coluna, turno ou posição"
            className="shrink-0 rounded px-1 py-1 text-xs text-gaiamum-text-muted hover:text-gaiamum-primary"
          >
            ⇄
          </button>
          {podeExcluir && (
            <button
              type="button"
              data-sem-arrasto
              onClick={(e) => {
                e.stopPropagation();
                onExcluir();
              }}
              className="shrink-0 text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
            >
              ✕
            </button>
          )}
        </div>

        {/* Andar 2 — corpo do cartão, abre o modal */}
        <div onClick={aoClicarAbrir} className="cursor-pointer p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
              {tarefa.prioridade}
            </span>
            {tarefa.is_marco && (
              <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
                🚩 Marco
              </span>
            )}
            {etiquetasDaTarefa.map((te) => {
              const etiqueta = etiquetasDoTenant.find((e) => e.id === te.etiqueta_id);
              if (!etiqueta) return null;
              return (
                <span key={te.id} className={`rounded-full border px-2 py-0.5 ${CLASSE_COR_ETIQUETA[etiqueta.cor]}`}>
                  {etiqueta.nome}
                </span>
              );
            })}
            {tarefa.data_limite && (
              <span className={`rounded-full border px-2 py-0.5 ${CLASSE_PRAZO[urgencia]}`}>
                {new Date(tarefa.data_limite).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
            {tarefa.hiperfoco_iniciado_em && tarefa.tempo_estimado_min && (
              <span
                className={`rounded-full border px-2 py-0.5 ${
                  hiperfoco === "esgotado"
                    ? "border-gaiamum-danger text-gaiamum-danger"
                    : hiperfoco === "metade"
                      ? "border-gaiamum-warning text-gaiamum-warning"
                      : "border-gaiamum-border text-gaiamum-text-muted"
                }`}
                title="Cronômetro de foco"
              >
                ⏱{" "}
                {hiperfoco === "esgotado"
                  ? "esgotado"
                  : `${minutosRestantesHiperfoco(tarefa.hiperfoco_iniciado_em, tarefa.tempo_estimado_min)} min restantes`}
              </span>
            )}
            {checklistDaTarefa.length > 0 && (
              <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
                ☑ {concluidos}/{checklistDaTarefa.length}
              </span>
            )}
            {anexosDaTarefa.length > 0 && (
              <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
                📎 {anexosDaTarefa.length}
              </span>
            )}
            {tarefa.aguardando_de && (
              <span
                title={tarefa.aguardando_de}
                className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted"
              >
                🕓 Aguardando
              </span>
            )}
          </div>

          {membrosDaTarefa.length > 0 && (
            <div className="mt-2 flex -space-x-1.5">
              {membrosDaTarefa.map((tm) => {
                const membro = membrosDoTenant.find((m) => m.user_id === tm.user_id);
                return <AvatarIniciais key={tm.id} email={membro?.email ?? null} nomeExibicao={membro?.nome_exibicao} />;
              })}
            </div>
          )}
        </div>
      </div>

      {menuMoverAberto && (
        <MoverParaMenu
          colunaAtualId={tarefa.coluna_id}
          turnoAtual={tarefa.turno ?? null}
          colunasDoProjeto={colunasDoProjeto}
          turnos={TURNOS}
          aoEscolher={(colunaId, turno, extremidade) => {
            setMenuMoverAberto(false);
            aoMoverPara(colunaId, turno, extremidade);
          }}
          aoFechar={() => setMenuMoverAberto(false)}
        />
      )}

      {popupVencidoAberto && (
        <PopupHiperfocoVencido
          tituloTarefa={tarefa.titulo}
          aoFechar={() => setPopupVencidoAberto(false)}
          aoRenovar={renovarHiperfocoDaTarefa}
          aoParar={pararHiperfocoDaTarefa}
        />
      )}
    </div>
  );
}
