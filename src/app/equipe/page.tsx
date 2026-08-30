import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { listarMembros, listarConvitesPendentes, obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { FormularioConvite } from "@/components/equipe/formulario-convite";
import { ListaConvites } from "@/components/equipe/lista-convites";
import { ListaMembros } from "@/components/equipe/lista-membros";

export default async function PaginaEquipe() {
  const tenantId = await garantirWorkspace();

  // Quem entrou convidado só pra um quadro não vê a Equipe do workspace
  // inteiro, só o(s) quadro(s) em que foi colocado.
  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const supabase = await createClient();

  const [membros, convites, papelAtual, { count: totalMetasSmart }, { data: projetos }, cabecalhos] =
    await Promise.all([
      listarMembros(tenantId),
      listarConvitesPendentes(tenantId),
      obterPapelAtual(tenantId),
      supabase.from("metas_smart").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("projetos").select("id, nome").eq("tenant_id", tenantId).order("nome"),
      headers(),
    ]);

  const host = cabecalhos.get("host") ?? "gaiamum-dashboard.vercel.app";
  const origem = host.includes("localhost") ? `http://${host}` : `https://${host}`;
  const souOwner = papelAtual === "owner";

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)} souOwner={souOwner} />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold text-gaiamum-text">Equipe</h1>
        <p className="mt-1 text-gaiamum-text-muted">
          Quem tem acesso a este workspace. Convide alguém e envie o link gerado por WhatsApp ou e-mail —
          ainda não enviamos automaticamente.
        </p>

        <div className="mt-8">
          <ListaMembros membros={membros} souOwner={souOwner} />
        </div>

        {souOwner && (
          <div className="mt-8">
            <FormularioConvite projetos={projetos ?? []} />
          </div>
        )}

        {souOwner && convites.length > 0 && (
          <div className="mt-8">
            <ListaConvites convites={convites} origem={origem} projetos={projetos ?? []} />
          </div>
        )}
      </main>
    </div>
  );
}
