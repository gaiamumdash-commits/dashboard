import Link from "next/link";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { semearCafeMangue } from "@/lib/ecc/lab/seed-cafe-mangue";
import { continuarParaVisao360 } from "@/lib/ecc/lab/actions";
import { createClient } from "@/lib/supabase/server";
import type { ColunaKanban, Tarefa } from "@/lib/ecc/tipos";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { QuadroLab } from "@/components/lab/quadro-lab";
import { EstatisticaFicticia } from "@/components/lab/estatistica-ficticia";
import { LogoCafeDoMangue } from "@/components/lab/logo-cafe-do-mangue";
import { ESTATISTICAS_FICTICIAS_CAFE_MANGUE } from "@/lib/ecc/lab/conteudo-cafe-mangue";

export default async function PaginaQuadroLab() {
  const tenantId = await garantirWorkspace();
  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const user = await obterUsuarioAtual();
  if (!user) {
    redirect("/auth");
  }

  const [totalMetasSmart, papelAtual, tenantIdLab] = await Promise.all([
    contarMetasSmart(tenantId),
    obterPapelAtual(tenantId),
    garantirTenantLab(),
  ]);

  const projetoId = await semearCafeMangue(tenantIdLab, user.id);

  const supabase = await createClient();
  const [{ data: colunas }, { data: tarefas }] = await Promise.all([
    supabase
      .from("colunas_kanban")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("concluido", { ascending: true })
      .order("ordem", { ascending: true }),
    supabase.from("tarefas").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: true }),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <Link href="/lab" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
            ← Gaiamum Lab
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <LogoCafeDoMangue size={36} />
            <h1 className="text-3xl font-semibold text-gaiamum-text">Café do Mangue</h1>
          </div>
          <p className="mt-2 text-gaiamum-text-muted">
            Este é o quadro real do Café do Mangue — arraste os cartões entre as colunas pra ver como
            funciona. &ldquo;Testar embalagens térmicas&rdquo; está atrasada e travando o teste
            piloto: repare como isso vai aparecer na Visão 360° no próximo passo.
          </p>
        </div>

        <QuadroLab colunasIniciais={(colunas as ColunaKanban[]) ?? []} tarefasIniciais={(tarefas as Tarefa[]) ?? []} />

        <EstatisticaFicticia texto={ESTATISTICAS_FICTICIAS_CAFE_MANGUE[0]} />

        <form action={continuarParaVisao360}>
          <button
            type="submit"
            className="rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-white transition hover:bg-gaiamum-primary-dark"
          >
            Continuar →
          </button>
        </form>
      </main>
    </div>
  );
}
