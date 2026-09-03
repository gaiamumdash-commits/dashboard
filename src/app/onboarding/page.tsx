import Link from "next/link";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { createClient } from "@/lib/supabase/server";
import { FormularioSmart } from "@/components/onboarding/formulario-smart";
import { MenuLateral } from "@/components/layout/menu-lateral";

export default async function PaginaOnboarding() {
  const tenantId = await garantirWorkspace();

  // Quem entrou convidado só pra um quadro não vê Metas SMART.
  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("metas_smart")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const temMetasSmart = Boolean(count && count > 0);
  const souOwner = (await obterPapelAtual(tenantId)) === "owner";

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={temMetasSmart} souOwner={souOwner} />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12">
        {temMetasSmart ? (
          <>
            <h1 className="text-3xl font-semibold text-gaiamum-text">Suas metas já estão salvas</h1>
            <p className="mt-2 text-gaiamum-text-muted">
              Você já preencheu suas metas SMART de médio e longo prazo.
            </p>
            <Link
              href="/projetos"
              className="mt-6 inline-block rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-white transition hover:bg-gaiamum-primary-dark"
            >
              Ir pros projetos
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-semibold text-gaiamum-text">Vamos montar sua visão</h1>
            <p className="mt-2 text-gaiamum-text-muted">
              Antes de criar projetos e tarefas, defina onde seu negócio precisa chegar. Cada meta
              vira uma meta SMART: Específica, Mensurável, Atingível, Relevante e Temporal. Pode
              pular e preencher depois, se preferir — o menu lateral sempre te traz de volta aqui.
            </p>

            <FormularioSmart />
          </>
        )}
      </main>
    </div>
  );
}
