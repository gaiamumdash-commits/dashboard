import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { eSouGestorDoProjeto, listarMembrosComAcessoAoProjeto, obterPapelAtual } from "@/lib/ecc/equipe";
import type { Convite, PapelProjeto, Projeto } from "@/lib/ecc/tipos";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ConfiguracoesQuadro } from "@/components/projetos/configuracoes-quadro";
import { EquipeDoQuadro, type MembroDoQuadro } from "@/components/projetos/equipe-do-quadro";

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

  const user = await obterUsuarioAtual();

  const [papelAtual, souGestor, { data: projetoMembros }, quemVe, { data: convites }] = await Promise.all([
    obterPapelAtual(tenantId),
    user ? eSouGestorDoProjeto(projetoId, user.id) : Promise.resolve(false),
    supabase.from("projeto_membros").select("user_id, papel").eq("projeto_id", projetoId),
    listarMembrosComAcessoAoProjeto(tenantId, projetoId),
    supabase.from("convites").select("*").eq("projeto_id", projetoId).eq("status", "pendente"),
  ]);

  const souOwner = papelAtual === "owner";

  if (!souOwner && !souGestor) {
    redirect(`/projetos/${projetoId}/tarefas`);
  }

  const papelPorMembro = new Map(
    (projetoMembros ?? []).map((m) => [m.user_id as string, m.papel as PapelProjeto]),
  );

  const membrosDoQuadro: MembroDoQuadro[] = quemVe.map((membro) => ({
    user_id: membro.user_id,
    email: membro.email,
    origem: membro.papel === "owner" ? "owner" : papelPorMembro.has(membro.user_id) ? "projeto" : "workspace",
    papelProjeto: papelPorMembro.get(membro.user_id) ?? null,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner={souOwner} />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href={`/projetos/${projetoId}/tarefas`} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← {(projeto as Projeto).nome}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Configurações do quadro</h1>

        <div className="mt-8">
          <ConfiguracoesQuadro projeto={projeto as Projeto} />
        </div>

        <div className="mt-8">
          <EquipeDoQuadro
            projetoId={projetoId}
            membros={membrosDoQuadro}
            convitesPendentes={(convites as Convite[] | null) ?? []}
          />
        </div>
      </main>
    </div>
  );
}
