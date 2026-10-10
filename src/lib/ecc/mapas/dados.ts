import "server-only";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { contextoPlanner } from "@/lib/ecc/planner/dados";
import { estadoHiperfoco, formatarDataHoraBrasil, urgenciaDoPrazo } from "@/lib/ecc/kanban";
import type { EstadoVinculo, Mapa, NoMapa, OpcoesExecucao, VinculoRamo } from "@/lib/ecc/mapas/tipos";

// Leituras dos Mapas. A RLS (migration 0059) devolve os mapas da pessoa e
// os compartilhados com o workspace; aqui separamos os dois.

const COLUNAS_MAPA = "id, tenant_id, user_id, titulo, compartilhado, criado_em, atualizado_em";
const COLUNAS_NO = "id, mapa_id, pai_id, ordem, texto, nota, recolhido, tarefa_id, compromisso_id";
const COLUNAS_POSICAO = ", pos_x, pos_y, cor, forma";

/** Mesmo contexto do Planner (menu lateral, papel, acesso) + quem sou eu. */
export async function contextoMapas() {
  const [ctx, usuario] = await Promise.all([contextoPlanner(), obterUsuarioAtual()]);
  return { ...ctx, userId: usuario?.id ?? "" };
}

export async function listarMapas(tenantId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mapas")
    .select(COLUNAS_MAPA)
    .eq("tenant_id", tenantId)
    .order("atualizado_em", { ascending: false })
    .limit(200);
  if (error) console.error("Mapas: listar", error);
  const todos = (data ?? []) as Mapa[];
  return {
    // Tabela ainda não criada em produção (migration 0059 pendente) ou
    // banco fora do ar: a tela avisa em vez de oferecer criar e falhar.
    indisponivel: Boolean(error),
    meus: todos.filter((m) => m.user_id === userId),
    compartilhados: todos.filter((m) => m.user_id !== userId),
  };
}

/** Mapa + ramos, ou null se não existe / não é visível pra esta pessoa.
 * `posicoesDisponiveis` = false enquanto a migration 0060 (pos_x/pos_y) não
 * roda em produção: o mapa abre no layout automático e arrastar não salva. */
export async function carregarMapa(
  tenantId: string,
  mapaId: string,
): Promise<{ mapa: Mapa; nos: NoMapa[]; posicoesDisponiveis: boolean } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(mapaId)) return null;
  const supabase = await createClient();
  const ramos = (colunas: string) => supabase.from("mapa_nos").select(colunas).eq("mapa_id", mapaId).eq("tenant_id", tenantId);
  const [{ data: mapa, error }, comPosicao] = await Promise.all([
    supabase.from("mapas").select(COLUNAS_MAPA).eq("id", mapaId).eq("tenant_id", tenantId).maybeSingle(),
    ramos(COLUNAS_NO + COLUNAS_POSICAO),
  ]);
  let nos = comPosicao.data as unknown as NoMapa[] | null;
  let posicoesDisponiveis = !comPosicao.error;
  if (comPosicao.error) {
    // 42703 = coluna não existe (0060 pendente). Outro erro: registra.
    if (comPosicao.error.code !== "42703") console.error("Mapas: carregar ramos", comPosicao.error);
    const semPosicao = await ramos(COLUNAS_NO);
    if (semPosicao.error) console.error("Mapas: carregar ramos", semPosicao.error);
    nos = semPosicao.data as unknown as NoMapa[] | null;
    posicoesDisponiveis = false;
  }
  if (error) console.error("Mapas: carregar", error);
  if (!mapa) return null;
  return { mapa: mapa as Mapa, nos: nos ?? [], posicoesDisponiveis };
}

const HORAS_ALERTA = 48;

function quando(iso: string): string {
  return formatarDataHoraBrasil(new Date(iso), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Estado das tarefas/compromissos ligados aos ramos, com as regras de
 * lá: a cor da tarefa é a do Kanban (`urgenciaDoPrazo`); o compromisso
 * segue o mesmo limiar de 48h. Tarefa de projeto sem acesso = indisponível
 * (a RLS do projeto não devolve a linha — nada vaza). */
export async function carregarVinculos(tenantId: string, nos: NoMapa[]): Promise<Record<string, VinculoRamo>> {
  const tarefaIds = [...new Set(nos.map((n) => n.tarefa_id).filter((v): v is string => Boolean(v)))];
  const compromissoIds = [...new Set(nos.map((n) => n.compromisso_id).filter((v): v is string => Boolean(v)))];
  if (tarefaIds.length === 0 && compromissoIds.length === 0) return {};

  const supabase = await createClient();
  const [{ data: tarefas }, { data: compromissos }] = await Promise.all([
    tarefaIds.length
      ? supabase
          .from("tarefas")
          .select("id, titulo, projeto_id, data_limite, hiperfoco_iniciado_em, tempo_estimado_min, colunas_kanban(concluido)")
          .eq("tenant_id", tenantId)
          .in("id", tarefaIds)
      : Promise.resolve({ data: [] }),
    compromissoIds.length
      ? supabase.from("planner_compromissos").select("id, titulo, inicio, concluido").eq("tenant_id", tenantId).in("id", compromissoIds)
      : Promise.resolve({ data: [] }),
  ]);

  type LinhaTarefa = {
    id: string;
    projeto_id: string;
    data_limite: string | null;
    hiperfoco_iniciado_em: string | null;
    tempo_estimado_min: number | null;
    colunas_kanban: { concluido: boolean } | { concluido: boolean }[] | null;
  };
  const porTarefa = new Map(((tarefas ?? []) as unknown as LinhaTarefa[]).map((t) => [t.id, t]));
  const porCompromisso = new Map(((compromissos ?? []) as { id: string; inicio: string; concluido: boolean }[]).map((c) => [c.id, c]));
  const agora = Date.now();
  const r: Record<string, VinculoRamo> = {};

  for (const no of nos) {
    if (no.tarefa_id) {
      const t = porTarefa.get(no.tarefa_id);
      if (!t) {
        r[no.id] = { tipo: "tarefa", estado: "indisponivel", rotulo: "Tarefa sem acesso ou excluída", href: null, focoAtivo: false };
        continue;
      }
      const coluna = Array.isArray(t.colunas_kanban) ? t.colunas_kanban[0] : t.colunas_kanban;
      const concluida = Boolean(coluna?.concluido);
      const urgencia = urgenciaDoPrazo(t, concluida);
      const estado: EstadoVinculo = concluida ? "concluido" : urgencia === "atrasado" ? "atrasado" : urgencia === "proximo" ? "proximo" : urgencia === "sem_prazo" ? "sem_prazo" : "ok";
      const foco = estadoHiperfoco(t.hiperfoco_iniciado_em, t.tempo_estimado_min);
      r[no.id] = {
        tipo: "tarefa",
        estado,
        rotulo: concluida ? "Tarefa concluída" : t.data_limite ? `Tarefa · prazo ${quando(t.data_limite)}` : "Tarefa · sem prazo",
        href: `/projetos/${t.projeto_id}/tarefas`,
        focoAtivo: foco === "ativo" || foco === "metade",
      };
    } else if (no.compromisso_id) {
      const c = porCompromisso.get(no.compromisso_id);
      if (!c) {
        r[no.id] = { tipo: "compromisso", estado: "indisponivel", rotulo: "Compromisso excluído", href: null, focoAtivo: false };
        continue;
      }
      const horas = (new Date(c.inicio).getTime() - agora) / 3_600_000;
      const estado: EstadoVinculo = c.concluido ? "concluido" : horas <= 0 ? "atrasado" : horas <= HORAS_ALERTA ? "proximo" : "ok";
      r[no.id] = {
        tipo: "compromisso",
        estado,
        rotulo: c.concluido ? "Compromisso feito" : `Compromisso · ${quando(c.inicio)}`,
        href: "/planner",
        focoAtivo: false,
      };
    }
  }
  return r;
}

/** Projetos (e colunas, menos "Concluído") onde a pessoa pode criar tarefa
 * — a RLS do Kanban decide quais aparecem. */
export async function carregarOpcoesExecucao(tenantId: string): Promise<OpcoesExecucao> {
  const supabase = await createClient();
  const [{ data: projetos }, { data: colunas }] = await Promise.all([
    supabase.from("projetos").select("id, nome").eq("tenant_id", tenantId).neq("status", "concluido").order("nome").limit(100),
    supabase.from("colunas_kanban").select("id, nome, projeto_id, ordem").eq("tenant_id", tenantId).eq("concluido", false).order("ordem"),
  ]);
  const lista = (colunas ?? []) as { id: string; nome: string; projeto_id: string }[];
  return {
    projetos: ((projetos ?? []) as { id: string; nome: string }[])
      .map((p) => ({ ...p, colunas: lista.filter((c) => c.projeto_id === p.id).map(({ id, nome }) => ({ id, nome })) }))
      .filter((p) => p.colunas.length > 0),
  };
}
