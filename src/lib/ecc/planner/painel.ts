import { FUSO_BRASIL } from "@/lib/ecc/kanban";
import {
  chavesDaSemana,
  consistenciaDaSemana,
  diaIsoDe,
  formatarMinutos,
  horarioCurto,
  minutosFeitosNaSemana,
  planejadosNoDia,
  type Consistencia,
} from "@/lib/ecc/planner/regras";
import type { AreaPlanner, CompromissoPlanner, HabitoPlanner, RegistroHabito } from "@/lib/ecc/planner/tipos";
import type { ItemAgenda } from "@/lib/ecc/tipos";

// Composição dos cards "Foco de hoje", "Hoje" e "Esta semana" — lógica pura
// (testada em `__tests__/planner-painel.test.ts`). Junta 3 fontes SEM
// duplicar nenhuma: rotinas/hábitos do Planner, compromissos do Planner e os
// itens da Agenda real (`listarAgendaUnificada`, chamada com
// `incluirPlanner = false` pra não repetir os compromissos do Planner).

export type OrigemItemDia = "rotina" | "habito" | "compromisso" | "agenda";

export type ItemDia = {
  /** Única na lista (origem + id). */
  chave: string;
  origem: OrigemItemDia;
  id: string;
  titulo: string;
  /** "HH:MM" no fuso Brasil, ou null (dia inteiro / sem horário). */
  horario: string | null;
  detalhe: string | null;
  /** true/false = dá pra marcar no Planner; null = item de outro módulo
   * (Agenda, Kanban, Financeiro), só link. */
  feito: boolean | null;
  href: string | null;
};

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function chaveEHoraNoBrasil(iso: string): { data: string; hora: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BRASIL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const v = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return { data: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}

const ROTULO_ORIGEM_AGENDA: Record<ItemAgenda["fonte"], string> = {
  google: "Google Agenda",
  conta_a_pagar: "Conta a pagar",
  tarefa: "Tarefa",
  evento_agenda: "Agenda",
  decisao: "Decisão",
  planner: "Planner",
};

function ordenarPorHorario(a: ItemDia, b: ItemDia): number {
  if (a.horario && b.horario) return a.horario.localeCompare(b.horario);
  if (a.horario) return -1;
  if (b.horario) return 1;
  return a.titulo.localeCompare(b.titulo, "pt-BR");
}

/** Itens de um dia: rotinas (todas) e hábitos COM horário planejados pro
 * dia, compromissos do Planner do dia e itens da Agenda do dia — ordenados
 * por horário. Hábito sem horário fica só no card "Meus hábitos". */
export function itensDoDia(entrada: {
  data: string;
  habitos: Pick<HabitoPlanner, "id" | "nome" | "tipo" | "dias_semana" | "horario" | "duracao_minutos" | "area">[];
  registros: Pick<RegistroHabito, "habito_id" | "data">[];
  compromissos: Pick<CompromissoPlanner, "id" | "titulo" | "inicio" | "local" | "concluido" | "area">[];
  agenda: Pick<ItemAgenda, "id" | "fonte" | "titulo" | "quando" | "link">[];
}): ItemDia[] {
  const { data } = entrada;
  const feitos = new Set(entrada.registros.filter((r) => r.data === data).map((r) => r.habito_id));

  const recorrentes: ItemDia[] = planejadosNoDia(
    entrada.habitos.filter((h) => h.tipo === "rotina" || h.horario),
    data,
  ).map((h) => ({
    chave: `${h.tipo}-${h.id}`,
    origem: h.tipo,
    id: h.id,
    titulo: h.nome,
    horario: horarioCurto(h.horario),
    detalhe: h.duracao_minutos ? `${h.duracao_minutos} minutos` : null,
    feito: feitos.has(h.id),
    href: `/planner/${h.area}`,
  }));

  const compromissos: ItemDia[] = entrada.compromissos
    .map((c) => ({ c, quando: chaveEHoraNoBrasil(c.inicio) }))
    .filter(({ quando }) => quando.data === data)
    .map(({ c, quando }) => ({
      chave: `compromisso-${c.id}`,
      origem: "compromisso" as const,
      id: c.id,
      titulo: c.titulo,
      horario: quando.hora,
      detalhe: c.local,
      feito: c.concluido,
      href: `/planner/${c.area}`,
    }));

  const agenda: ItemDia[] = entrada.agenda.flatMap((item) => {
    const diaInteiro = SO_DATA.test(item.quando);
    const quando = diaInteiro ? { data: item.quando, hora: null } : chaveEHoraNoBrasil(item.quando);
    if (quando.data !== data) return [];
    return [
      {
        chave: `agenda-${item.fonte}-${item.id}`,
        origem: "agenda" as const,
        id: item.id,
        titulo: item.titulo,
        horario: quando.hora,
        detalhe: ROTULO_ORIGEM_AGENDA[item.fonte],
        feito: null,
        href: item.link,
      },
    ];
  });

  return [...recorrentes, ...compromissos, ...agenda].sort(ordenarPorHorario);
}

/** "Foco de hoje": até `limite` itens AINDA NÃO FEITOS do dia — compromisso
 * primeiro (tem hora marcada com outra pessoa), depois rotinas/hábitos, por
 * último itens dos outros módulos. Inclui hábitos sem horário (que não
 * aparecem no card "Hoje"). */
export function focoDoDia(
  itens: ItemDia[],
  habitosSemHorarioPendentes: ItemDia[],
  limite = 3,
): ItemDia[] {
  const peso: Record<OrigemItemDia, number> = { compromisso: 0, rotina: 1, habito: 2, agenda: 3 };
  return [...itens.filter((i) => i.feito === false), ...habitosSemHorarioPendentes, ...itens.filter((i) => i.feito === null)]
    .sort((a, b) => peso[a.origem] - peso[b.origem] || ordenarPorHorario(a, b))
    .slice(0, limite);
}

/** Hábitos sem horário planejados pro dia e ainda não feitos — entram no
 * "Foco de hoje" sem poluir o card cronológico "Hoje". */
export function habitosSemHorarioPendentes(
  habitos: Pick<HabitoPlanner, "id" | "nome" | "tipo" | "dias_semana" | "horario" | "area">[],
  registros: Pick<RegistroHabito, "habito_id" | "data">[],
  data: string,
): ItemDia[] {
  const feitos = new Set(registros.filter((r) => r.data === data).map((r) => r.habito_id));
  const diaIso = diaIsoDe(data);
  return habitos
    .filter((h) => h.tipo === "habito" && !h.horario && h.dias_semana.includes(diaIso) && !feitos.has(h.id))
    .map((h) => ({
      chave: `habito-${h.id}`,
      origem: "habito" as const,
      id: h.id,
      titulo: h.nome,
      horario: null,
      detalhe: null,
      feito: false,
      href: `/planner/${h.area}`,
    }));
}

export type ResumoArea = {
  consistencia: Consistencia;
  metricas: { valor: string; rotulo: string }[];
  /** Nada cadastrado na área: o card mostra convite, não números zerados. */
  vazio: boolean;
};

function plural(n: number, singular: string, pluralTexto: string): string {
  return n === 1 ? singular : pluralTexto;
}

function dataCurtaDoIso(iso: string): string {
  const { data } = chaveEHoraNoBrasil(iso);
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/** Indicadores dos 4 cards de área (mockup). Tudo a partir de dado real;
 * área sem nada cadastrado sai como `vazio`. Consistência = hábitos E
 * rotinas da área planejados até hoje × feitos (`consistenciaDaSemana`). */
export function resumoDasAreas(entrada: {
  segunda: string;
  hoje: string;
  habitos: Pick<HabitoPlanner, "id" | "area" | "tipo" | "dias_semana" | "duracao_minutos" | "ativo">[];
  registros: Pick<RegistroHabito, "habito_id" | "data">[];
  compromissosSemana: Pick<CompromissoPlanner, "area" | "concluido">[];
  objetivosAtivos: { area: AreaPlanner }[];
  leiturasEmAndamento: number;
  comprasPendentes: number;
  diasCardapio: number;
  proximaConsulta: Pick<CompromissoPlanner, "inicio"> | null;
  lembretesSaude: number;
}): Record<AreaPlanner, ResumoArea> {
  const ativos = entrada.habitos.filter((h) => h.ativo);
  const daArea = (area: AreaPlanner) => ativos.filter((h) => h.area === area);
  const consistencia = (area: AreaPlanner) => consistenciaDaSemana(daArea(area), entrada.registros, entrada.segunda, entrada.hoje);
  const habitosDe = (area: AreaPlanner) => daArea(area).filter((h) => h.tipo === "habito").length;
  const objetivosDe = (area: AreaPlanner) => entrada.objetivosAtivos.filter((o) => o.area === area).length;
  const atividadesNaSemana = (area: AreaPlanner) =>
    daArea(area)
      .filter((h) => h.tipo === "rotina")
      .reduce((soma, h) => soma + h.dias_semana.length, 0) +
    entrada.compromissosSemana.filter((c) => c.area === area).length;

  const pessoal = {
    habitos: habitosDe("pessoal"),
    objetivos: objetivosDe("pessoal"),
    atividades: atividadesNaSemana("pessoal"),
  };
  const estudosHabitos = daArea("estudos");
  const minutos = minutosFeitosNaSemana(estudosHabitos, entrada.registros, entrada.segunda);
  const rotinasCasaPendentes = (() => {
    const c = consistencia("casa");
    return c.planejados - c.feitos;
  })();

  return {
    pessoal: {
      consistencia: consistencia("pessoal"),
      vazio: pessoal.habitos + pessoal.objetivos + pessoal.atividades === 0,
      metricas: [
        { valor: String(pessoal.habitos), rotulo: plural(pessoal.habitos, "hábito ativo", "hábitos ativos") },
        { valor: String(pessoal.objetivos), rotulo: plural(pessoal.objetivos, "objetivo em andamento", "objetivos em andamento") },
        { valor: String(pessoal.atividades), rotulo: plural(pessoal.atividades, "atividade nesta semana", "atividades nesta semana") },
      ],
    },
    estudos: {
      consistencia: consistencia("estudos"),
      vazio: estudosHabitos.length + objetivosDe("estudos") + entrada.leiturasEmAndamento === 0,
      metricas: [
        { valor: String(objetivosDe("estudos")), rotulo: plural(objetivosDe("estudos"), "meta ativa", "metas ativas") },
        { valor: formatarMinutos(minutos), rotulo: "estudados na semana" },
        {
          valor: String(entrada.leiturasEmAndamento),
          rotulo: plural(entrada.leiturasEmAndamento, "leitura em andamento", "leituras em andamento"),
        },
      ],
    },
    casa: {
      consistencia: consistencia("casa"),
      vazio: daArea("casa").length + entrada.comprasPendentes + entrada.diasCardapio === 0,
      metricas: [
        { valor: String(rotinasCasaPendentes), rotulo: plural(rotinasCasaPendentes, "rotina pendente", "rotinas pendentes") },
        { valor: String(entrada.comprasPendentes), rotulo: plural(entrada.comprasPendentes, "item na lista de compras", "itens na lista de compras") },
        { valor: `${entrada.diasCardapio}/7`, rotulo: "dias com cardápio" },
      ],
    },
    saude: {
      consistencia: consistencia("saude"),
      vazio: daArea("saude").length + entrada.lembretesSaude === 0 && !entrada.proximaConsulta,
      metricas: [
        { valor: String(habitosDe("saude")), rotulo: plural(habitosDe("saude"), "hábito ativo", "hábitos ativos") },
        entrada.proximaConsulta
          ? { valor: dataCurtaDoIso(entrada.proximaConsulta.inicio), rotulo: "próxima consulta" }
          : { valor: "—", rotulo: "nenhuma consulta marcada" },
        { valor: String(entrada.lembretesSaude), rotulo: plural(entrada.lembretesSaude, "lembrete de saúde", "lembretes de saúde") },
      ],
    },
  };
}

export type DiaDaSemana = { data: string; diaIso: number; itens: ItemDia[] };

/** "Esta semana": 7 dias com os itens de cada um + o placar de concluídos
 * (só o que dá pra marcar no Planner: rotinas e compromissos — item de outro
 * módulo não tem "feito" aqui). */
export function semanaDoPlanner(entrada: Omit<Parameters<typeof itensDoDia>[0], "data"> & { segunda: string }): {
  dias: DiaDaSemana[];
  concluidos: number;
  total: number;
} {
  const dias = chavesDaSemana(entrada.segunda).map((data) => ({
    data,
    diaIso: diaIsoDe(data),
    itens: itensDoDia({ ...entrada, data }),
  }));
  const marcaveis = dias.flatMap((d) => d.itens).filter((i) => i.feito !== null);
  return { dias, concluidos: marcaveis.filter((i) => i.feito).length, total: marcaveis.length };
}
