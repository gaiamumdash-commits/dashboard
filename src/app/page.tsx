import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { buscarMembershipAtual } from "@/lib/ecc/membership";
import { contarMetasSmart, onboardingDeMetasFoiPulado } from "@/lib/ecc/metas";
import { listarCompromissosDoDia } from "@/lib/ecc/agenda";
import { primeiroDiaDoMesAtual, urgenciaDoPrazo } from "@/lib/ecc/kanban";
import {
  calcularSaudeProjeto,
  contasVencendoEmDias,
  montarAlertasPrioritarios,
  prazoImportanteDaSemana,
  primeiroNome,
  progressoDeTarefas,
  proximoMarco,
  saudacaoPorHorario,
  selecionarMetaPrincipal,
  tarefasNaJanelaDeDias,
} from "@/lib/ecc/painel-geral";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { CardEstrategista } from "@/components/painel/card-estrategista";
import { SeuDia } from "@/components/painel/seu-dia";
import { FinanceiroDoMes } from "@/components/painel/financeiro-do-mes";
import { MetaPrincipal } from "@/components/painel/meta-principal";
import { ProjetosEmFoco, type ProjetoEmFoco } from "@/components/painel/projetos-em-foco";
import { ProximosPassos, type PassoUnificado } from "@/components/painel/proximos-passos";
import type { ColunaKanban, ContaAPagar, MetaSmart, Projeto, Receita, Tarefa } from "@/lib/ecc/tipos";

const DIAS_PROXIMOS_PASSOS = 7;
const MAX_PROXIMOS_PASSOS = 8;

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

  const totalMetasSmart = await contarMetasSmart(tenantId);
  const temMetasSmart = Boolean(totalMetasSmart);

  // Correção do P0 (2026-09-30): quem pulou o onboarding de metas não é
  // forçado de volta — ver histórico em page.tsx antes do redesenho.
  if (!temMetasSmart && !(await onboardingDeMetasFoiPulado(tenantId))) {
    redirect("/onboarding");
  }

  const mesReferencia = primeiroDiaDoMesAtual();

  const [
    { data: projetos },
    { data: colunas },
    { data: tarefas },
    { data: metas },
    { data: contasDoMes },
    { data: receitasDoMes },
    compromissosHoje,
  ] = await Promise.all([
    supabase.from("projetos").select("*").eq("tenant_id", tenantId).eq("arquivado", false),
    supabase.from("colunas_kanban").select("id, concluido, hoje").eq("tenant_id", tenantId),
    supabase.from("tarefas").select("*").eq("tenant_id", tenantId),
    supabase.from("metas_smart").select("*").eq("tenant_id", tenantId).order("criado_em", { ascending: true }),
    souOwner
      ? supabase.from("contas_a_pagar").select("*").eq("tenant_id", tenantId).eq("mes_referencia", mesReferencia)
      : Promise.resolve({ data: [] as ContaAPagar[] }),
    souOwner
      ? supabase.from("receitas").select("valor").eq("tenant_id", tenantId).eq("mes_referencia", mesReferencia)
      : Promise.resolve({ data: [] as Pick<Receita, "valor">[] }),
    listarCompromissosDoDia(tenantId),
  ]);

  const listaProjetos = (projetos as Projeto[] | null) ?? [];
  const mapaProjetos = new Map(listaProjetos.map((p) => [p.id, p]));
  const listaColunas = (colunas as Pick<ColunaKanban, "id" | "concluido" | "hoje">[] | null) ?? [];
  const mapaColunaConcluida = new Map(listaColunas.map((c) => [c.id, c.concluido]));
  const colunasConcluidoIds = new Set(listaColunas.filter((c) => c.concluido).map((c) => c.id));
  const colunasHojeIds = new Set(listaColunas.filter((c) => c.hoje).map((c) => c.id));

  const listaTarefas = (tarefas as Tarefa[] | null) ?? [];
  const tarefasAbertas = listaTarefas.filter((t) => !mapaColunaConcluida.get(t.coluna_id));
  const listaMetas = (metas as MetaSmart[] | null) ?? [];
  const listaContasDoMes = (contasDoMes as ContaAPagar[] | null) ?? [];
  const listaReceitasDoMes = (receitasDoMes as Pick<Receita, "valor">[] | null) ?? [];

  // --- "Seu dia" ---
  const tarefasHojeCount = tarefasAbertas.filter((t) => colunasHojeIds.has(t.coluna_id)).length;

  const tarefasAbertasNaSemana = tarefasNaJanelaDeDias(tarefasAbertas, DIAS_PROXIMOS_PASSOS);
  const prazoSemana = {
    quantidade: tarefasAbertasNaSemana.length,
    maisProximo: prazoImportanteDaSemana(tarefasAbertas, colunasConcluidoIds, DIAS_PROXIMOS_PASSOS),
  };

  // --- "Financeiro do mês" (alerta da faixa de saudação; o card usa a
  // mesma janela de novo, internamente, pra mostrar o próprio aviso) ---
  const contasVencendoEm7Dias = souOwner ? contasVencendoEmDias(listaContasDoMes) : null;

  // --- "Projetos em foco" ---
  const projetosEmFoco: ProjetoEmFoco[] = listaProjetos
    .filter((p) => p.status === "ativo")
    .map((projeto) => {
      const tarefasDoProjeto = tarefasAbertas.filter((t) => t.projeto_id === projeto.id);
      const tarefasAtrasadas = tarefasDoProjeto.filter((t) => urgenciaDoPrazo(t, false) === "atrasado").length;
      const proximoPrazo = tarefasDoProjeto
        .filter((t) => t.data_limite)
        .sort((a, b) => new Date(a.data_limite as string).getTime() - new Date(b.data_limite as string).getTime())[0];
      return {
        projeto,
        saude: calcularSaudeProjeto(tarefasDoProjeto, colunasConcluidoIds),
        tarefasAbertas: tarefasDoProjeto.length,
        tarefasAtrasadas,
        proximoPrazoTitulo: proximoPrazo?.titulo ?? null,
      };
    })
    .sort((a, b) => (a.saude === b.saude ? 0 : a.saude === "atencao" ? -1 : 1));

  const projetoEmDestaque = projetosEmFoco.find((p) => p.saude === "atencao")?.projeto ?? projetosEmFoco[0]?.projeto ?? null;

  // --- Faixa de saudação ---
  const tarefasAtrasadasCount = tarefasAbertas.filter((t) => urgenciaDoPrazo(t, false) === "atrasado").length;
  const alertas = montarAlertasPrioritarios({
    tarefasAtrasadas: tarefasAtrasadasCount,
    contasVencendoEm7Dias,
    compromissosHoje: compromissosHoje.status === "conectado" ? compromissosHoje.compromissos.length : compromissosHoje.status,
  });

  // --- "Meta principal" ---
  const metaPrincipal = selecionarMetaPrincipal(listaMetas);
  const projetosDaMetaIds = new Set(listaProjetos.filter((p) => p.meta_smart_id === metaPrincipal?.id).map((p) => p.id));
  const tarefasDaMeta = listaTarefas.filter((t) => projetosDaMetaIds.has(t.projeto_id));
  const progressoMeta = progressoDeTarefas(tarefasDaMeta, colunasConcluidoIds);
  const marcoMeta = proximoMarco(tarefasDaMeta, colunasConcluidoIds);

  // --- "Próximos passos" ---
  const passosUnificados: PassoUnificado[] = tarefasAbertasNaSemana
    .sort((a, b) => new Date(a.data_limite as string).getTime() - new Date(b.data_limite as string).getTime())
    .slice(0, MAX_PROXIMOS_PASSOS)
    .map((t) => ({
      tarefa: t,
      nomeProjeto: mapaProjetos.get(t.projeto_id)?.nome ?? "Projeto",
      atrasada: urgenciaDoPrazo(t, false) === "atrasado",
    }));

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={temMetasSmart} souOwner={souOwner} />
      <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold text-gaiamum-text">Painel geral</h1>
          <p className="mt-1 text-gaiamum-text-muted">Seu centro de decisões, execução e crescimento.</p>
          <p className="mt-3 text-sm text-gaiamum-text">
            {saudacaoPorHorario(new Date())}, {primeiroNome(user.email ?? "")}. Aqui está o que merece sua atenção
            hoje.
          </p>
        </div>

        <CardEstrategista
          alertas={alertas}
          hrefAnaliseCompleta={projetoEmDestaque ? `/projetos/${projetoEmDestaque.id}/visao-360` : null}
        />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">Seu dia</h2>
            <Link href="/agenda" className="text-sm text-gaiamum-primary hover:underline">
              Abrir agenda →
            </Link>
          </div>
          <SeuDia tarefasHoje={tarefasHojeCount} compromissos={compromissosHoje} prazoSemana={prazoSemana} />
        </section>

        <div className="grid gap-8 lg:grid-cols-3">
          {souOwner && (
            <section className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
                  Financeiro do mês
                </h2>
                <Link href="/financeiro" className="text-sm text-gaiamum-primary hover:underline">
                  Ver financeiro →
                </Link>
              </div>
              <FinanceiroDoMes contasDoMes={listaContasDoMes} receitasDoMes={listaReceitasDoMes} />
            </section>
          )}

          <section className={souOwner ? "lg:col-span-1" : "lg:col-span-3"}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
                Meta principal
              </h2>
              <Link href="/onboarding" className="text-sm text-gaiamum-primary hover:underline">
                Ver metas →
              </Link>
            </div>
            <MetaPrincipal meta={metaPrincipal} progresso={progressoMeta} marco={marcoMeta} />
          </section>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
                Projetos em foco
              </h2>
              <Link href="/projetos" className="text-sm text-gaiamum-primary hover:underline">
                Ver todos →
              </Link>
            </div>
            <ProjetosEmFoco projetos={projetosEmFoco} />
          </section>

          <section className="lg:col-span-1">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
              Próximos passos
            </h2>
            <ProximosPassos passos={passosUnificados} />
          </section>
        </div>
      </main>
    </div>
  );
}
