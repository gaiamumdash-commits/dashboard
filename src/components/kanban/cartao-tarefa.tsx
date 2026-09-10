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
} from "@/lib/ecc/tipos";
import { CLASSE_COR_ETIQUETA, CLASSE_PRAZO, urgenciaDoPrazo } from "@/lib/ecc/kanban";
import { atualizarTituloTarefa } from "@/lib/ecc/actions";
import { AvatarIniciais } from "@/components/avatar-iniciais";

/** Cartão em 2 andares: o de cima só renomeia (clique no título vira um
 * campo de texto), o de baixo abre o cartão por dentro. Mover de coluna é
 * só por arrasto (o cartão inteiro é arrastável, os dois andares se movem
 * juntos por serem uma coisa só) — sem atalho de clique, pedido do Fabio
 * pra manter só a dinâmica de arrastar (a única exceção é o seletor de
 * coluna dentro do modal de detalhe, que já existia antes desta mudança).
 *
 * O `draggable`/`onDragStart` nativo abaixo só funciona com mouse — toque
 * não dispara esses eventos. Suporte a toque é uma implementação paralela
 * (não reaproveita a API nativa, que não tem equivalente touch): pressionar
 * e segurar ~300ms confirma que é arrasto (em vez de rolagem ou toque
 * normal), a posição do dedo sobe pro `QuadroKanban` via os 3 callbacks
 * abaixo, que desenham o "fantasma" do cartão e decidem a coluna-alvo por
 * `elementFromPoint`. Ouvintes nativos (não os props sintéticos do React)
 * porque só um `addEventListener` com `{ passive: false }` garante que
 * `preventDefault()` no `touchmove` realmente trava a rolagem da página. */
export function CartaoTarefa({
  tarefa,
  coluna,
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
}: {
  tarefa: Tarefa;
  coluna: ColunaKanban;
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
}) {
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  const cardRef = useRef<HTMLDivElement>(null);
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
    const LIMIAR_MOVIMENTO_PX = 10;

    function onTouchStart(e: TouchEvent) {
      // Dentro do campo de renomear (input aberto): deixa o comportamento
      // nativo de toque em texto (posicionar cursor, selecionar) em paz.
      if ((e.target as HTMLElement).closest("input")) return;
      const toque = e.touches[0];
      estado.x = toque.clientX;
      estado.y = toque.clientY;
      estado.arrastando = false;
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
          window.clearTimeout(estado.timer);
          estado.timer = null;
        }
        return;
      }
      // Arrasto já confirmado: trava a rolagem da página pro gesto inteiro.
      e.preventDefault();
      callbacksRef.current.aoMoverToque(toque.clientX, toque.clientY);
    }

    function onTouchEnd(e: TouchEvent) {
      if (estado.timer !== null) window.clearTimeout(estado.timer);
      if (estado.arrastando) {
        const toque = e.changedTouches[0];
        callbacksRef.current.aoSoltarToque(toque.clientX, toque.clientY);
      }
      estado.arrastando = false;
      estado.timer = null;
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
      if (estado.timer !== null) window.clearTimeout(estado.timer);
    };
  }, []);

  const urgencia = urgenciaDoPrazo(tarefa, coluna.concluido);
  const concluidos = checklistDaTarefa.filter((c) => c.concluido).length;

  function salvarTitulo(novoTitulo: string) {
    setEditandoTitulo(false);
    if (!novoTitulo.trim() || novoTitulo.trim() === tarefa.titulo) return;
    iniciarTransicao(async () => {
      await atualizarTituloTarefa(tarefa.id, projetoId, novoTitulo);
      router.refresh();
    });
  }

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/tarefa-id", tarefa.id)}
      className={`cursor-grab overflow-hidden rounded-xl border-2 bg-gaiamum-surface-raised shadow-sm transition hover:shadow-md active:cursor-grabbing ${
        souResponsavel ? "border-gaiamum-border-forte border-l-4 border-l-gaiamum-primary" : "border-gaiamum-border-forte"
      } ${emArrastoToque ? "opacity-40" : ""}`}
    >
      {/* Traço de urgência — só em P1, pedido do Fabio pra chamar mais
          atenção nos cartões mais urgentes. bg-gaiamum-danger é fixo
          (#ef4444) nos 3 temas, já com contraste ok em claro e escuro. */}
      {tarefa.prioridade === "P1" && <div className="h-1.5 bg-gaiamum-danger" />}

      {/* Andar 1 — título, só renomeia */}
      <div className="flex items-center gap-1.5 border-b border-gaiamum-border-forte bg-gaiamum-titulo-cartao px-3 py-1.5">
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
        {podeExcluir && (
          <button
            type="button"
            onClick={onExcluir}
            className="shrink-0 text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
          >
            ✕
          </button>
        )}
      </div>

      {/* Andar 2 — corpo do cartão, abre o modal */}
      <div onClick={onAbrir} className="cursor-pointer p-3">
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
        </div>

        {membrosDaTarefa.length > 0 && (
          <div className="mt-2 flex -space-x-1.5">
            {membrosDaTarefa.map((tm) => {
              const membro = membrosDoTenant.find((m) => m.user_id === tm.user_id);
              return <AvatarIniciais key={tm.id} email={membro?.email ?? "?"} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
