/** Tipos das tabelas do Planner (migration 0057). Toda linha é pessoal:
 * `user_id` + `tenant_id`, RLS por `planner_eh_meu`. */

export const AREAS_PLANNER = ["pessoal", "estudos", "casa", "saude"] as const;
export type AreaPlanner = (typeof AREAS_PLANNER)[number];

export type TipoHabito = "habito" | "rotina";

export type HabitoPlanner = {
  id: string;
  tenant_id: string;
  user_id: string;
  nome: string;
  area: AreaPlanner;
  tipo: TipoHabito;
  /** ISO: 1 = segunda ... 7 = domingo. */
  dias_semana: number[];
  /** "HH:MM:SS" (coluna `time`) ou null. */
  horario: string | null;
  duracao_minutos: number | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type RegistroHabito = {
  id: string;
  habito_id: string;
  /** "AAAA-MM-DD". */
  data: string;
};

export type StatusObjetivo = "em_andamento" | "pausado" | "concluido";

export type ObjetivoPlanner = {
  id: string;
  titulo: string;
  area: AreaPlanner;
  prazo: string | null;
  status: StatusObjetivo;
  notas: string | null;
  criado_em: string;
};

export type NotaPlanner = {
  id: string;
  area: AreaPlanner;
  titulo: string;
  conteudo: string;
  atualizado_em: string;
};

export type StatusLeitura = "quero_ler" | "lendo" | "concluido";

export type LeituraPlanner = {
  id: string;
  titulo: string;
  autor: string | null;
  status: StatusLeitura;
  progresso: number;
  data_inicio: string | null;
  data_alvo: string | null;
  notas: string | null;
};

export type TipoCurso = "curso" | "idioma";
export type StatusCurso = "planejado" | "em_andamento" | "concluido";

export type CursoPlanner = {
  id: string;
  tipo: TipoCurso;
  nome: string;
  instituicao: string | null;
  objetivo: string | null;
  frequencia: string | null;
  status: StatusCurso;
  progresso: number;
  data_alvo: string | null;
  link: string | null;
  notas: string | null;
};

export type ItemCompra = {
  id: string;
  nome: string;
  categoria: string;
  quantidade: string | null;
  comprado: boolean;
  criado_em: string;
};

export const REFEICOES = ["cafe_da_manha", "almoco", "lanche", "jantar"] as const;
export type Refeicao = (typeof REFEICOES)[number];

export type CelulaCardapio = {
  id: string;
  semana: string;
  dia_semana: number;
  refeicao: Refeicao;
  descricao: string;
};

export type PetPlanner = {
  id: string;
  nome: string;
  tipo: string | null;
  notas: string | null;
};

export type ManutencaoPlanner = {
  id: string;
  nome: string;
  ultima_realizacao: string | null;
  proxima_data: string | null;
  recorrencia_meses: number | null;
  observacao: string | null;
  ativo: boolean;
};

export type TipoCompromisso = "consulta" | "pet" | "outro";

export type CompromissoPlanner = {
  id: string;
  titulo: string;
  area: AreaPlanner;
  tipo: TipoCompromisso;
  /** ISO com hora. */
  inicio: string;
  local: string | null;
  notas: string | null;
  pet_id: string | null;
  concluido: boolean;
};

export type PreferenciasPlanner = {
  areas: AreaPlanner[];
};

/** Retorno das Server Actions do Planner. Diferente do padrão antigo de
 * `throw` (cuja mensagem o Next redige em produção, ver `erro-cliente.ts`),
 * aqui o erro de validação volta como dado — a mensagem em português chega
 * intacta na tela também em produção. */
export type ResultadoAcao = { ok: true } | { ok: false; erro: string };
