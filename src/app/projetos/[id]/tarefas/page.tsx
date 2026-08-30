import Link from "next/link";
import { notFound } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import type { Projeto, Tarefa } from "@/lib/ecc/tipos";
import { FormularioNovaTarefa } from "@/components/kanban/formulario-nova-tarefa";
import { QuadroKanban } from "@/components/kanban/quadro-kanban";
import { MenuLateral } from "@/components/layout/menu-lateral";

export default async function PaginaTarefas({ params }: { params: Promise<{ id: string }> }) {
  const { id: projetoId } = await params;
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const { data: projeto } = await supabase
    .from("projetos")
    .select("*")
    .eq("id", projetoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!projeto) {
    notFound();
  }

  const [{ data: tarefas }, { count: totalMetasSmart }] = await Promise.all([
    supabase.from("tarefas").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: true }),
    supabase.from("metas_smart").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)} />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-12">
        <Link href="/projetos" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Projetos
        </Link>

        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">{(projeto as Projeto).nome}</h1>
        {(projeto as Projeto).descricao && (
          <p className="mt-1 text-gaiamum-text-muted">{(projeto as Projeto).descricao}</p>
        )}

        <div className="mt-8">
          <FormularioNovaTarefa projetoId={projetoId} />
        </div>

        <div className="mt-8">
          <QuadroKanban projetoId={projetoId} tarefasIniciais={(tarefas as Tarefa[]) ?? []} />
        </div>
      </main>
    </div>
  );
}
