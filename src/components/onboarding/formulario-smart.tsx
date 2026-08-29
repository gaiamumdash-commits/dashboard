import { criarMetasSmart } from "@/lib/ecc/actions";
import { CAMPOS_SMART, HORIZONTES } from "@/lib/ecc/smart";
import { BotaoSalvar } from "@/components/onboarding/botao-salvar";

export function FormularioSmart() {
  return (
    <form action={criarMetasSmart} className="mt-8 flex flex-col gap-10">
      {HORIZONTES.map((horizonte) => (
        <fieldset
          key={horizonte.valor}
          className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6"
        >
          <legend className="px-1 text-lg font-semibold text-gaiamum-primary">{horizonte.titulo}</legend>
          <p className="mb-4 text-sm text-gaiamum-text-muted">{horizonte.ajuda}</p>

          <label className="mb-4 flex flex-col gap-1 text-sm text-gaiamum-text-muted">
            Visão macro
            <textarea
              name={`${horizonte.valor}_visao_macro`}
              required
              rows={2}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS_SMART.map((campo) => (
              <label key={campo.campo} className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
                <span>
                  <span className="font-semibold text-gaiamum-primary">{campo.letra}</span> — {campo.titulo}
                </span>
                <span className="text-xs text-gaiamum-text-muted">{campo.ajuda}</span>
                <textarea
                  name={`${horizonte.valor}_${campo.campo}`}
                  required
                  rows={2}
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <BotaoSalvar />
    </form>
  );
}
