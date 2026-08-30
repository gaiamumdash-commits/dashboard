import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { temAcessoCompleto, obterPapelAtual } from "@/lib/ecc/equipe";
import type { Projeto } from "@/lib/ecc/tipos";
import { FormularioNovoProjeto } from "@/components/projetos/formulario-novo-projeto";
import { CartaoProjeto } from "@/components/projetos/cartao-projeto";
import { MenuLateral } from "@/components/layout/menu-lateral";

export default async function PaginaProjetos() {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: projetos }, { count: totalMetasSmart }, acessoCompleto, papelAtual, { data: projetosGeridos }] =
    await Promise.all([
      supabase.from("projetos").select("*").eq("tenant_id", tenantId).order("criado_em", { ascending: false }),
      supabase.from("metas_smart").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      temAcessoCompleto(tenantId),
      obterPapelAtual(tenantId),
      user
        ? supabase.from("projeto_membros").select("projeto_id").eq("user_id", user.id).eq("papel", "gestor")
        : Promise.resolve({ data: [] as { projeto_id: string }[] }),
    ]);

  const souOwner = papelAtual === "owner";
  const idsProjetosGeridos = new Set((projetosGeridos ?? []).map((p) => p.projeto_id as string));

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral
        temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)}
        acessoCompleto={acessoCompleto}
      />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gaiamum-text">Projetos</h1>
          <p className="mt-1 text-gaiamum-text-muted">Cada projeto isola suas próprias tarefas.</p>
        </div>

        {souOwner && <FormularioNovoProjeto />}

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projetos as Projeto[] | null)?.map((projeto) => (
            <CartaoProjeto
              key={projeto.id}
              projeto={projeto}
              podeExcluir={souOwner || idsProjetosGeridos.has(projeto.id)}
            />
          ))}
          {(!projetos || projetos.length === 0) && (
            <p className="col-span-full text-gaiamum-text-muted">
              Nenhum projeto ainda. Crie o primeiro acima.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
