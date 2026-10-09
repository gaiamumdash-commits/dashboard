"use client";

import { useState } from "react";
import { definirHabitoAtivo, excluirHabito, marcarHabitoNoDia } from "@/lib/ecc/planner/actions";
import {
  descreverDias,
  formatarDataCurta,
  horarioCurto,
  LETRA_DIA,
  NOME_DIA,
  semanaDoHabito,
  type EstadoDiaHabito,
} from "@/lib/ecc/planner/regras";
import type { HabitoPlanner, RegistroHabito } from "@/lib/ecc/planner/tipos";
import { Dialog } from "@/components/ui/dialog";
import { ItemMenu, MenuSuspenso } from "@/components/ui/menu-suspenso";
import { FormularioHabito } from "@/components/planner/formularios";
import { ICONE_AREA } from "@/lib/ecc/planner/regras";
import { useAcaoPlanner } from "@/components/planner/uso-acao";

/** Uma bolinha da grade (um hábito num dia). Feito = círculo cheio com ✓;
 * planejado e a fazer = círculo vazio com borda forte; não planejado =
 * borda pontilhada clarinha (dá pra marcar mesmo assim); dia futuro =
 * desabilitado. Estado sempre no `aria-label`, nunca só na cor. */
function BolinhaDia({ habito, dia }: { habito: Pick<HabitoPlanner, "id" | "nome">; dia: EstadoDiaHabito }) {
  const { pendente, executar } = useAcaoPlanner();
  const [otimista, setOtimista] = useState(dia.feito);
  const [anterior, setAnterior] = useState(dia.feito);
  if (dia.feito !== anterior) {
    setAnterior(dia.feito);
    setOtimista(dia.feito);
  }

  const nomeDia = `${NOME_DIA[dia.diaIso - 1]}, ${formatarDataCurta(dia.data)}`;
  const estado = otimista ? "feito" : dia.futuro ? "ainda não chegou" : dia.planejado ? "a fazer" : "não planejado";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={otimista}
      aria-label={`${habito.nome} — ${nomeDia}: ${estado}`}
      title={`${nomeDia}: ${estado}`}
      disabled={dia.futuro || pendente}
      onClick={() => {
        const novo = !otimista;
        setOtimista(novo);
        executar(() => marcarHabitoNoDia(habito.id, dia.data, novo), { desfazer: () => setOtimista(!novo) });
      }}
      className={`mx-auto flex h-5 w-5 items-center sm:h-6 sm:w-6 justify-center rounded-full text-[11px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gaiamum-primary disabled:cursor-not-allowed ${
        otimista
          ? "bg-gaiamum-success text-white"
          : dia.planejado
            ? `border-2 border-gaiamum-border-forte text-transparent ${dia.futuro ? "opacity-40" : "hover:border-gaiamum-success"}`
            : `border border-dashed border-gaiamum-border text-transparent ${dia.futuro ? "opacity-30" : "hover:border-gaiamum-success"}`
      }`}
    >
      ✓
    </button>
  );
}

/** "Editar" sempre visível (corrigir dias, horário, nome); com `completo`,
 * também o menu ⋯ (arquivar, excluir). */
function AcoesHabito({ habito, completo }: { habito: HabitoPlanner; completo: boolean }) {
  const { executar } = useAcaoPlanner();
  const [editando, setEditando] = useState(false);
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setEditando(true)}
        aria-label={`Editar ${habito.nome}`}
        title="Editar"
        className="rounded px-1.5 py-0.5 text-xs text-gaiamum-primary hover:bg-gaiamum-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gaiamum-primary"
      >
        <span aria-hidden>✎</span>
        {completo && <span className="ml-1 hidden sm:inline">Editar</span>}
      </button>
      {completo && <MenuSuspenso
        rotulo={`Ações de ${habito.nome}`}
        icone={<span className="px-1.5 text-base leading-none">⋯</span>}
        itens={(fechar) => (
          <>
            <ItemMenu
              onClick={() => {
                fechar();
                executar(() => definirHabitoAtivo(habito.id, !habito.ativo), { sucesso: habito.ativo ? "Arquivado." : "Reativado." });
              }}
            >
              {habito.ativo ? "Arquivar" : "Reativar"}
            </ItemMenu>
            <ItemMenu
              perigo
              onClick={() => {
                fechar();
                if (window.confirm(`Excluir "${habito.nome}" e todo o histórico dele? Pra só parar de acompanhar, use Arquivar.`)) {
                  executar(() => excluirHabito(habito.id), { sucesso: "Excluído." });
                }
              }}
            >
              Excluir
            </ItemMenu>
          </>
        )}
      />}
      {editando && (
        <Dialog titulo={habito.tipo === "rotina" ? "Editar rotina" : "Editar hábito"} aoFechar={() => setEditando(false)} largura="md">
          <div className="mt-4">
            <FormularioHabito area={habito.area} tipo={habito.tipo} habito={habito} aoSalvar={() => setEditando(false)} />
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** Grade semanal S T Q Q S S D do mockup ("Meus hábitos"). Toda linha tem
 * "Editar" (✎) visível; com `gerenciar`, ganha também o menu ⋯ (arquivar,
 * excluir) e o resumo dos dias/horário — é a mesma grade nas telas das áreas. */
export function GradeHabitos({
  habitos,
  registros,
  segunda,
  hoje,
  gerenciar = false,
  mostrarArea = false,
}: {
  habitos: HabitoPlanner[];
  registros: RegistroHabito[];
  segunda: string;
  hoje: string;
  gerenciar?: boolean;
  mostrarArea?: boolean;
}) {
  return (
    <div className="relative -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[17rem] border-separate border-spacing-y-1.5 text-sm">
        <caption className="sr-only">Hábitos da semana, de segunda a domingo</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left font-normal">
              <span className="sr-only">Hábito</span>
            </th>
            {LETRA_DIA.map((letra, i) => (
              <th key={i} scope="col" className="w-6 text-center sm:w-8 text-xs font-medium text-gaiamum-text-muted">
                <abbr title={NOME_DIA[i]} className="no-underline">
                  {letra}
                </abbr>
              </th>
            ))}
            <th scope="col">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {habitos.map((habito) => (
            <tr key={habito.id} className={habito.ativo ? "" : "opacity-60"}>
              <th scope="row" className="max-w-0 pr-2 text-left font-normal">
                <div className="flex items-center gap-2">
                  {mostrarArea && (
                    <span aria-hidden className="hidden text-base sm:inline">
                      {ICONE_AREA[habito.area]}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span lang="pt-BR" className="line-clamp-2 hyphens-auto leading-tight text-gaiamum-text" title={habito.nome}>
                      {habito.nome}
                    </span>
                    {gerenciar && (
                      <span className="block truncate text-xs text-gaiamum-text-muted">
                        {descreverDias(habito.dias_semana)}
                        {habito.horario && ` · ${horarioCurto(habito.horario)}`}
                        {habito.duracao_minutos && ` · ${habito.duracao_minutos} min`}
                        {!habito.ativo && " · arquivado"}
                      </span>
                    )}
                  </div>
                </div>
              </th>
              {semanaDoHabito(habito, registros, segunda, hoje).map((dia) => (
                <td key={dia.data} className="text-center">
                  <BolinhaDia habito={habito} dia={dia} />
                </td>
              ))}
              <td className={`${gerenciar ? "w-8 sm:w-24" : "w-7"} text-right`}>
                <AcoesHabito habito={habito} completo={gerenciar} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
