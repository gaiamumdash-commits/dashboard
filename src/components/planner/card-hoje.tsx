"use client";

import Link from "next/link";
import { BotaoDialogo } from "@/components/planner/botao-dialogo";
import { CLASSE_BOTAO_RODAPE_CARD } from "@/components/planner/estilos";
import { FormularioCompromisso } from "@/components/planner/formularios";
import { LinhaItemDia } from "@/components/planner/lista-itens-dia";
import type { ItemDia } from "@/lib/ecc/planner/painel";

/** Card "Hoje" do mockup: o dia em ordem de horário, juntando rotinas e
 * compromissos do Planner com a Agenda real (Google, tarefas com prazo,
 * contas, decisões). "Ver agenda" abre a Agenda do Gaiamum — o Planner não
 * tem agenda própria. */
export function CardHoje({
  hoje,
  rotuloData,
  itens,
  agendaIndisponivel,
}: {
  hoje: string;
  rotuloData: string;
  itens: ItemDia[];
  /** Quem entrou só num quadro não tem a Agenda do workspace. */
  agendaIndisponivel: boolean;
}) {
  return (
    <section className="flex h-full flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-gaiamum-primary/15 text-lg">
            📅
          </span>
          <div>
            <h2 className="font-semibold text-gaiamum-text">Hoje</h2>
            <p className="text-xs text-gaiamum-text-muted">{rotuloData}</p>
          </div>
        </div>
        {!agendaIndisponivel && (
          <Link
            href="/agenda?visao=dia"
            className="shrink-0 rounded-lg border border-gaiamum-border px-3 py-1.5 text-xs font-medium text-gaiamum-text hover:bg-gaiamum-surface-raised"
          >
            Ver agenda →
          </Link>
        )}
      </div>

      {itens.length === 0 ? (
        <p className="py-6 text-center text-sm text-gaiamum-text-muted">Nada marcado pra hoje.</p>
      ) : (
        <ul className="divide-y divide-gaiamum-border">
          {itens.map((item) => (
            <LinhaItemDia key={item.chave} item={item} data={hoje} />
          ))}
        </ul>
      )}

      <BotaoDialogo
        titulo="Nova atividade"
        className={CLASSE_BOTAO_RODAPE_CARD}
        rotulo={
          <>
            <span aria-hidden>+</span> Adicionar atividade de hoje
          </>
        }
      >
        {(fechar) => <FormularioCompromisso area="pessoal" aoSalvar={fechar} />}
      </BotaoDialogo>
    </section>
  );
}
