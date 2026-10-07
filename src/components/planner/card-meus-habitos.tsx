"use client";

import { BotaoDialogo } from "@/components/planner/botao-dialogo";
import { CLASSE_BOTAO_RODAPE_CARD } from "@/components/planner/estilos";
import { FormularioHabito } from "@/components/planner/formularios";
import { GradeHabitos } from "@/components/planner/grade-habitos";
import type { HabitoPlanner, RegistroHabito } from "@/lib/ecc/planner/tipos";

/** Card "Meus hábitos" da visão geral — todos os hábitos ativos (de todas
 * as áreas), semana atual. */
export function CardMeusHabitos({
  habitos,
  registros,
  segunda,
  hoje,
}: {
  habitos: HabitoPlanner[];
  registros: RegistroHabito[];
  segunda: string;
  hoje: string;
}) {
  return (
    <section className="flex h-full flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-gaiamum-success/15 text-lg">
          📊
        </span>
        <div>
          <h2 className="font-semibold text-gaiamum-text">Meus hábitos</h2>
          <p className="text-xs text-gaiamum-text-muted">Esta semana</p>
        </div>
      </div>

      {habitos.length === 0 ? (
        <p className="py-6 text-center text-sm text-gaiamum-text-muted">
          Nenhum hábito ainda. Comece com um só — beber água, ler 10 minutos.
        </p>
      ) : (
        <GradeHabitos habitos={habitos} registros={registros} segunda={segunda} hoje={hoje} mostrarArea />
      )}

      <BotaoDialogo
        titulo="Novo hábito"
        className={CLASSE_BOTAO_RODAPE_CARD}
        rotulo={
          <>
            <span aria-hidden>+</span> Adicionar hábito
          </>
        }
      >
        {(fechar) => <FormularioHabito area="pessoal" tipo="habito" aoSalvar={fechar} />}
      </BotaoDialogo>
    </section>
  );
}
