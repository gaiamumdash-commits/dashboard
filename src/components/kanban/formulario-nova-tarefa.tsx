import { criarTarefa } from "@/lib/ecc/actions";

const TAGS = ["pessoal", "ifaz", "faculdade", "vendas"];
const PRIORIDADES = ["P1", "P2", "P3", "P4"];

export function FormularioNovaTarefa({ projetoId }: { projetoId: string }) {
  const acao = criarTarefa.bind(null, projetoId);

  return (
    <form
      action={acao}
      className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 sm:flex-row sm:items-end sm:flex-wrap"
    >
      <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-sm text-gaiamum-text-muted">
        Título da tarefa
        <input
          name="titulo"
          required
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Prioridade
        <select
          name="prioridade"
          defaultValue="P3"
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none"
        >
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Tag
        <select
          name="tag"
          defaultValue=""
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none"
        >
          <option value="">Sem tag</option>
          {TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Prazo
        <input
          type="date"
          name="data_limite"
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none"
        />
      </label>

      <button
        type="submit"
        className="rounded-lg bg-gaiamum-primary px-5 py-2 font-medium text-black transition hover:bg-gaiamum-primary-dark"
      >
        Adicionar tarefa
      </button>
    </form>
  );
}
