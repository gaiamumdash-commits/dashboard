import Link from "next/link";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { listarPatentesDoUsuario } from "@/lib/ecc/lab/patentes";
import { passosConcluidos } from "@/lib/ecc/lab/progresso";
import { iniciarLab } from "@/lib/ecc/lab/actions";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { BotaoRefazerLab } from "@/components/lab/botao-refazer-lab";
import { LogoCafeDoMangue } from "@/components/lab/logo-cafe-do-mangue";

export default async function PaginaLab() {
  const tenantId = await garantirWorkspace();

  // Mesmo gate de Metas SMART/Equipe/Agenda: quem foi convidado só pra um
  // quadro específico não tem "o próprio negócio" pra levar pro Lab.
  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const user = await obterUsuarioAtual();
  if (!user) {
    redirect("/auth");
  }

  const [totalMetasSmart, papelAtual, patentes, passos] = await Promise.all([
    contarMetasSmart(tenantId),
    obterPapelAtual(tenantId),
    listarPatentesDoUsuario(user.id),
    passosConcluidos(user.id),
  ]);

  const codigosPatentes = new Set(patentes.map((p) => p.codigo));
  const temExplorador = codigosPatentes.has("explorador");
  const temMaster = codigosPatentes.has("master");
  const temEstrategista = codigosPatentes.has("estrategista");
  const jaComecou = passos.size > 0 || temExplorador;
  const proximaRota = passos.has("explorar_quadro") ? "/lab/visao-360" : "/lab/quadro";

  const mensagemPosExplorador = temMaster
    ? "Você chegou a Estrategista Master de verdade, aplicando isso no seu próprio negócio — o Lab já fez o papel dele."
    : temEstrategista
      ? "Você já é Estrategista de verdade num projeto seu — falta só gerar a primeira explicação de IA do Alinhamento pra virar Estrategista Master."
      : "Você concluiu o Café do Mangue e entendeu o núcleo do Gaiamum. As próximas patentes — Estrategista e Estrategista Master — só se conquistam de verdade, aplicando isso num projeto real seu.";

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
        <div>
          <div className="flex items-center gap-2">
            <LogoCafeDoMangue size={40} />
            <h1 className="text-3xl font-semibold text-gaiamum-text">🎮 Gaiamum Lab</h1>
          </div>
          <p className="mt-2 text-gaiamum-text-muted">
            Um estudo de caso fictício pra aprender o Gaiamum na prática: você vai assumir o Café
            do Mangue, uma cafeteria que precisa lançar o delivery, e usar o quadro e a Visão 360°
            de verdade — só que com dados de mentirinha, sem nenhum risco pro seu negócio real.
          </p>
        </div>

        {temExplorador ? (
          <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
            <p className="text-sm font-medium text-gaiamum-text">
              {temMaster ? "🏆 Você é Estrategista Master!" : "🦀 Você já é Explorador!"}
            </p>
            <p className="mt-1 text-sm text-gaiamum-text-muted">{mensagemPosExplorador}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/projetos"
                className="rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark"
              >
                Ir pros meus projetos
              </Link>
              <Link
                href="/lab/progresso"
                className="rounded-lg border border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text-muted transition hover:text-gaiamum-text"
              >
                Ver meu progresso
              </Link>
              <BotaoRefazerLab />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
            <p className="text-sm text-gaiamum-text-muted">
              {jaComecou ? "Você já começou — continue de onde parou." : "Leva menos de 10 minutos."}
            </p>
            {jaComecou ? (
              <Link
                href={proximaRota}
                className="mt-4 inline-block rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-white transition hover:bg-gaiamum-primary-dark"
              >
                Continuar
              </Link>
            ) : (
              <form action={iniciarLab}>
                <button
                  type="submit"
                  className="mt-4 rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-white transition hover:bg-gaiamum-primary-dark"
                >
                  Começar
                </button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
