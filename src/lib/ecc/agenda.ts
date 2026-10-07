import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listarEventosGoogleCalendar } from "@/lib/ecc/google-calendar";
import { limitesDoDia, paraDataISO } from "@/lib/ecc/semana";
import { FUSO_BRASIL } from "@/lib/ecc/kanban";
import type {
  ColunaKanban,
  ContaAPagar,
  Decisao,
  EventoAgenda,
  ItemAgenda,
  ResultadoAgenda,
  Tarefa,
} from "@/lib/ecc/tipos";
import type { CompromissoPlanner, ManutencaoPlanner } from "@/lib/ecc/planner/tipos";

/** Junta os eventos do Google Calendar com as contas a pagar em aberto, as
 * tarefas com prazo e as decisões (todas só existiam no Financeiro/Kanban/
 * Decisões, sem aparecer na Agenda) numa lista única, ordenada por data —
 * só da janela `[inicioSemana, fimSemanaExclusivo)`, que alimenta a grade
 * semanal. `souOwner` evita consultar `contas_a_pagar`/`decisoes` à toa pra
 * quem não tem acesso (a RLS já bloquearia e devolveria vazio, mas a
 * consulta seria desperdiçada). */
export async function listarAgendaUnificada(
  tenantId: string,
  souOwner: boolean,
  inicioSemana: Date,
  fimSemanaExclusivo: Date,
  incluirGoogle: boolean = true,
  /** Compromissos e manutenções do Planner (migration 0057). Dado pessoal:
   * a RLS só devolve as linhas da própria pessoa, então ninguém vê o Planner
   * de outro membro na Agenda. O próprio Planner passa `false` (já lê essas
   * tabelas com o estado de "concluído" que a Agenda não precisa). */
  incluirPlanner: boolean = true,
): Promise<{ google: ResultadoAgenda; itens: ItemAgenda[] }> {
  const supabase = await createClient();
  const inicioIso = inicioSemana.toISOString();
  const fimIso = fimSemanaExclusivo.toISOString();

  const [
    google,
    resultadoContas,
    resultadoTarefas,
    resultadoColunas,
    resultadoEventos,
    resultadoDecisoes,
    resultadoCompromissosPlanner,
    resultadoManutencoesPlanner,
  ] = await Promise.all([
      incluirGoogle
        ? listarEventosGoogleCalendar(inicioSemana, fimSemanaExclusivo)
        : Promise.resolve<ResultadoAgenda>({ status: "nao_conectado" }),
      souOwner
        ? supabase
            .from("contas_a_pagar")
            .select("id, nome, valor, data_vencimento")
            .eq("tenant_id", tenantId)
            .eq("pago", false)
            .gte("data_vencimento", paraDataISO(inicioSemana))
            .lt("data_vencimento", paraDataISO(fimSemanaExclusivo))
        : Promise.resolve({ data: [] as Pick<ContaAPagar, "id" | "nome" | "valor" | "data_vencimento">[] }),
      supabase
        .from("tarefas")
        .select("id, titulo, data_limite, coluna_id, projeto_id")
        .eq("tenant_id", tenantId)
        .not("data_limite", "is", null)
        .gte("data_limite", inicioIso)
        .lt("data_limite", fimIso),
      supabase.from("colunas_kanban").select("id, concluido").eq("tenant_id", tenantId),
      supabase
        .from("eventos_agenda")
        .select("id, titulo, inicio, fim")
        .eq("tenant_id", tenantId)
        .gte("inicio", inicioIso)
        .lt("inicio", fimIso),
      souOwner
        ? supabase
            .from("decisoes")
            .select("id, titulo, projeto_id, data")
            .eq("tenant_id", tenantId)
            .gte("data", inicioIso)
            .lt("data", fimIso)
        : Promise.resolve({ data: [] as Pick<Decisao, "id" | "titulo" | "projeto_id" | "data">[] }),
      incluirPlanner
        ? supabase
            .from("planner_compromissos")
            .select("id, titulo, area, inicio, local")
            .eq("tenant_id", tenantId)
            .eq("concluido", false)
            .gte("inicio", inicioIso)
            .lt("inicio", fimIso)
        : Promise.resolve({ data: [] as Pick<CompromissoPlanner, "id" | "titulo" | "area" | "inicio" | "local">[] }),
      incluirPlanner
        ? supabase
            .from("planner_manutencoes")
            .select("id, nome, proxima_data")
            .eq("tenant_id", tenantId)
            .eq("ativo", true)
            .gte("proxima_data", paraDataISO(inicioSemana))
            .lt("proxima_data", paraDataISO(fimSemanaExclusivo))
        : Promise.resolve({ data: [] as Pick<ManutencaoPlanner, "id" | "nome" | "proxima_data">[] }),
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
    fim: null,
    link: "/financeiro",
    badge: conta.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  }));

  const itensTarefas: ItemAgenda[] = (
    (resultadoTarefas.data as Pick<Tarefa, "id" | "titulo" | "data_limite" | "coluna_id" | "projeto_id">[] | null) ??
    []
  )
    .filter((tarefa) => !mapaColunaConcluida.get(tarefa.coluna_id))
    .map((tarefa) => {
      const dataLimite = tarefa.data_limite as string;
      // Cartões criados antes da migration 0013 (que trocou `data_limite` de
      // `date` pra `timestamptz`) viraram meia-noite UTC exata — ninguém
      // cadastra prazo real digitando "00:00" de propósito, então trata
      // como "sem hora real" (mesma faixa dia-inteiro de conta a pagar).
      const semHoraReal = dataLimite.endsWith("T00:00:00.000Z") || dataLimite.endsWith("T00:00:00+00:00");
      return {
        id: tarefa.id,
        fonte: "tarefa",
        titulo: tarefa.titulo,
        quando: semHoraReal ? dataLimite.slice(0, 10) : dataLimite,
        fim: null,
        link: `/projetos/${tarefa.projeto_id}/tarefas`,
        badge: null,
      };
    });

  // Compromissos do Gaiamum são espelhados no Google (ver
  // `google-calendar-interno.ts`); sem esse filtro cada um apareceria duas
  // vezes na Agenda — como compromisso do Gaiamum e como evento do Google.
  const idsManuais = new Set(
    ((resultadoEventos.data as Pick<EventoAgenda, "id">[] | null) ?? []).map((evento) => evento.id),
  );

  const itensGoogle: ItemAgenda[] =
    google.status === "conectado"
      ? google.eventos
          .filter((evento) => !evento.gaiamumId || !idsManuais.has(evento.gaiamumId))
          .map((evento) => ({
            id: evento.id,
            fonte: "google",
            titulo: evento.titulo,
            quando: evento.inicio,
            fim: evento.fim || null,
            link: evento.link,
            badge: null,
          }))
      : [];

  const itensManuais: ItemAgenda[] = (
    (resultadoEventos.data as Pick<EventoAgenda, "id" | "titulo" | "inicio" | "fim">[] | null) ?? []
  ).map((evento) => ({
    id: evento.id,
    fonte: "evento_agenda",
    titulo: evento.titulo,
    quando: evento.inicio,
    fim: evento.fim,
    link: null,
    badge: null,
  }));

  const itensDecisoes: ItemAgenda[] = (
    (resultadoDecisoes.data as Pick<Decisao, "id" | "titulo" | "projeto_id" | "data">[] | null) ?? []
  ).map((decisao) => {
    const dataDecisao = decisao.data;
    // Decisões criadas antes da migration 0031 (que trocou `data` de `date`
    // pra `timestamptz`) viraram meia-noite UTC exata — mesmo tratamento já
    // dado a tarefas antigas (migration 0013), acima.
    const semHoraReal = dataDecisao.endsWith("T00:00:00.000Z") || dataDecisao.endsWith("T00:00:00+00:00");
    return {
      id: decisao.id,
      fonte: "decisao",
      titulo: decisao.titulo,
      quando: semHoraReal ? dataDecisao.slice(0, 10) : dataDecisao,
      fim: null,
      link: `/projetos/${decisao.projeto_id}/decisoes`,
      badge: null,
    };
  });

  const itensPlanner: ItemAgenda[] = [
    ...((resultadoCompromissosPlanner.data as Pick<CompromissoPlanner, "id" | "titulo" | "area" | "inicio" | "local">[] | null) ?? []).map(
      (compromisso) => ({
        id: compromisso.id,
        fonte: "planner" as const,
        titulo: compromisso.titulo,
        quando: compromisso.inicio,
        fim: null,
        link: `/planner/${compromisso.area}`,
        badge: compromisso.local,
      }),
    ),
    ...((resultadoManutencoesPlanner.data as Pick<ManutencaoPlanner, "id" | "nome" | "proxima_data">[] | null) ?? []).map(
      (manutencao) => ({
        id: manutencao.id,
        fonte: "planner" as const,
        titulo: `🔧 ${manutencao.nome}`,
        // Manutenção é de dia inteiro (coluna `date`), como conta a pagar.
        quando: manutencao.proxima_data as string,
        fim: null,
        link: "/planner/casa?aba=manutencoes",
        badge: null,
      }),
    ),
  ];

  const itens = [...itensGoogle, ...itensContas, ...itensTarefas, ...itensManuais, ...itensDecisoes, ...itensPlanner].sort(
    (a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime(),
  );

  return { google, itens };
}

export type CompromissoDoDia = {
  id: string;
  titulo: string;
  /** "Dia inteiro" ou "09:00" / "09:00–10:30", já no fuso Brasil. */
  horario: string;
  /** ISO usado só pra ordenar (dia inteiro vai primeiro). */
  ordem: number;
};

export type ResultadoCompromissosDoDia =
  | { status: "oculto" }
  | { status: "problema" }
  | { status: "conectado"; compromissos: CompromissoDoDia[] };

function formatarHoraBrasil(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: FUSO_BRASIL,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compromissos de um dia da pessoa logada, pra coluna do Kanban: eventos do
 * Google Calendar dela + compromissos do Gaiamum (a cópia do Google de um
 * compromisso do Gaiamum é descartada pra não repetir). Só aparece com o
 * Google conectado — sem conexão devolve `oculto` e o quadro não mostra a
 * coluna; conexão expirada devolve `expirado` pra avisar em vez de sumir.
 * `chaveDia` (opcional, "AAAA-MM-DD") — pedido do Fabio (2026-10-04): poder
 * espiar o dia seguinte pra planejar os cartões de hoje com base no que vem
 * depois. Sem o parâmetro, continua sendo hoje (mesmo comportamento de
 * antes) — `limitesDoDia()` já tratava isso, só não era exposto aqui. */
export async function listarCompromissosDoDia(tenantId: string, chaveDia?: string): Promise<ResultadoCompromissosDoDia> {
  const { inicio, fimExclusivo } = limitesDoDia(chaveDia);
  const supabase = await createClient();

  const [google, { data: manuais }] = await Promise.all([
    listarEventosGoogleCalendar(inicio, fimExclusivo),
    supabase
      .from("eventos_agenda")
      .select("id, titulo, inicio, fim")
      .eq("tenant_id", tenantId)
      .gte("inicio", inicio.toISOString())
      .lt("inicio", fimExclusivo.toISOString()),
  ]);

  if (google.status === "nao_conectado") return { status: "oculto" };
  if (google.status !== "conectado") return { status: "problema" };

  const eventosManuais = (manuais as Pick<EventoAgenda, "id" | "titulo" | "inicio" | "fim">[] | null) ?? [];
  const idsManuais = new Set(eventosManuais.map((e) => e.id));

  const doGoogle: CompromissoDoDia[] = google.eventos
    .filter((e) => !e.gaiamumId || !idsManuais.has(e.gaiamumId))
    .map((e) => {
      const diaInteiro = /^\d{4}-\d{2}-\d{2}$/.test(e.inicio);
      return {
        id: `google-${e.id}`,
        titulo: e.titulo,
        horario: diaInteiro
          ? "Dia inteiro"
          : e.fim
            ? `${formatarHoraBrasil(e.inicio)}–${formatarHoraBrasil(e.fim)}`
            : formatarHoraBrasil(e.inicio),
        ordem: diaInteiro ? 0 : new Date(e.inicio).getTime(),
      };
    });

  const doGaiamum: CompromissoDoDia[] = eventosManuais.map((e) => ({
    id: `gaiamum-${e.id}`,
    titulo: e.titulo,
    horario: e.fim ? `${formatarHoraBrasil(e.inicio)}–${formatarHoraBrasil(e.fim)}` : formatarHoraBrasil(e.inicio),
    ordem: new Date(e.inicio).getTime(),
  }));

  return {
    status: "conectado",
    compromissos: [...doGoogle, ...doGaiamum].sort((a, b) => a.ordem - b.ordem),
  };
}
