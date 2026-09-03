import Link from "next/link";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { listarEntrevistas } from "@/lib/ecc/entrevista";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { BotaoNovaEntrevista } from "@/components/marketing/botao-nova-entrevista";

const ROTULO_ESTAGIO: Record<string, string> = {
  situacao: "Situação",
  problema: "Problema",
  implicacao: "Implicação",
  necessidade: "Necessidade",
  concluida: "Concluída",
};

export default async function PaginaEntrevistas() {
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const entrevistas = await listarEntrevistas(tenantId);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href="/marketing" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Marketing
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Entrevista guiada</h1>
        <p className="mt-1 text-gaiamum-text-muted">
          Um passo a passo com prompts prontos pra rodar no Claude Code (sem gastar API): copie o prompt de
          cada etapa, converse por lá, cole a resposta de volta aqui — no final, Perfil, Produto e Avatar
          são preenchidos sozinhos.
        </p>

        <div className="mt-8">
          <BotaoNovaEntrevista />
        </div>

        <div className="mt-8 flex flex-col gap-2">
          {entrevistas.map((entrevista) => (
            <Link
              key={entrevista.id}
              href={`/marketing/entrevista/${entrevista.id}`}
              className="flex items-center justify-between rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 transition hover:border-gaiamum-primary"
            >
              <span className="text-sm text-gaiamum-text">
                {new Date(entrevista.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </span>
              <span className="text-xs text-gaiamum-text-muted">{ROTULO_ESTAGIO[entrevista.estagio_atual]}</span>
            </Link>
          ))}
          {entrevistas.length === 0 && (
            <p className="text-sm text-gaiamum-text-muted">Nenhuma entrevista ainda. Comece a primeira acima.</p>
          )}
        </div>
      </main>
    </div>
  );
}
