import { criarMetasSmart, pularOnboarding } from "@/lib/ecc/actions";
import { CAMPOS_SMART, HORIZONTES } from "@/lib/ecc/smart";
import { BotaoSalvar } from "@/components/onboarding/botao-salvar";

export function FormularioSmart() {
  return (
    <form action={criarMetasSmart} className="mt-8 flex flex-col gap-10">
      {HORIZONTES.map((horizonte) => (
        <div
          key={horizonte.valor}
          role="group"
          aria-labelledby={`titulo-${horizonte.valor}`}
          className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6"
        >
          <h2 id={`titulo-${horizonte.valor}`} className="text-lg font-semibold text-gaiamum-primary">
            {horizonte.titulo}
          </h2>
          <p className="mb-4 mt-1 text-sm text-gaiamum-text-muted">{horizonte.ajuda}</p>

          <label className="mb-4 flex flex-col gap-2 text-sm">
            <span className="font-semibold text-gaiamum-text">Visão macro</span>
            <textarea
              name={`${horizonte.valor}_visao_macro`}
              required
              rows={2}
              placeholder={horizonte.placeholder}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none placeholder:text-gaiamum-text-muted/60 focus:border-gaiamum-primary"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS_SMART.map((campo) => (
              <label key={campo.campo} className="flex flex-col gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gaiamum-primary/15 text-xs font-bold text-gaiamum-primary">
                    {campo.letra}
                  </span>
                  <span className="font-semibold text-gaiamum-text">{campo.titulo}</span>
                </span>
                <span className="text-xs text-gaiamum-text-muted">{campo.ajuda}</span>
                <textarea
                  name={`${horizonte.valor}_${campo.campo}`}
                  required
                  rows={2}
                  placeholder={campo.placeholder}
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none placeholder:text-gaiamum-text-muted/60 focus:border-gaiamum-primary"
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-4">
        <BotaoSalvar />
        <button
          type="submit"
          formAction={pularOnboarding}
          formNoValidate
          className="text-sm text-gaiamum-text-muted underline underline-offset-2 hover:text-gaiamum-text"
        >
          Pular, preencho depois
        </button>
      </div>
    </form>
  );
}
