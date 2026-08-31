"use client";

import { useFormStatus } from "react-dom";
import type { PerfilNegocio } from "@/lib/ecc/tipos";
import { salvarPerfilNegocio } from "@/lib/ecc/marketing";

function BotaoSalvarPerfil() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
    >
      {pending ? "Salvando..." : "Salvar perfil"}
    </button>
  );
}

export function FormularioPerfil({ perfil }: { perfil: PerfilNegocio | null }) {
  return (
    <form action={salvarPerfilNegocio} className="flex flex-col gap-4 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Nome do negócio
        <input
          name="nome_negocio"
          required
          defaultValue={perfil?.nome_negocio ?? ""}
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Nicho
        <input
          name="nicho"
          required
          placeholder="Ex.: produtos digitais pra criativos"
          defaultValue={perfil?.nicho ?? ""}
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Site (opcional)
          <input
            name="site_url"
            type="url"
            defaultValue={perfil?.site_url ?? ""}
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Instagram (opcional)
          <input
            name="instagram"
            placeholder="@seuperfil"
            defaultValue={perfil?.instagram ?? ""}
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Tom de voz (opcional)
        <input
          name="tom_de_voz"
          placeholder="Ex.: direto, professor, provocador, leve..."
          defaultValue={perfil?.tom_de_voz ?? ""}
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <BotaoSalvarPerfil />
    </form>
  );
}
