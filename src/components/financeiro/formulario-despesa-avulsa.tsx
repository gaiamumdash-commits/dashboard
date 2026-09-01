"use client";

import { useState } from "react";
import { criarDespesaAvulsa } from "@/lib/ecc/financeiro";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { BotaoFormulario } from "@/components/botao-formulario";

const CATEGORIAS = [
  { valor: "consumo", rotulo: "Consumo" },
  { valor: "investimento", rotulo: "Investimento" },
  { valor: "despesa", rotulo: "Despesa" },
];

export function FormularioDespesaAvulsa() {
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setErro(null);
        try {
          await criarDespesaAvulsa(formData);
        } catch (e) {
          setErro(mensagemDeErro(e, "Falha ao lançar despesa."));
        }
      }}
      className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 sm:flex-row sm:items-end sm:flex-wrap"
    >
      <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-sm text-gaiamum-text-muted">
        Nome da despesa
        <input
          name="nome"
          required
          placeholder="Compra avulsa, serviço pontual..."
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Valor
        <input
          type="number"
          name="valor"
          step="0.01"
          min="0.01"
          required
          className="w-32 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Vencimento
        <input
          type="date"
          name="data_vencimento"
          required
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Categoria
        <select
          name="categoria"
          defaultValue="despesa"
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none"
        >
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </label>

      <BotaoFormulario label="Lançar despesa" labelPendente="Lançando..." />

      {erro && <p className="text-sm text-gaiamum-danger sm:basis-full">{erro}</p>}
    </form>
  );
}
