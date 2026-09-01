import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { listarEventosGoogleCalendar } from "@/lib/ecc/google-calendar";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { PainelAgenda } from "@/components/agenda/painel-agenda";

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const tenantId = await garantirWorkspace();

  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const supabase = await createClient();

  const [resultado, papelAtual, { count: totalMetasSmart }] = await Promise.all([
    listarEventosGoogleCalendar(),
    obterPapelAtual(tenantId),
    supabase.from("metas_smart").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral
        temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)}
        souOwner={papelAtual === "owner"}
      />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold text-gaiamum-text">Agenda</h1>
        <p className="mt-1 text-gaiamum-text-muted">Sua agenda pessoal do Google, sem sair do Gaiamum.</p>

        <div className="mt-8">
          <PainelAgenda resultado={resultado} erro={erro} />
        </div>
      </main>
    </div>
  );
}
