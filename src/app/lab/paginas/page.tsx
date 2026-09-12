import Link from "next/link";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { semearCafeMangue } from "@/lib/ecc/lab/seed-cafe-mangue";
import { listarPaginasLivresDoProjeto } from "@/lib/ecc/paginas-livres";
import { passosConcluidos, MODULO_PAGINAS_LIVRES } from "@/lib/ecc/lab/progresso";
import { MISSOES_PAGINAS_LIVRES_CAFE_MANGUE, PORQUE_PAGINAS_LIVRES_CAFE_MANGUE } from "@/lib/ecc/lab/conteudo-cafe-mangue";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ListaMissoesEtapaLab } from "@/components/lab/lista-missoes-etapa-lab";
import { PorQueIssoExiste } from "@/components/lab/por-que-isso-existe";
import { ListaPaginasLivresLab } from "@/components/lab/lista-paginas-livres-lab";

export default async function PaginaPaginasLivresLab() {
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

  const [paginas, passosPaginas] = await Promise.all([
    listarPaginasLivresDoProjeto(projetoId),
    passosConcluidos(user.id, MODULO_PAGINAS_LIVRES),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <Link href="/lab/visao-360" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
            ← Visão 360°
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Páginas — Café do Mangue</h1>
          <p className="mt-2 text-gaiamum-text-muted">
            Um bloco de notas livre por projeto, pra guardar o que não é tarefa nem decisão.
          </p>
        </div>

        <PorQueIssoExiste texto={PORQUE_PAGINAS_LIVRES_CAFE_MANGUE} />

        <ListaMissoesEtapaLab missoes={MISSOES_PAGINAS_LIVRES_CAFE_MANGUE} passosConcluidos={passosPaginas} />

        <ListaPaginasLivresLab projetoId={projetoId} paginasIniciais={paginas} />
      </main>
    </div>
  );
}
