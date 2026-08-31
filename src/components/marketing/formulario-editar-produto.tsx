"use client";

import { useFormStatus } from "react-dom";
import type { ProdutoDigital } from "@/lib/ecc/tipos";
import { atualizarProdutoDigital } from "@/lib/ecc/marketing";

const FORMATOS = [
  { valor: "curso", rotulo: "Curso" },
  { valor: "ebook", rotulo: "Ebook" },
  { valor: "mentoria", rotulo: "Mentoria" },
  { valor: "template", rotulo: "Template" },
  { valor: "comunidade", rotulo: "Comunidade" },
  { valor: "outro", rotulo: "Outro" },
];

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
    >
      {pending ? "Salvando..." : "Salvar produto"}
    </button>
  );
}

export function FormularioEditarProduto({ produto }: { produto: ProdutoDigital }) {
  const acao = atualizarProdutoDigital.bind(null, produto.id);

  return (
    <form action={acao} className="flex flex-col gap-4 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Nome do produto
        <input
          name="nome"
          required
          defaultValue={produto.nome}
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Formato
          <select
            name="formato"
            defaultValue={produto.formato}
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none"
          >
            {FORMATOS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Preço (opcional)
          <input
            type="number"
            name="preco"
            step="0.01"
            min="0"
            defaultValue={produto.preco ?? ""}
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Promessa (opcional)
        <textarea
          name="promessa"
          rows={3}
          defaultValue={produto.promessa ?? ""}
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <BotaoSalvar />
    </form>
  );
}
