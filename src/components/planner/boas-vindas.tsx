"use client";

import { useState } from "react";
import { salvarPreferenciasPlanner } from "@/lib/ecc/planner/actions";
import { ICONE_AREA, ROTULO_AREA } from "@/lib/ecc/planner/regras";
import { AREAS_PLANNER, type AreaPlanner } from "@/lib/ecc/planner/tipos";
import { BotaoDialogo } from "@/components/planner/botao-dialogo";
import { FormularioHabito } from "@/components/planner/formularios";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_PRIMARIO, CLASSE_BOTAO_SECUNDARIO } from "@/components/planner/estilos";

/** Primeiro acesso (sem preferências salvas e sem nenhum dado): explicação
 * curta + escolha rápida das áreas. Nada é obrigatório — "Começar" com
 * nenhuma marcada mostra as 4 áreas. Nunca mostra painel com dado falso. */
export function BoasVindasPlanner() {
  const { pendente, executar } = useAcaoPlanner();
  const [areas, setAreas] = useState<AreaPlanner[]>([]);

  function alternar(area: AreaPlanner) {
    setAreas((atual) => (atual.includes(area) ? atual.filter((a) => a !== area) : [...atual, area]));
  }

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-gaiamum-border bg-gradient-to-br from-gaiamum-primary/15 via-gaiamum-surface to-gaiamum-surface p-6 sm:p-8">
      <div>
        <h2 className="text-xl font-semibold text-gaiamum-text">Seu Planner ainda está vazio.</h2>
        <p className="mt-1 max-w-2xl text-gaiamum-text-muted">
          Seu Planner conecta rotina, hábitos e áreas da sua vida ao restante do Gaiamum. Ele é só seu: ninguém do seu
          workspace vê o que você coloca aqui.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-gaiamum-text">O que você quer organizar primeiro?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AREAS_PLANNER.map((area) => {
            const marcada = areas.includes(area);
            return (
              <label
                key={area}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gaiamum-primary/40 ${
                  marcada ? "border-gaiamum-primary bg-gaiamum-primary/10 text-gaiamum-text" : "border-gaiamum-border text-gaiamum-text"
                }`}
              >
                <input type="checkbox" checked={marcada} onChange={() => alternar(area)} className="h-4 w-4 accent-[var(--gaiamum-primary)]" />
                <span aria-hidden>{ICONE_AREA[area]}</span>
                {ROTULO_AREA[area]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <BotaoDialogo titulo="Meu primeiro hábito" className={CLASSE_BOTAO_PRIMARIO} rotulo="Criar meu primeiro hábito">
          {(fechar) => (
            <FormularioHabito
              area={areas[0] ?? "pessoal"}
              tipo="habito"
              aoSalvar={() => {
                fechar();
                executar(() => salvarPreferenciasPlanner(areas));
              }}
            />
          )}
        </BotaoDialogo>
        <button
          type="button"
          disabled={pendente}
          onClick={() => executar(() => salvarPreferenciasPlanner(areas))}
          className={CLASSE_BOTAO_SECUNDARIO}
        >
          {pendente ? "Salvando..." : "Começar sem criar nada"}
        </button>
        <span
          className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text-muted"
          title="Em breve: a IA monta uma proposta de rotina e você revisa antes de salvar."
        >
          ✨ Planejar minha rotina com IA · Em breve
        </span>
      </div>
    </section>
  );
}
