"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { salvarAlarme } from "@/lib/ecc/alarmes";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { EntidadeAlarme } from "@/lib/ecc/tipos";

export const PRESETS_ANTECEDENCIA = [
  { minutos: 15, rotulo: "15 minutos antes" },
  { minutos: 60, rotulo: "1 hora antes" },
  { minutos: 180, rotulo: "3 horas antes" },
  { minutos: 1440, rotulo: "1 dia antes" },
  { minutos: 4320, rotulo: "3 dias antes" },
];

/** Rótulo pra uma antecedência que não bate com nenhum preset acima — ex.: o
 * alarme automático de véspera das contas a pagar (360min = 6h, disparo às
 * 18h do dia anterior; ver `ANTECEDENCIA_MIN_VESPERA_CONTA_A_PAGAR` em
 * kanban.ts). Sem isso, o `<select>` cairia no "Sem alarme" por não achar
 * nenhuma `<option>` com esse valor — mostraria como se não tivesse alarme
 * nenhum, quando na verdade tem um configurado (achado real, sessão
 * 2026-09-29 testando a feature de contas do dia). */
function formatarAntecedenciaPersonalizada(minutos: number): string {
  if (minutos % 1440 === 0) return `${minutos / 1440} dia(s) antes`;
  if (minutos % 60 === 0) return `${minutos / 60} hora(s) antes`;
  return `${minutos} minutos antes`;
}

/** Dropdown de "avisar X antes", reaproveitado no Financeiro, no cartão de
 * tarefa e nos compromissos manuais da Agenda — salva sozinho ao trocar de
 * opção (sem botão de submit próprio), já que costuma aparecer dentro de
 * um card que não tem um form de "salvar tudo de uma vez". */
export function CampoAlarme({
  entidadeTipo,
  entidadeId,
  antecedenciaAtual,
  caminhoRevalidar,
}: {
  entidadeTipo: EntidadeAlarme;
  entidadeId: string;
  antecedenciaAtual: number | null;
  caminhoRevalidar: string;
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function alterar(valor: string) {
    const formData = new FormData();
    formData.set("entidade_tipo", entidadeTipo);
    formData.set("entidade_id", entidadeId);
    formData.set("antecedencia_min", valor);
    formData.set("caminho_revalidar", caminhoRevalidar);

    const rotulo = PRESETS_ANTECEDENCIA.find((p) => String(p.minutos) === valor)?.rotulo;

    iniciarTransicao(async () => {
      try {
        await salvarAlarme(formData);
        toast.success(rotulo ? `Alarme salvo: ${rotulo}.` : "Alarme removido.");
        router.refresh();
      } catch (err) {
        toast.error(mensagemDeErro(err, "Falha ao salvar o alarme."));
      }
    });
  }

  const ehPersonalizado = antecedenciaAtual != null && !PRESETS_ANTECEDENCIA.some((p) => p.minutos === antecedenciaAtual);

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
      Avisar
      <select
        defaultValue={antecedenciaAtual ?? ""}
        disabled={pendente}
        onChange={(e) => alterar(e.target.value)}
        className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none disabled:opacity-60"
      >
        <option value="">Sem alarme</option>
        {ehPersonalizado && (
          <option value={antecedenciaAtual}>{formatarAntecedenciaPersonalizada(antecedenciaAtual)}</option>
        )}
        {PRESETS_ANTECEDENCIA.map((p) => (
          <option key={p.minutos} value={p.minutos}>
            {p.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}
