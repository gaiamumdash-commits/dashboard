import { criarProjeto } from "@/lib/ecc/actions";

export function FormularioNovoProjeto() {
  return (
    <form
      action={criarProjeto}
      className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 sm:flex-row sm:items-end"
    >
      <label className="flex flex-1 flex-col gap-1 text-sm text-gaiamum-text-muted">
        Nome do projeto
        <input
          name="nome"
          required
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm text-gaiamum-text-muted">
        Descrição (opcional)
        <input
          name="descricao"
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-gaiamum-primary px-5 py-2 font-medium text-white transition hover:bg-gaiamum-primary-dark"
      >
        Criar projeto
      </button>
    </form>
  );
}
