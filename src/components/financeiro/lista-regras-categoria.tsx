"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RegraCategoria } from "@/lib/ecc/tipos";
import { criarRegraCategoria, removerRegraCategoria } from "@/lib/ecc/importacao-extrato";

const CATEGORIAS = [
  { valor: "consumo", rotulo: "Consumo" },
  { valor: "investimento", rotulo: "Investimento" },
  { valor: "despesa", rotulo: "Despesa" },
];

const ROTULO_CATEGORIA: Record<RegraCategoria["categoria"], string> = {
  consumo: "Consumo",
  investimento: "Investimento",
  despesa: "Despesa",
};

export function ListaRegrasCategoria({ regras }: { regras: RegraCategoria[] }) {
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
        Regras de categoria (por palavra-chave na descrição)
      </h2>

      <div className="mt-3 flex flex-col gap-2">
        {regras.map((regra) => (
          <div key={regra.id} className="flex items-center gap-3 text-sm">
            <span className="text-gaiamum-text">&quot;{regra.palavra_chave}&quot;</span>
            <span className="text-gaiamum-text-muted">→ {ROTULO_CATEGORIA[regra.categoria]}</span>
            <button
              type="button"
              onClick={() =>
                iniciarTransicao(async () => {
                  await removerRegraCategoria(regra.id);
                  router.refresh();
                })
              }
              className="ml-auto text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
            >
              ✕
            </button>
          </div>
        ))}
        {regras.length === 0 && (
          <p className="text-sm text-gaiamum-text-muted">Nenhuma regra ainda — sem regra, a categoria sugerida é sempre &quot;Despesa&quot;.</p>
        )}
      </div>

      <form
        action={async (formData) => {
          await criarRegraCategoria(formData);
          router.refresh();
        }}
        className="mt-4 flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-1 min-w-[140px] flex-col gap-1 text-xs text-gaiamum-text-muted">
          Palavra-chave
          <input
            name="palavra_chave"
            required
            placeholder="Ex: Enel, Nibo, Uber..."
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-1.5 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gaiamum-text-muted">
          Categoria
          <select
            name="categoria"
            defaultValue="despesa"
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-1.5 text-sm text-gaiamum-text outline-none"
          >
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-sm text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text"
        >
          + Regra
        </button>
      </form>
    </div>
  );
}
