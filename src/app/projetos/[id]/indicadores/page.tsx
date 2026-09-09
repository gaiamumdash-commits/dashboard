import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import type { Projeto } from "@/lib/ecc/tipos";
import { listarIndicadoresDoProjeto } from "@/lib/ecc/indicadores";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ListaIndicadores } from "@/components/projetos/lista-indicadores";

export default async function PaginaIndicadores({ params }: { params: Promise<{ id: string }> }) {
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

  const papelAtual = await obterPapelAtual(tenantId);
  const souOwner = papelAtual === "owner";

  if (!souOwner) {
    redirect(`/projetos/${projetoId}/tarefas`);
  }

  const indicadores = await listarIndicadoresDoProjeto(projetoId);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner={souOwner} />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-10">
        <Link href={`/projetos/${projetoId}/tarefas`} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← {(projeto as Projeto).nome}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Indicadores</h1>

        <div className="mt-8">
          <ListaIndicadores projetoId={projetoId} indicadoresIniciais={indicadores} />
        </div>
      </main>
    </div>
  );
}
