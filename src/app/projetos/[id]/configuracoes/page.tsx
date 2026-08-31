import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { eSouGestorDoProjeto, listarMembros, obterPapelAtual } from "@/lib/ecc/equipe";
import type { Projeto } from "@/lib/ecc/tipos";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ConfiguracoesQuadro } from "@/components/projetos/configuracoes-quadro";

export default async function PaginaConfiguracoesQuadro({ params }: { params: Promise<{ id: string }> }) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [papelAtual, souGestor, { data: projetoMembros }, membrosDoTenant, { data: memberships }] =
    await Promise.all([
      obterPapelAtual(tenantId),
      user ? eSouGestorDoProjeto(projetoId, user.id) : Promise.resolve(false),
      supabase.from("projeto_membros").select("user_id, papel").eq("projeto_id", projetoId),
      listarMembros(tenantId),
      supabase.from("memberships").select("user_id, escopo").eq("tenant_id", tenantId),
    ]);

  const souOwner = papelAtual === "owner";

  if (!souOwner && !souGestor) {
    redirect(`/projetos/${projetoId}/tarefas`);
  }

  const idsEscopoCompleto = new Set(
    (memberships ?? []).filter((m) => m.escopo === "completo").map((m) => m.user_id as string),
  );
  const idsProjetoMembros = new Set((projetoMembros ?? []).map((m) => m.user_id as string));

  const quemVe = membrosDoTenant.filter(
    (m) => m.papel === "owner" || idsEscopoCompleto.has(m.user_id) || idsProjetoMembros.has(m.user_id),
  );

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart souOwner={souOwner} />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href={`/projetos/${projetoId}/tarefas`} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← {(projeto as Projeto).nome}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Configurações do quadro</h1>

        <div className="mt-8">
          <ConfiguracoesQuadro projeto={projeto as Projeto} />
        </div>

        <div className="mt-8 flex flex-col gap-1.5 border-t border-gaiamum-border pt-6">
          <span className="text-xs font-medium text-gaiamum-text-muted">Visibilidade</span>
          <p className="text-sm text-gaiamum-text-muted">Quem tem acesso a este quadro hoje:</p>
          <ul className="mt-1 flex flex-col gap-1">
            {quemVe.map((membro) => (
              <li key={membro.user_id} className="text-sm text-gaiamum-text">
                {membro.email}{" "}
                <span className="text-xs text-gaiamum-text-muted">
                  ({membro.papel === "owner" ? "dono do workspace" : idsProjetoMembros.has(membro.user_id) ? "membro do quadro" : "acesso completo ao workspace"})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
