import { criarProdutoDigital } from "@/lib/ecc/marketing";

const FORMATOS = [
  { valor: "curso", rotulo: "Curso" },
  { valor: "ebook", rotulo: "Ebook" },
  { valor: "mentoria", rotulo: "Mentoria" },
  { valor: "template", rotulo: "Template" },
  { valor: "comunidade", rotulo: "Comunidade" },
  { valor: "outro", rotulo: "Outro" },
];

export function FormularioNovoProduto() {
  return (
    <form
      action={criarProdutoDigital}
      className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 sm:flex-row sm:items-end sm:flex-wrap"
    >
      <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-sm text-gaiamum-text-muted">
        Nome do produto
        <input
          name="nome"
          required
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Formato
        <select
          name="formato"
          defaultValue="curso"
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
          className="w-32 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-1 min-w-[220px] flex-col gap-1 text-sm text-gaiamum-text-muted">
        Promessa (opcional)
        <input
          name="promessa"
          placeholder="O que o produto entrega"
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <button
        type="submit"
        className="rounded-lg bg-gaiamum-primary px-5 py-2 font-medium text-white transition hover:bg-gaiamum-primary-dark"
      >
        Criar produto
      </button>
    </form>
  );
}
