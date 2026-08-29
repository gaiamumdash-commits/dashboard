export type Horizonte = "medio_prazo" | "longo_prazo";

export type MetaSmart = {
  id: string;
  tenant_id: string;
  horizonte: Horizonte;
  visao_macro: string;
  specific: string;
  measurable: string;
  attainable: string;
  relevant: string;
  time_bound: string;
  criado_em: string;
};

export type StatusProjeto = "ativo" | "pausado" | "concluido";

export type Projeto = {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  status: StatusProjeto;
  meta_smart_id: string | null;
  criado_em: string;
};

export type StatusTarefa = "backlog" | "em_execucao" | "concluido";
export type Prioridade = "P1" | "P2" | "P3" | "P4";

export type Tarefa = {
  id: string;
  tenant_id: string;
  projeto_id: string;
  titulo: string;
  descricao: string | null;
  status: StatusTarefa;
  prioridade: Prioridade;
  tag: string | null;
  data_limite: string | null;
  tempo_estimado_min: number | null;
  tempo_realizado_min: number | null;
  criado_em: string;
};
