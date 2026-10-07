"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { ItemMenu, MenuSuspenso } from "@/components/ui/menu-suspenso";
import { FormularioCompromisso, FormularioHabito } from "@/components/planner/formularios";
import type { AreaPlanner } from "@/lib/ecc/planner/tipos";

type Criacao = "habito" | "rotina" | "compromisso" | null;

/** "+ Adicionar" (hábito, rotina, compromisso) e "✨ Planejar com IA" do
 * cabeçalho do mockup. A IA do Planner é fase posterior (PEDIDO → PROPOSTA →
 * PREVIEW → CONFIRMAÇÃO): o botão aparece, desabilitado, com "Em breve" —
 * sem integração falsa. */
export function AcoesCabecalhoPlanner({ area = "pessoal" }: { area?: AreaPlanner }) {
  const [criando, setCriando] = useState<Criacao>(null);
  const fechar = () => setCriando(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MenuSuspenso
        rotulo="Adicionar"
        icone={
          <span className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white">
            <span aria-hidden>+</span> Adicionar
          </span>
        }
        classeBotao="bg-gaiamum-primary hover:!bg-gaiamum-primary-dark !text-white"
        itens={(fecharMenu) => (
          <>
            <ItemMenu onClick={() => { fecharMenu(); setCriando("habito"); }}>
              🔁 Hábito
            </ItemMenu>
            <ItemMenu onClick={() => { fecharMenu(); setCriando("rotina"); }}>
              🕗 Rotina com horário
            </ItemMenu>
            <ItemMenu onClick={() => { fecharMenu(); setCriando("compromisso"); }}>
              📅 Compromisso
            </ItemMenu>
          </>
        )}
      />
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Em breve: a IA propõe uma rotina e você revisa antes de qualquer mudança."
        className="flex cursor-not-allowed items-center gap-1.5 rounded-md bg-gaiamum-tag-purple/80 px-4 py-2 text-sm font-medium text-white opacity-70"
      >
        <span aria-hidden>✨</span> Planejar com IA
        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Em breve</span>
      </button>

      {criando === "habito" && (
        <Dialog titulo="Novo hábito" aoFechar={fechar} largura="md">
          <div className="mt-4">
            <FormularioHabito area={area} tipo="habito" aoSalvar={fechar} />
          </div>
        </Dialog>
      )}
      {criando === "rotina" && (
        <Dialog titulo="Nova rotina" aoFechar={fechar} largura="md">
          <div className="mt-4">
            <FormularioHabito area={area} tipo="rotina" aoSalvar={fechar} />
          </div>
        </Dialog>
      )}
      {criando === "compromisso" && (
        <Dialog titulo="Novo compromisso" aoFechar={fechar} largura="md">
          <div className="mt-4">
            <FormularioCompromisso area={area} aoSalvar={fechar} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
