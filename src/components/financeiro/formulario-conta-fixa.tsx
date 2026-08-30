import { criarContaFixa } from "@/lib/ecc/financeiro";

const CATEGORIAS = [
  { valor: "consumo", rotulo: "Consumo" },
  { valor: "investimento", rotulo: "Investimento" },
  { valor: "despesa", rotulo: "Despesa" },
];

export function FormularioContaFixa() {
  return (
    <form
      action={criarContaFixa}
      className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 sm:flex-row sm:items-end sm:flex-wrap"
    >
      <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-sm text-gaiamum-text-muted">
        Nome da conta fixa
        <input
          name="nome"
          required
          placeholder="Aluguel, internet, assinatura..."
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Valor esperado
        <input
          type="number"
          name="valor_esperado"
          step="0.01"
          min="0.01"
          required
          className="w-32 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Dia de vencimento
        <input
          type="number"
          name="dia_vencimento"
          min="1"
          max="31"
          required
          className="w-24 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
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

      <button
        type="submit"
        className="rounded-lg bg-gaiamum-primary px-5 py-2 font-medium text-white transition hover:bg-gaiamum-primary-dark"
      >
        Cadastrar conta fixa
      </button>
    </form>
  );
}
