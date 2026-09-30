import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart, listarMetasSmart } from "@/lib/ecc/metas";
import { deveOferecerLab } from "@/lib/ecc/lab/oferta";
import { FormularioSmart } from "@/components/onboarding/formulario-smart";
import { MenuLateral } from "@/components/layout/menu-lateral";

export default async function PaginaOnboarding() {
  const tenantId = await garantirWorkspace();

  // Quem entrou convidado só pra um quadro não vê Metas SMART.
  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  // Owner de workspace que ainda não decidiu sobre o Lab vê a oferta antes
  // de qualquer coisa — mesmo instante de maior disposição pro tutorial.
  if (await deveOferecerLab(tenantId)) {
    redirect("/onboarding/lab-ou-direto");
  }

  const totalMetasSmart = await contarMetasSmart(tenantId);
  const temMetasSmart = Boolean(totalMetasSmart);
  const souOwner = (await obterPapelAtual(tenantId)) === "owner";

  // Correção do P0 (2026-09-30): antes desta mudança, com metas já
  // salvas esta página não renderizava formulário nenhum — só uma
  // mensagem estática com um botão pra "/projetos". O link "Editar →" do
  // dashboard (app/page.tsx) aponta pra cá prometendo edição, então agora
  // ela existe de verdade: busca as metas já salvas e reabre o mesmo
  // formulário, preenchido, usando `salvarMetasSmart` (upsert real —
  // ver actions.ts) pra editar em vez de duplicar.
  const metasExistentes = temMetasSmart ? await listarMetasSmart(tenantId) : [];

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={temMetasSmart} souOwner={souOwner} />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12">
        {temMetasSmart ? (
          <>
            <h1 className="text-3xl font-semibold text-gaiamum-text">Suas metas SMART</h1>
            <p className="mt-2 text-gaiamum-text-muted">
              Revise ou ajuste o que você definiu — as mudanças ficam salvas na mesma meta, nada é
              duplicado.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-semibold text-gaiamum-text">Vamos montar sua visão</h1>
            <p className="mt-2 text-gaiamum-text-muted">
              Antes de criar projetos e tarefas, defina onde seu negócio precisa chegar. Cada meta
              vira uma meta SMART: Específica, Mensurável, Atingível, Relevante e Temporal. Pode
              pular e preencher depois, se preferir.
            </p>

            <blockquote className="mt-6 rounded-2xl border border-gaiamum-primary/30 bg-gaiamum-primary/5 p-5">
              <p className="text-lg italic leading-relaxed text-gaiamum-text">
                “Transformar metas em compromissos concretos faz diferença: participantes que
                escreveram seus objetivos apresentaram um nível de realização 42% maior do que
                aqueles que apenas pensaram neles.”
              </p>
              <footer className="mt-3 text-sm font-medium text-gaiamum-text-muted">
                — Gail Matthews, Dominican University of California
              </footer>
            </blockquote>
          </>
        )}

        <FormularioSmart metasExistentes={metasExistentes} />
      </main>
    </div>
  );
}
