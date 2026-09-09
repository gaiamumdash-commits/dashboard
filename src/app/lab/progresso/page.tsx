import Link from "next/link";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { listarPatentesDoUsuario, ORDEM_PATENTES, ROTULO_PATENTE, type CodigoPatente } from "@/lib/ecc/lab/patentes";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { BotaoRefazerLab } from "@/components/lab/botao-refazer-lab";

const COMO_CONQUISTAR: Record<CodigoPatente, string> = {
  explorador: "Conclua o estudo de caso do Café Mangue no Gaiamum Lab.",
  estrategista: "Num projeto REAL seu, preencha dados suficientes pra Visão 360° gerar um score (meta SMART, tarefas, ou indicadores).",
  master: "Num projeto REAL seu, gere a primeira explicação de IA do Alinhamento Gaiamum com sucesso.",
};

export default async function PaginaProgressoLab() {
  const tenantId = await garantirWorkspace();
  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const user = await obterUsuarioAtual();
  if (!user) {
    redirect("/auth");
  }

  const [totalMetasSmart, papelAtual, patentes] = await Promise.all([
    contarMetasSmart(tenantId),
    obterPapelAtual(tenantId),
    listarPatentesDoUsuario(user.id),
  ]);

  const conquistadaEm = new Map(patentes.map((p) => [p.codigo, p.conquistada_em]));
  const temExplorador = conquistadaEm.has("explorador");

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
        <div>
          <Link href="/lab" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
            ← Gaiamum Lab
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">🦀 Minha trilha</h1>
        </div>

        <div className="flex flex-col gap-3">
          {ORDEM_PATENTES.map((codigo) => {
            const data = conquistadaEm.get(codigo);
            return (
              <div key={codigo} className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gaiamum-text">{ROTULO_PATENTE[codigo]}</h2>
                  {data ? (
                    <span className="rounded-full bg-gaiamum-success/15 px-2.5 py-0.5 text-xs font-semibold text-gaiamum-success">
                      Conquistada em {new Date(data).toLocaleDateString("pt-BR")}
                    </span>
                  ) : (
                    <span className="rounded-full border border-gaiamum-border px-2.5 py-0.5 text-xs text-gaiamum-text-muted">
                      Ainda não
                    </span>
                  )}
                </div>
                {!data && <p className="mt-2 text-sm text-gaiamum-text-muted">{COMO_CONQUISTAR[codigo]}</p>}
              </div>
            );
          })}
        </div>

        {temExplorador && (
          <div>
            <BotaoRefazerLab />
          </div>
        )}
      </main>
    </div>
  );
}
