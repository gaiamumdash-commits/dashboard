import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import type { MetaSmart, Projeto } from "@/lib/ecc/tipos";
import { listarDecisoesDoProjeto } from "@/lib/ecc/decisoes";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ListaDecisoes } from "@/components/projetos/lista-decisoes";

export default async function PaginaDecisoes({ params }: { params: Promise<{ id: string }> }) {
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

  const [decisoes, { data: metasSmart }] = await Promise.all([
    listarDecisoesDoProjeto(projetoId),
    supabase.from("metas_smart").select("*").eq("tenant_id", tenantId).order("criado_em", { ascending: true }),
  ]);

  const { data: contasGeradas } =
    decisoes.length > 0
      ? await supabase
          .from("contas_a_pagar")
          .select("decisao_id")
          .not("decisao_id", "is", null)
          .in(
            "decisao_id",
            decisoes.map((d) => d.id),
          )
      : { data: [] as { decisao_id: string | null }[] };
  const decisoesComContaGerada = (contasGeradas ?? []).map((c) => c.decisao_id as string);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner={souOwner} />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-10">
        <Link href={`/projetos/${projetoId}/tarefas`} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← {(projeto as Projeto).nome}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Decisões</h1>

        <div className="mt-8">
          <ListaDecisoes
            projetoId={projetoId}
            decisoesIniciais={decisoes}
            metasSmart={(metasSmart as MetaSmart[]) ?? []}
            decisoesComContaGerada={decisoesComContaGerada}
          />
        </div>
      </main>
    </div>
  );
}
