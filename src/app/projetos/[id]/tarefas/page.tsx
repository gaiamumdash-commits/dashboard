import Link from "next/link";
import { notFound } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import type { Projeto, Tarefa } from "@/lib/ecc/tipos";
import { FormularioNovaTarefa } from "@/components/kanban/formulario-nova-tarefa";
import { QuadroKanban } from "@/components/kanban/quadro-kanban";

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

  const { data: tarefas } = await supabase
    .from("tarefas")
    .select("*")
    .eq("projeto_id", projetoId)
    .order("criado_em", { ascending: true });

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
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
  );
}
