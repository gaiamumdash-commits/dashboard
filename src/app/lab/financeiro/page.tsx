import Link from "next/link";
import { redirect } from "next/navigation";
import { obterUsuarioAtual, createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { semearCafeMangue } from "@/lib/ecc/lab/seed-cafe-mangue";
import { listarDecisoesDoProjeto } from "@/lib/ecc/decisoes";
import { passosConcluidos, MODULO_FINANCEIRO } from "@/lib/ecc/lab/progresso";
import { MISSOES_FINANCEIRO_CAFE_MANGUE, PORQUE_FINANCEIRO_CAFE_MANGUE } from "@/lib/ecc/lab/conteudo-cafe-mangue";
import type { ContaAPagar, Projeto, Tarefa } from "@/lib/ecc/tipos";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ListaMissoesEtapaLab } from "@/components/lab/lista-missoes-etapa-lab";
import { PorQueIssoExiste } from "@/components/lab/por-que-isso-existe";
import { TarefasFinanceiroLab } from "@/components/lab/tarefas-financeiro-lab";
import { GerarContaAPagarLab } from "@/components/lab/gerar-conta-a-pagar-lab";
import { ListaContasLab } from "@/components/lab/lista-contas-lab";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PaginaFinanceiroLab() {
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
  const [{ data: projeto }, { data: tarefas }, decisoes, { data: contas }, passosFinanceiro] = await Promise.all([
    supabase.from("projetos").select("*").eq("id", projetoId).maybeSingle(),
    supabase.from("tarefas").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: true }),
    listarDecisoesDoProjeto(projetoId),
    supabase
      .from("contas_a_pagar")
      .select("*")
      .eq("tenant_id", tenantIdLab)
      .order("data_vencimento", { ascending: true }),
    passosConcluidos(user.id, MODULO_FINANCEIRO),
  ]);

  const projetoTipado = projeto as Projeto;
  const listaTarefas = (tarefas as Tarefa[]) ?? [];
  const listaContas = (contas as ContaAPagar[]) ?? [];
  const decisoesComValorEstimado = decisoes.filter((d) => d.valor_estimado !== null);
  const tarefasComContaGerada = listaContas.filter((c) => c.tarefa_id).map((c) => c.tarefa_id as string);
  const decisoesComContaGerada = listaContas.filter((c) => c.decisao_id).map((c) => c.decisao_id as string);
  const totalGerado = listaContas.reduce((soma, c) => soma + c.valor, 0);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <Link href="/lab/visao-360" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
            ← Visão 360°
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Financeiro — {projetoTipado.nome}</h1>
          <p className="mt-2 text-gaiamum-text-muted">
            {listaContas.length} conta(s) lançada(s), somando {formatarMoeda(totalGerado)}.
          </p>
        </div>

        <PorQueIssoExiste texto={PORQUE_FINANCEIRO_CAFE_MANGUE} />

        <ListaMissoesEtapaLab missoes={MISSOES_FINANCEIRO_CAFE_MANGUE} passosConcluidos={passosFinanceiro} />

        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">📋 Tarefas do quadro</h2>
          <p className="mt-1 text-sm text-gaiamum-text-muted">
            Marque um valor estimado numa tarefa e gere a conta a pagar correspondente.
          </p>
          <div className="mt-3">
            <TarefasFinanceiroLab
              projetoId={projetoId}
              tarefas={listaTarefas}
              tarefasComContaGerada={tarefasComContaGerada}
            />
          </div>
        </section>

        {decisoesComValorEstimado.length > 0 && (
          <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
            <h2 className="text-lg font-semibold text-gaiamum-text">📌 Decisões com valor estimado</h2>
            <div className="mt-3 flex flex-col gap-3">
              {decisoesComValorEstimado.map((decisao) => (
                <div key={decisao.id} className="flex items-center justify-between gap-3 rounded-xl bg-gaiamum-surface-raised p-3">
                  <div>
                    <p className="text-sm font-medium text-gaiamum-text">{decisao.titulo}</p>
                    <p className="text-xs text-gaiamum-text-muted">{formatarMoeda(decisao.valor_estimado ?? 0)}</p>
                  </div>
                  <GerarContaAPagarLab
                    origem="decisao"
                    origemId={decisao.id}
                    projetoId={projetoId}
                    nomeInicial={decisao.titulo}
                    valorInicial={decisao.valor_estimado}
                    jaGerada={decisoesComContaGerada.includes(decisao.id)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">💰 Contas a pagar</h2>
          <div className="mt-3">
            <ListaContasLab contas={listaContas} mensagemVazio="Nenhuma conta lançada ainda." />
          </div>
        </section>
      </main>
    </div>
  );
}
