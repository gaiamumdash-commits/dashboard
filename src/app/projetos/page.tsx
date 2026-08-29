import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import type { Projeto } from "@/lib/ecc/tipos";
import { FormularioNovoProjeto } from "@/components/projetos/formulario-novo-projeto";
import { CartaoProjeto } from "@/components/projetos/cartao-projeto";

export default async function PaginaProjetos() {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const { data: projetos } = await supabase
    .from("projetos")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false });

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gaiamum-text">Projetos</h1>
        <p className="mt-1 text-gaiamum-text-muted">Cada projeto isola suas próprias tarefas.</p>
      </div>

      <FormularioNovoProjeto />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(projetos as Projeto[] | null)?.map((projeto) => (
          <CartaoProjeto key={projeto.id} projeto={projeto} />
        ))}
        {(!projetos || projetos.length === 0) && (
          <p className="col-span-full text-gaiamum-text-muted">
            Nenhum projeto ainda. Crie o primeiro acima.
          </p>
        )}
      </div>
    </main>
  );
}
