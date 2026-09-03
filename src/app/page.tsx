import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { buscarMembershipAtual } from "@/lib/ecc/membership";
import { primeiroDiaDoMesAtual, urgenciaDoPrazo } from "@/lib/ecc/kanban";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ConsolidacaoGlobal } from "@/components/financeiro/consolidacao-global";
import type { ColunaKanban, ContaAPagar, MetaSmart, Projeto, Tarefa } from "@/lib/ecc/tipos";

const ROTULO_HORIZONTE = { medio_prazo: "Médio prazo", longo_prazo: "Longo prazo" } as const;

export default async function PaginaInicial() {
  const user = await obterUsuarioAtual();

  if (!user) {
    redirect("/auth");
  }

  const membership = await buscarMembershipAtual();

  if (!membership) {
    redirect("/onboarding");
  }

  const { tenantId } = membership;
  const souOwner = membership.papel === "owner";

  // Quem entrou convidado só pra um quadro não vê o painel geral — cai
  // direto na visão de projetos, sem passar pelo onboarding do workspace
  // inteiro. O painel geral é, por enquanto, a visão do dono do workspace.
  if (membership.escopo === "projeto") {
    redirect("/projetos");
  }

  const supabase = await createClient();

  const { count: totalMetasSmart } = await supabase
    .from("metas_smart")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (!totalMetasSmart || totalMetasSmart === 0) {
    redirect("/onboarding");
  }

  const mesReferencia = primeiroDiaDoMesAtual();

  const [{ data: projetos }, { data: colunas }, { data: tarefas }, { data: metas }, { data: contasDoMes }] =
    await Promise.all([
      supabase.from("projetos").select("*").eq("tenant_id", tenantId).eq("arquivado", false),
      supabase.from("colunas_kanban").select("id, concluido").eq("tenant_id", tenantId),
      supabase.from("tarefas").select("*").eq("tenant_id", tenantId),
      supabase.from("metas_smart").select("*").eq("tenant_id", tenantId).order("criado_em", { ascending: true }),
      souOwner
        ? supabase.from("contas_a_pagar").select("*").eq("tenant_id", tenantId).eq("mes_referencia", mesReferencia)
        : Promise.resolve({ data: [] as ContaAPagar[] }),
    ]);

  const listaProjetos = (projetos as Projeto[] | null) ?? [];
  const mapaProjetos = new Map(listaProjetos.map((p) => [p.id, p]));
  const mapaColunaConcluida = new Map(
    ((colunas as Pick<ColunaKanban, "id" | "concluido">[] | null) ?? []).map((c) => [c.id, c.concluido]),
  );

  const tarefasAbertas = ((tarefas as Tarefa[] | null) ?? []).filter((t) => !mapaColunaConcluida.get(t.coluna_id));
  const porPrazo = (t: Tarefa) => new Date(t.data_limite as string).getTime();
  const tarefasAtrasadas = tarefasAbertas
    .filter((t) => urgenciaDoPrazo(t, false) === "atrasado")
    .sort((a, b) => porPrazo(a) - porPrazo(b));
  const tarefasProximas = tarefasAbertas
    .filter((t) => urgenciaDoPrazo(t, false) === "proximo")
    .sort((a, b) => porPrazo(a) - porPrazo(b));

  const listaMetas = (metas as MetaSmart[] | null) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner={souOwner} />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold text-gaiamum-text">Painel geral</h1>
        <p className="mt-1 text-gaiamum-text-muted">Tarefas, metas e financeiro num só lugar.</p>

        {tarefasAtrasadas.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-danger">
              Atrasadas ({tarefasAtrasadas.length})
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {tarefasAtrasadas.map((t) => (
                <Link
                  key={t.id}
                  href={`/projetos/${t.projeto_id}/tarefas`}
                  className="flex items-center justify-between rounded-lg border border-gaiamum-danger/40 bg-gaiamum-surface px-4 py-2.5 text-sm transition hover:border-gaiamum-danger"
                >
                  <span className="text-gaiamum-text">{t.titulo}</span>
                  <span className="text-xs text-gaiamum-text-muted">
                    {mapaProjetos.get(t.projeto_id)?.nome ?? "Projeto"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {tarefasProximas.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-warning">
              Vencendo em até 48h ({tarefasProximas.length})
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {tarefasProximas.map((t) => (
                <Link
                  key={t.id}
                  href={`/projetos/${t.projeto_id}/tarefas`}
                  className="flex items-center justify-between rounded-lg border border-gaiamum-warning/40 bg-gaiamum-surface px-4 py-2.5 text-sm transition hover:border-gaiamum-warning"
                >
                  <span className="text-gaiamum-text">{t.titulo}</span>
                  <span className="text-xs text-gaiamum-text-muted">
                    {mapaProjetos.get(t.projeto_id)?.nome ?? "Projeto"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {tarefasAtrasadas.length === 0 && tarefasProximas.length === 0 && (
          <p className="mt-8 text-sm text-gaiamum-text-muted">Nenhuma tarefa atrasada ou vencendo nos próximos dias.</p>
        )}

        {souOwner && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
              Financeiro do mês
            </h2>
            <div className="mt-3">
              <ConsolidacaoGlobal contasDoMes={(contasDoMes as ContaAPagar[] | null) ?? []} />
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">Metas SMART</h2>
            <Link href="/onboarding" className="text-sm text-gaiamum-primary hover:underline">
              Editar →
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {listaMetas.map((meta) => (
              <div key={meta.id} className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
                <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">
                  {ROTULO_HORIZONTE[meta.horizonte]}
                </p>
                <p className="mt-1 text-sm text-gaiamum-text">{meta.visao_macro}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">Seus projetos</h2>
            <Link href="/projetos" className="text-sm text-gaiamum-primary hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listaProjetos.map((p) => (
              <Link
                key={p.id}
                href={`/projetos/${p.id}/tarefas`}
                className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 transition hover:border-gaiamum-primary"
              >
                <p className="font-semibold text-gaiamum-text">{p.nome}</p>
                {p.descricao && <p className="mt-1 text-sm text-gaiamum-text-muted">{p.descricao}</p>}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
