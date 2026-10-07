import "server-only";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { listarAgendaUnificada } from "@/lib/ecc/agenda";
import { limitesDaSemana } from "@/lib/ecc/semana";
import { hojeISOBrasil } from "@/lib/ecc/kanban";
import { segundaDaChave, somarDiasChave } from "@/lib/ecc/planner/regras";
import type { ItemAgenda, MetaSmart, ResultadoAgenda } from "@/lib/ecc/tipos";
import type {
  AreaPlanner,
  CelulaCardapio,
  CompromissoPlanner,
  CursoPlanner,
  HabitoPlanner,
  ItemCompra,
  LeituraPlanner,
  ManutencaoPlanner,
  NotaPlanner,
  ObjetivoPlanner,
  PetPlanner,
  PreferenciasPlanner,
  RegistroHabito,
} from "@/lib/ecc/planner/tipos";

// Leituras do Planner no servidor. Toda consulta usa o client da sessão
// (RLS `planner_eh_meu`): só as linhas da própria pessoa voltam, mesmo sem
// filtro por user_id aqui. O `.eq("tenant_id")` restringe ao workspace ativo
// (quem participa de 2 workspaces tem um Planner em cada).

/** O que toda tela do Planner precisa antes de qualquer dado: workspace
 * (sessão — `garantirWorkspace` manda pro login se não houver), papel,
 * escopo e o e-mail pra saudação. */
export async function contextoPlanner() {
  const tenantId = await garantirWorkspace();
  const [usuario, papel, acessoCompleto, totalMetas] = await Promise.all([
    obterUsuarioAtual(),
    obterPapelAtual(tenantId),
    temAcessoCompleto(tenantId),
    contarMetasSmart(tenantId),
  ]);
  return {
    tenantId,
    email: usuario?.email ?? "",
    souOwner: papel === "owner",
    acessoCompleto,
    temMetasSmart: Boolean(totalMetas && totalMetas > 0),
  };
}

export type SemanaAtual = { hoje: string; segunda: string; fimExclusivo: string };

export function semanaAtual(): SemanaAtual {
  const hoje = hojeISOBrasil();
  const segunda = segundaDaChave(hoje);
  return { hoje, segunda, fimExclusivo: somarDiasChave(segunda, 7) };
}

const COLUNAS_HABITO = "id, tenant_id, user_id, nome, area, tipo, dias_semana, horario, duracao_minutos, ativo, criado_em, atualizado_em";

async function habitosERegistros(tenantId: string, semana: SemanaAtual, area?: AreaPlanner) {
  const supabase = await createClient();
  let consultaHabitos = supabase.from("planner_habitos").select(COLUNAS_HABITO).eq("tenant_id", tenantId).order("criado_em");
  if (area) consultaHabitos = consultaHabitos.eq("area", area);
  const [{ data: habitos, error: erroHabitos }, { data: registros, error: erroRegistros }] = await Promise.all([
    consultaHabitos,
    supabase
      .from("planner_habito_registros")
      .select("id, habito_id, data")
      .eq("tenant_id", tenantId)
      .gte("data", semana.segunda)
      .lt("data", semana.fimExclusivo),
  ]);
  if (erroHabitos || erroRegistros) {
    throw new Error("Não foi possível carregar seus hábitos.");
  }
  return {
    habitos: (habitos as HabitoPlanner[] | null) ?? [],
    registros: (registros as RegistroHabito[] | null) ?? [],
  };
}

export type DadosVisaoGeral = {
  semana: SemanaAtual;
  preferencias: PreferenciasPlanner | null;
  habitos: HabitoPlanner[];
  registros: RegistroHabito[];
  compromissosSemana: CompromissoPlanner[];
  objetivosAtivos: Pick<ObjetivoPlanner, "id" | "area">[];
  leiturasEmAndamento: number;
  comprasPendentes: number;
  diasCardapio: { dia_semana: number }[];
  proximaConsulta: Pick<CompromissoPlanner, "id" | "titulo" | "inicio"> | null;
  lembretesSaude: number;
  agenda: { google: ResultadoAgenda; itens: ItemAgenda[] } | null;
};

/** "Meu Planner": tudo que os cards da visão geral mostram, numa rodada só
 * de consultas paralelas (sem N+1). A Agenda real entra pela própria
 * `listarAgendaUnificada` (Google + contas + tarefas + eventos + decisões),
 * só pra quem tem acesso completo ao workspace — mesmo critério da página
 * /agenda. */
export async function carregarVisaoGeral(
  tenantId: string,
  opcoes: { souOwner: boolean; acessoCompleto: boolean },
): Promise<DadosVisaoGeral> {
  const semana = semanaAtual();
  const supabase = await createClient();
  const { inicio, fimExclusivo } = limitesDaSemana(semana.segunda);
  const agora = new Date().toISOString();

  const [
    habitosERegs,
    { data: preferencias },
    { data: compromissos },
    { data: objetivos },
    { count: leiturasEmAndamento },
    { count: comprasPendentes },
    { data: cardapio },
    { data: proximaConsulta },
    { count: lembretesSaude },
    agenda,
  ] = await Promise.all([
    habitosERegistros(tenantId, semana),
    supabase.from("planner_preferencias").select("areas").eq("tenant_id", tenantId).maybeSingle(),
    supabase
      .from("planner_compromissos")
      .select("id, titulo, area, tipo, inicio, local, notas, pet_id, concluido")
      .eq("tenant_id", tenantId)
      .gte("inicio", inicio.toISOString())
      .lt("inicio", fimExclusivo.toISOString())
      .order("inicio"),
    supabase.from("planner_objetivos").select("id, area").eq("tenant_id", tenantId).eq("status", "em_andamento"),
    supabase.from("planner_leituras").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "lendo"),
    supabase.from("planner_compras").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("comprado", false),
    supabase.from("planner_cardapio").select("dia_semana").eq("tenant_id", tenantId).eq("semana", semana.segunda),
    supabase
      .from("planner_compromissos")
      .select("id, titulo, inicio")
      .eq("tenant_id", tenantId)
      .eq("tipo", "consulta")
      .eq("concluido", false)
      .gte("inicio", agora)
      .order("inicio")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("planner_compromissos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("area", "saude")
      .eq("concluido", false)
      .gte("inicio", agora),
    opcoes.acessoCompleto
      ? listarAgendaUnificada(tenantId, opcoes.souOwner, inicio, fimExclusivo, true, false)
      : Promise.resolve(null),
  ]);

  return {
    semana,
    preferencias: (preferencias as PreferenciasPlanner | null) ?? null,
    habitos: habitosERegs.habitos,
    registros: habitosERegs.registros,
    compromissosSemana: (compromissos as CompromissoPlanner[] | null) ?? [],
    objetivosAtivos: (objetivos as Pick<ObjetivoPlanner, "id" | "area">[] | null) ?? [],
    leiturasEmAndamento: leiturasEmAndamento ?? 0,
    comprasPendentes: comprasPendentes ?? 0,
    diasCardapio: (cardapio as { dia_semana: number }[] | null) ?? [],
    proximaConsulta: (proximaConsulta as Pick<CompromissoPlanner, "id" | "titulo" | "inicio"> | null) ?? null,
    lembretesSaude: lembretesSaude ?? 0,
    agenda,
  };
}

export type DadosArea = {
  semana: SemanaAtual;
  habitos: HabitoPlanner[];
  registros: RegistroHabito[];
  objetivos: ObjetivoPlanner[];
  notas: NotaPlanner[];
  compromissos: CompromissoPlanner[];
  leituras: LeituraPlanner[];
  cursos: CursoPlanner[];
  compras: ItemCompra[];
  cardapio: CelulaCardapio[];
  pets: PetPlanner[];
  manutencoes: ManutencaoPlanner[];
  metasSmart: Pick<MetaSmart, "id" | "horizonte" | "specific" | "time_bound">[];
};

/** Uma área do Planner (Pessoal, Estudos, Casa ou Saúde): só as tabelas
 * que aquela área usa — Casa não lê leituras, Estudos não lê compras.
 * Compromissos: a partir de 30 dias atrás (histórico recente + próximos). */
export async function carregarArea(
  tenantId: string,
  area: AreaPlanner,
  opcoes: { acessoCompleto: boolean },
): Promise<DadosArea> {
  const semana = semanaAtual();
  const supabase = await createClient();
  const vazio = Promise.resolve({ data: [] as never[] });
  const desde = somarDiasChave(semana.hoje, -30);

  const [
    habitosERegs,
    { data: objetivos },
    { data: notas },
    { data: compromissos },
    { data: leituras },
    { data: cursos },
    { data: compras },
    { data: cardapio },
    { data: pets },
    { data: manutencoes },
    { data: metasSmart },
  ] = await Promise.all([
    habitosERegistros(tenantId, semana, area),
    supabase.from("planner_objetivos").select("*").eq("tenant_id", tenantId).eq("area", area).order("criado_em"),
    supabase.from("planner_notas").select("id, area, titulo, conteudo, atualizado_em").eq("tenant_id", tenantId).eq("area", area).order("atualizado_em", { ascending: false }),
    supabase
      .from("planner_compromissos")
      .select("id, titulo, area, tipo, inicio, local, notas, pet_id, concluido")
      .eq("tenant_id", tenantId)
      .eq("area", area)
      .gte("inicio", `${desde}T00:00:00Z`)
      .order("inicio"),
    area === "estudos" ? supabase.from("planner_leituras").select("*").eq("tenant_id", tenantId).order("criado_em") : vazio,
    area === "estudos" ? supabase.from("planner_cursos").select("*").eq("tenant_id", tenantId).order("criado_em") : vazio,
    area === "casa" ? supabase.from("planner_compras").select("*").eq("tenant_id", tenantId).order("categoria").order("criado_em") : vazio,
    area === "casa" ? supabase.from("planner_cardapio").select("*").eq("tenant_id", tenantId).eq("semana", semana.segunda) : vazio,
    area === "casa" ? supabase.from("planner_pets").select("*").eq("tenant_id", tenantId).order("nome") : vazio,
    area === "casa"
      ? supabase.from("planner_manutencoes").select("*").eq("tenant_id", tenantId).eq("ativo", true).order("proxima_data", { nullsFirst: false })
      : vazio,
    // Objetivos de Pessoal/Estudos mostram as Metas SMART do negócio como
    // referência (só leitura) — decisão do Fabio, 2026-10-07. RLS de
    // metas_smart exige acesso completo ao workspace.
    (area === "pessoal" || area === "estudos") && opcoes.acessoCompleto
      ? supabase.from("metas_smart").select("id, horizonte, specific, time_bound").eq("tenant_id", tenantId)
      : vazio,
  ]);

  return {
    semana,
    habitos: habitosERegs.habitos,
    registros: habitosERegs.registros,
    objetivos: (objetivos as ObjetivoPlanner[] | null) ?? [],
    notas: (notas as NotaPlanner[] | null) ?? [],
    compromissos: (compromissos as CompromissoPlanner[] | null) ?? [],
    leituras: (leituras as LeituraPlanner[] | null) ?? [],
    cursos: (cursos as CursoPlanner[] | null) ?? [],
    compras: (compras as ItemCompra[] | null) ?? [],
    cardapio: (cardapio as CelulaCardapio[] | null) ?? [],
    pets: (pets as PetPlanner[] | null) ?? [],
    manutencoes: (manutencoes as ManutencaoPlanner[] | null) ?? [],
    metasSmart: (metasSmart as Pick<MetaSmart, "id" | "horizonte" | "specific" | "time_bound">[] | null) ?? [],
  };
}
