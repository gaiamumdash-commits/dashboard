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
  data_inicio: string | null;
  data_limite: string | null;
  tempo_estimado_min: number | null;
  tempo_realizado_min: number | null;
  criado_em: string;
};

export type Papel = "owner" | "member";
export type EscopoMembership = "completo" | "projeto";

export type Membership = {
  id: string;
  user_id: string;
  tenant_id: string;
  papel: Papel;
  escopo: EscopoMembership;
  criado_em: string;
};

export type MembroTenant = {
  user_id: string;
  email: string;
  papel: Papel;
};

export type StatusConvite = "pendente" | "aceito" | "cancelado";

export type Convite = {
  id: string;
  tenant_id: string;
  email: string;
  papel: Papel;
  token: string;
  status: StatusConvite;
  convidado_por: string;
  criado_em: string;
  expira_em: string;
  projeto_id: string | null;
};

export type PapelProjeto = "gestor" | "usuario";

export type ProjetoMembro = {
  id: string;
  tenant_id: string;
  projeto_id: string;
  user_id: string;
  papel: PapelProjeto;
  criado_em: string;
};

export type TarefaMembro = {
  id: string;
  tenant_id: string;
  tarefa_id: string;
  user_id: string;
  criado_em: string;
};

export type ChecklistItem = {
  id: string;
  tenant_id: string;
  tarefa_id: string;
  texto: string;
  concluido: boolean;
  ordem: number;
  criado_em: string;
};
