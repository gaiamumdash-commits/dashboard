import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listarEventosGoogleCalendar } from "@/lib/ecc/google-calendar";
import type { ColunaKanban, ContaAPagar, EventoAgenda, ItemAgenda, ResultadoAgenda, Tarefa } from "@/lib/ecc/tipos";

/** Junta os eventos do Google Calendar com as contas a pagar em aberto e as
 * tarefas com prazo (ambas só existiam no Financeiro/Kanban, sem aparecer
 * na Agenda) numa lista única, ordenada por data. `souOwner` evita consultar
 * `contas_a_pagar` à toa pra quem não tem acesso (a RLS já bloquearia e
 * devolveria vazio, mas a consulta seria desperdiçada). */
export async function listarAgendaUnificada(
  tenantId: string,
  souOwner: boolean,
): Promise<{ google: ResultadoAgenda; itens: ItemAgenda[] }> {
  const supabase = await createClient();

  const [google, resultadoContas, resultadoTarefas, resultadoColunas, resultadoEventos] = await Promise.all([
    listarEventosGoogleCalendar(),
    souOwner
      ? supabase
          .from("contas_a_pagar")
          .select("id, nome, valor, data_vencimento")
          .eq("tenant_id", tenantId)
          .eq("pago", false)
      : Promise.resolve({ data: [] as Pick<ContaAPagar, "id" | "nome" | "valor" | "data_vencimento">[] }),
    supabase
      .from("tarefas")
      .select("id, titulo, data_limite, coluna_id, projeto_id")
      .eq("tenant_id", tenantId)
      .not("data_limite", "is", null),
    supabase.from("colunas_kanban").select("id, concluido").eq("tenant_id", tenantId),
    supabase.from("eventos_agenda").select("id, titulo, inicio").eq("tenant_id", tenantId),
  ]);

  const mapaColunaConcluida = new Map(
    ((resultadoColunas.data as Pick<ColunaKanban, "id" | "concluido">[] | null) ?? []).map((c) => [
      c.id,
      c.concluido,
    ]),
  );

  const itensContas: ItemAgenda[] = (
    (resultadoContas.data as Pick<ContaAPagar, "id" | "nome" | "valor" | "data_vencimento">[] | null) ?? []
  ).map((conta) => ({
    id: conta.id,
    fonte: "conta_a_pagar",
    titulo: conta.nome,
    quando: conta.data_vencimento,
    link: "/financeiro",
    badge: conta.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  }));

  const itensTarefas: ItemAgenda[] = (
    (resultadoTarefas.data as Pick<Tarefa, "id" | "titulo" | "data_limite" | "coluna_id" | "projeto_id">[] | null) ??
    []
  )
    .filter((tarefa) => !mapaColunaConcluida.get(tarefa.coluna_id))
    .map((tarefa) => ({
      id: tarefa.id,
      fonte: "tarefa",
      titulo: tarefa.titulo,
      quando: tarefa.data_limite as string,
      link: `/projetos/${tarefa.projeto_id}/tarefas`,
      badge: null,
    }));

  const itensGoogle: ItemAgenda[] =
    google.status === "conectado"
      ? google.eventos.map((evento) => ({
          id: evento.id,
          fonte: "google",
          titulo: evento.titulo,
          quando: evento.inicio,
          link: evento.link,
          badge: null,
        }))
      : [];

  const itensManuais: ItemAgenda[] = (
    (resultadoEventos.data as Pick<EventoAgenda, "id" | "titulo" | "inicio">[] | null) ?? []
  ).map((evento) => ({
    id: evento.id,
    fonte: "evento_agenda",
    titulo: evento.titulo,
    quando: evento.inicio,
    link: null,
    badge: null,
  }));

  const itens = [...itensGoogle, ...itensContas, ...itensTarefas, ...itensManuais].sort(
    (a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime(),
  );

  return { google, itens };
}
