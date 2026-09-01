"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { salvarAlarme } from "@/lib/ecc/alarmes";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { EntidadeAlarme } from "@/lib/ecc/tipos";

const PRESETS_ANTECEDENCIA = [
  { minutos: 15, rotulo: "15 minutos antes" },
  { minutos: 60, rotulo: "1 hora antes" },
  { minutos: 180, rotulo: "3 horas antes" },
  { minutos: 1440, rotulo: "1 dia antes" },
  { minutos: 4320, rotulo: "3 dias antes" },
];

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
        {PRESETS_ANTECEDENCIA.map((p) => (
          <option key={p.minutos} value={p.minutos}>
            {p.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}
