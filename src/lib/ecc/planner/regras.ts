import {
  AREAS_PLANNER,
  REFEICOES,
  type AreaPlanner,
  type HabitoPlanner,
  type ManutencaoPlanner,
  type Refeicao,
  type RegistroHabito,
  type TipoHabito,
} from "@/lib/ecc/planner/tipos";

// Lógica pura do Planner — sem "server-only" de propósito: usada pelas
// páginas (servidor) e pelos componentes de hábito (cliente), e testada em
// `__tests__/planner-regras.test.ts`. Datas sempre como chave "AAAA-MM-DD" já
// resolvida no fuso Brasil (ver `semana.ts`), nunca `Date` com hora.

export const ROTULO_AREA: Record<AreaPlanner, string> = {
  pessoal: "Pessoal",
  estudos: "Estudos",
  casa: "Casa",
  saude: "Saúde",
};

export const SUBTITULO_AREA: Record<AreaPlanner, string> = {
  pessoal: "Rotina e hábitos",
  estudos: "Aprendizado contínuo",
  casa: "Organização do lar",
  saude: "Bem-estar e qualidade de vida",
};

export const ICONE_AREA: Record<AreaPlanner, string> = {
  pessoal: "🌿",
  estudos: "🎓",
  casa: "🏠",
  saude: "❤️",
};

export function hrefArea(area: AreaPlanner, aba?: string): string {
  return aba ? `/planner/${area}?aba=${aba}` : `/planner/${area}`;
}

export function ehAreaPlanner(valor: unknown): valor is AreaPlanner {
  return typeof valor === "string" && (AREAS_PLANNER as readonly string[]).includes(valor);
}

/** Índice = dia ISO - 1. Semana começa na segunda, como no mockup
 * (S T Q Q S S D). */
export const LETRA_DIA = ["S", "T", "Q", "Q", "S", "S", "D"] as const;
export const SIGLA_DIA = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"] as const;
export const NOME_DIA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"] as const;

export const ROTULO_REFEICAO: Record<Refeicao, string> = {
  cafe_da_manha: "Café da manhã",
  almoco: "Almoço",
  lanche: "Lanche",
  jantar: "Jantar",
};

// --------------------------------------------------------------------------
// Datas
// --------------------------------------------------------------------------

const CHAVE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function ehChaveData(valor: unknown): valor is string {
  if (typeof valor !== "string" || !CHAVE_DATA.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

export function somarDiasChave(chave: string, dias: number): string {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** 1 = segunda ... 7 = domingo. */
export function diaIsoDe(chave: string): number {
  const [ano, mes, dia] = chave.split("-").map(Number);
  const domingoZero = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return domingoZero === 0 ? 7 : domingoZero;
}

export function segundaDaChave(chave: string): string {
  return somarDiasChave(chave, 1 - diaIsoDe(chave));
}

/** As 7 chaves (segunda a domingo) da semana que começa em `segunda`. */
export function chavesDaSemana(segunda: string): string[] {
  return Array.from({ length: 7 }, (_, i) => somarDiasChave(segunda, i));
}

/** Soma meses mantendo o dia, mas sem "pular" mês curto: 31/01 + 1 mês =
 * 28/02 (ou 29), nunca 03/03. */
export function somarMesesChave(chave: string, meses: number): string {
  const [ano, mes, dia] = chave.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

export function formatarDataCurta(chave: string): string {
  const [, mes, dia] = chave.split("-");
  return `${dia}/${mes}`;
}

/** "HH:MM:SS" (coluna `time`) → "HH:MM". */
export function horarioCurto(horario: string | null): string | null {
  return horario ? horario.slice(0, 5) : null;
}

// --------------------------------------------------------------------------
// Hábitos e rotinas — semana e consistência
// --------------------------------------------------------------------------

export type EstadoDiaHabito = {
  data: string;
  diaIso: number;
  planejado: boolean;
  feito: boolean;
  /** Dia depois de hoje: não dá pra marcar como feito ainda. */
  futuro: boolean;
};

/** Grade de 7 dias de um hábito (a linha de "Meus hábitos"). */
export function semanaDoHabito(
  habito: Pick<HabitoPlanner, "id" | "dias_semana">,
  registros: Pick<RegistroHabito, "habito_id" | "data">[],
  segunda: string,
  hoje: string,
): EstadoDiaHabito[] {
  const feitos = new Set(registros.filter((r) => r.habito_id === habito.id).map((r) => r.data));
  return chavesDaSemana(segunda).map((data) => {
    const diaIso = diaIsoDe(data);
    return {
      data,
      diaIso,
      planejado: habito.dias_semana.includes(diaIso),
      feito: feitos.has(data),
      futuro: data > hoje,
    };
  });
}

export type Consistencia = {
  planejados: number;
  feitos: number;
  /** null quando ainda não havia nada planejado até hoje — "sem dado", nunca 0%. */
  percentual: number | null;
};

/** Consistência da semana até hoje: dos dias PLANEJADOS que já chegaram
 * (inclusive hoje), quantos foram feitos. Feito num dia não planejado não
 * entra na conta (não infla nem pune). */
export function consistenciaDaSemana(
  habitos: Pick<HabitoPlanner, "id" | "dias_semana">[],
  registros: Pick<RegistroHabito, "habito_id" | "data">[],
  segunda: string,
  hoje: string,
): Consistencia {
  let planejados = 0;
  let feitos = 0;
  for (const habito of habitos) {
    for (const dia of semanaDoHabito(habito, registros, segunda, hoje)) {
      if (!dia.planejado || dia.futuro) continue;
      planejados += 1;
      if (dia.feito) feitos += 1;
    }
  }
  return { planejados, feitos, percentual: planejados === 0 ? null : Math.round((feitos / planejados) * 100) };
}

/** Minutos feitos na semana (soma de `duracao_minutos` dos registros) —
 * "tempo estudado" do card de Estudos. Hábito sem duração não soma. */
export function minutosFeitosNaSemana(
  habitos: Pick<HabitoPlanner, "id" | "duracao_minutos">[],
  registros: Pick<RegistroHabito, "habito_id" | "data">[],
  segunda: string,
): number {
  const fim = somarDiasChave(segunda, 7);
  const duracao = new Map(habitos.map((h) => [h.id, h.duracao_minutos ?? 0]));
  return registros
    .filter((r) => r.data >= segunda && r.data < fim)
    .reduce((soma, r) => soma + (duracao.get(r.habito_id) ?? 0), 0);
}

export function formatarMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h ${resto}min`;
}

/** Hábitos/rotinas planejados pra um dia, ordenados por horário (sem
 * horário vão por último, por nome). */
export function planejadosNoDia<T extends Pick<HabitoPlanner, "dias_semana" | "horario" | "nome">>(
  habitos: T[],
  data: string,
): T[] {
  const diaIso = diaIsoDe(data);
  return habitos
    .filter((h) => h.dias_semana.includes(diaIso))
    .sort((a, b) => {
      if (a.horario && b.horario) return a.horario.localeCompare(b.horario);
      if (a.horario) return -1;
      if (b.horario) return 1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}

/** Texto curto dos dias ("Seg, Qua, Sex", "Todos os dias", "Dias úteis"). */
export function descreverDias(dias: number[]): string {
  const ordenados = [...new Set(dias)].sort((a, b) => a - b);
  if (ordenados.length === 7) return "Todos os dias";
  if (ordenados.join() === "1,2,3,4,5") return "Dias úteis";
  if (ordenados.join() === "6,7") return "Fim de semana";
  const nomes = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return ordenados.map((d) => nomes[d - 1]).join(", ");
}

// --------------------------------------------------------------------------
// Sugestão da semana — 100% determinística (não é IA). O card do mockup
// "Sugestão da IA Gaiamum" fica com este texto calculado enquanto a IA do
// Planner não existe; a reorganização em si é Fase posterior.
// --------------------------------------------------------------------------

export function sugestaoDaSemana(
  porArea: Partial<Record<AreaPlanner, Consistencia>>,
  geral: Consistencia,
): string | null {
  if (geral.percentual === null) return null;
  const comDado = AREAS_PLANNER.map((area) => ({ area, c: porArea[area] })).filter(
    (x): x is { area: AreaPlanner; c: Consistencia & { percentual: number } } =>
      Boolean(x.c && x.c.percentual !== null),
  );
  const inicio = `Você concluiu ${geral.percentual}% dos hábitos e rotinas planejados até hoje nesta semana.`;
  if (comDado.length < 2) return inicio;
  const pior = comDado.reduce((a, b) => (b.c.percentual < a.c.percentual ? b : a));
  if (pior.c.percentual >= geral.percentual) return inicio;
  return `${inicio} ${ROTULO_AREA[pior.area]} está abaixo da média (${pior.c.percentual}%).`;
}

// --------------------------------------------------------------------------
// Manutenções
// --------------------------------------------------------------------------

export type StatusManutencao = "sem_data" | "atrasada" | "em_breve" | "em_dia";

export const ROTULO_STATUS_MANUTENCAO: Record<StatusManutencao, string> = {
  sem_data: "Sem data",
  atrasada: "Atrasada",
  em_breve: "Em breve",
  em_dia: "Em dia",
};

const DIAS_EM_BREVE = 7;

export function statusManutencao(
  manutencao: Pick<ManutencaoPlanner, "proxima_data">,
  hoje: string,
): StatusManutencao {
  if (!manutencao.proxima_data) return "sem_data";
  if (manutencao.proxima_data < hoje) return "atrasada";
  if (manutencao.proxima_data <= somarDiasChave(hoje, DIAS_EM_BREVE)) return "em_breve";
  return "em_dia";
}

/** Ao marcar como feita hoje: última = hoje; próxima = hoje + recorrência
 * (sem recorrência, a próxima fica em branco até a pessoa definir). */
export function concluirManutencao(
  manutencao: Pick<ManutencaoPlanner, "recorrencia_meses">,
  hoje: string,
): { ultima_realizacao: string; proxima_data: string | null } {
  return {
    ultima_realizacao: hoje,
    proxima_data: manutencao.recorrencia_meses ? somarMesesChave(hoje, manutencao.recorrencia_meses) : null,
  };
}

// --------------------------------------------------------------------------
// Cardápio
// --------------------------------------------------------------------------

/** Quantos dias da semana têm pelo menos uma refeição planejada. */
export function diasComCardapio(celulas: { dia_semana: number }[]): number {
  return new Set(celulas.map((c) => c.dia_semana)).size;
}

export function ehRefeicao(valor: unknown): valor is Refeicao {
  return typeof valor === "string" && (REFEICOES as readonly string[]).includes(valor);
}

// --------------------------------------------------------------------------
// Validação (servidor) — o banco tem os mesmos limites em CHECK; aqui é só
// pra devolver mensagem em português antes de bater no banco.
// --------------------------------------------------------------------------

export type Validado<T> = { ok: true; valor: T } | { ok: false; erro: string };

export function textoObrigatorio(valor: unknown, max: number, rotulo: string): Validado<string> {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) return { ok: false, erro: `${rotulo} é obrigatório.` };
  if (texto.length > max) return { ok: false, erro: `${rotulo} pode ter no máximo ${max} caracteres.` };
  return { ok: true, valor: texto };
}

export function textoOpcional(valor: unknown, max: number, rotulo: string): Validado<string | null> {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) return { ok: true, valor: null };
  if (texto.length > max) return { ok: false, erro: `${rotulo} pode ter no máximo ${max} caracteres.` };
  return { ok: true, valor: texto };
}

export function dataOpcional(valor: unknown, rotulo: string): Validado<string | null> {
  if (valor === null || valor === undefined || valor === "") return { ok: true, valor: null };
  return ehChaveData(valor) ? { ok: true, valor } : { ok: false, erro: `${rotulo} inválida.` };
}

export function inteiroEntre(valor: unknown, min: number, max: number, rotulo: string): Validado<number> {
  const numero = typeof valor === "number" ? valor : Number(String(valor ?? "").trim());
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    return { ok: false, erro: `${rotulo} deve ser um número entre ${min} e ${max}.` };
  }
  return { ok: true, valor: numero };
}

export type HabitoValidado = {
  nome: string;
  area: AreaPlanner;
  tipo: TipoHabito;
  dias_semana: number[];
  horario: string | null;
  duracao_minutos: number | null;
};

export function validarHabito(entrada: {
  nome: unknown;
  area: unknown;
  tipo: unknown;
  dias: unknown[];
  horario: unknown;
  duracao: unknown;
}): Validado<HabitoValidado> {
  const nome = textoObrigatorio(entrada.nome, 120, "Nome");
  if (!nome.ok) return nome;
  if (!ehAreaPlanner(entrada.area)) return { ok: false, erro: "Área inválida." };
  const tipo: TipoHabito = entrada.tipo === "rotina" ? "rotina" : "habito";

  const dias = [...new Set(entrada.dias.map((d) => Number(d)))].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (dias.length === 0) return { ok: false, erro: "Escolha pelo menos um dia da semana." };

  let horario: string | null = null;
  if (typeof entrada.horario === "string" && entrada.horario.trim()) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(entrada.horario.trim())) return { ok: false, erro: "Horário inválido." };
    horario = entrada.horario.trim();
  }

  let duracao_minutos: number | null = null;
  if (entrada.duracao !== null && entrada.duracao !== undefined && String(entrada.duracao).trim() !== "") {
    const duracao = inteiroEntre(entrada.duracao, 1, 1440, "Duração (minutos)");
    if (!duracao.ok) return duracao;
    duracao_minutos = duracao.valor;
  }

  return {
    ok: true,
    valor: { nome: nome.valor, area: entrada.area, tipo, dias_semana: dias.sort((a, b) => a - b), horario, duracao_minutos },
  };
}
