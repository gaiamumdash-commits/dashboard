import Link from "next/link";
import { redirect } from "next/navigation";
import { obterUsuarioAtual, createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { semearCafeMangue } from "@/lib/ecc/lab/seed-cafe-mangue";
import { concluirLab } from "@/lib/ecc/lab/actions";
import { listarDecisoesDoProjeto } from "@/lib/ecc/decisoes";
import { listarIndicadoresDoProjeto } from "@/lib/ecc/indicadores";
import { calcularAlinhamentoGaiamum } from "@/lib/ecc/visao-360";
import {
  EXPLICACAO_SIMULADA_CAFE_MANGUE,
  ESTATISTICAS_FICTICIAS_CAFE_MANGUE,
  MISSOES_VISAO_360_CAFE_MANGUE,
} from "@/lib/ecc/lab/conteudo-cafe-mangue";
import { passosConcluidos, MODULO_DECISOES_INDICADORES } from "@/lib/ecc/lab/progresso";
import type { ColunaKanban, MetaSmart, Projeto, Tarefa } from "@/lib/ecc/tipos";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { AlinhamentoGaiamumBloco } from "@/components/projetos/alinhamento-gaiamum";
import { ExplicacaoSimulada } from "@/components/lab/explicacao-simulada";
import { EstatisticaFicticia } from "@/components/lab/estatistica-ficticia";
import { ListaDecisoesLab } from "@/components/lab/lista-decisoes-lab";
import { ListaIndicadoresLab } from "@/components/lab/lista-indicadores-lab";
import { ListaMissoesVisao360Lab } from "@/components/lab/lista-missoes-visao-360-lab";

export default async function PaginaVisao360Lab() {
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
  const [{ data: projeto }, { data: colunas }, { data: tarefas }, { data: metasSmart }, decisoes, indicadores, passosDecisoesIndicadores] =
    await Promise.all([
      supabase.from("projetos").select("*").eq("id", projetoId).maybeSingle(),
      supabase.from("colunas_kanban").select("*").eq("projeto_id", projetoId),
      supabase.from("tarefas").select("*").eq("projeto_id", projetoId),
      supabase.from("metas_smart").select("*").eq("tenant_id", tenantIdLab),
      listarDecisoesDoProjeto(projetoId),
      listarIndicadoresDoProjeto(projetoId),
      passosConcluidos(user.id, MODULO_DECISOES_INDICADORES),
    ]);

  const projetoTipado = projeto as Projeto;
  const listaColunas = (colunas as ColunaKanban[]) ?? [];
  const listaTarefas = (tarefas as Tarefa[]) ?? [];
  const listaMetasSmart = (metasSmart as MetaSmart[]) ?? [];
  const colunasConcluidoIds = new Set(listaColunas.filter((c) => c.concluido).map((c) => c.id));
  const marcos = listaTarefas.filter((t) => t.is_marco);

  const alinhamento = calcularAlinhamentoGaiamum({
    metaSmartId: projetoTipado.meta_smart_id,
    tarefas: listaTarefas,
    colunasConcluidoIds,
    indicadores,
  });

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <Link href="/lab/quadro" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
            ← Quadro do Café do Mangue
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Visão 360°</h1>
          <p className="mt-2 text-gaiamum-text-muted">
            Esse score é calculado pela mesma fórmula do Gaiamum de verdade — 4 fatores, cada um
            com o peso mostrado abaixo. Repare como a tarefa atrasada no quadro pesa aqui.
          </p>
        </div>

        <AlinhamentoGaiamumBloco alinhamento={alinhamento} />

        <ExplicacaoSimulada texto={EXPLICACAO_SIMULADA_CAFE_MANGUE} />

        <ListaMissoesVisao360Lab missoes={MISSOES_VISAO_360_CAFE_MANGUE} passosConcluidos={passosDecisoesIndicadores} />

        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">🚩 Marcos</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {marcos.map((marco) => (
              <li key={marco.id} className="flex items-center justify-between gap-3 text-sm">
                <span className={colunasConcluidoIds.has(marco.coluna_id) ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"}>
                  {marco.titulo}
                </span>
                {marco.data_limite && (
                  <span className="shrink-0 text-xs text-gaiamum-text-muted">
                    {new Date(marco.data_limite).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">📊 Indicadores</h2>
          <div className="mt-3">
            <ListaIndicadoresLab projetoId={projetoId} indicadoresIniciais={indicadores} />
          </div>
        </section>

        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">📋 Decisões</h2>
          <div className="mt-3">
            <ListaDecisoesLab projetoId={projetoId} decisoesIniciais={decisoes} metasSmart={listaMetasSmart} />
          </div>
        </section>

        <EstatisticaFicticia texto={ESTATISTICAS_FICTICIAS_CAFE_MANGUE[1]} />

        <form action={concluirLab}>
          <button
            type="submit"
            className="rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-white transition hover:bg-gaiamum-primary-dark"
          >
            Concluir o Lab 🦀
          </button>
        </form>
      </main>
    </div>
  );
}
