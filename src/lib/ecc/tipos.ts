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
  cor_fundo: CorEtiqueta;
  arquivado: boolean;
  criado_em: string;
};

export type Prioridade = "P1" | "P2" | "P3" | "P4";

export type Tarefa = {
  id: string;
  tenant_id: string;
  projeto_id: string;
  titulo: string;
  descricao: string | null;
  coluna_id: string;
  prioridade: Prioridade;
  data_inicio: string | null;
  data_limite: string | null;
  tempo_estimado_min: number | null;
  tempo_realizado_min: number | null;
  criado_em: string;
};

/** Coluna do kanban — livre por projeto, exceto a de `concluido: true`,
 * que é fixa (não pode ser renomeada nem apagada). */
export type ColunaKanban = {
  id: string;
  tenant_id: string;
  projeto_id: string;
  nome: string;
  ordem: number;
  concluido: boolean;
  criado_em: string;
};

export type CategoriaFinanceira = "consumo" | "investimento" | "despesa";

export type ContaFixaModelo = {
  id: string;
  tenant_id: string;
  nome: string;
  valor_esperado: number;
  dia_vencimento: number;
  categoria: CategoriaFinanceira;
  ativo: boolean;
  criado_em: string;
};

export type ContaAPagar = {
  id: string;
  tenant_id: string;
  conta_fixa_id: string | null;
  nome: string;
  valor: number;
  categoria: CategoriaFinanceira;
  mes_referencia: string;
  data_vencimento: string;
  data_pagamento: string | null;
  pago: boolean;
  criado_em: string;
};

export type EntidadeAnexo = "conta_a_pagar" | "tarefa";

export type Anexo = {
  id: string;
  tenant_id: string;
  entidade_tipo: EntidadeAnexo;
  entidade_id: string;
  storage_path: string;
  nome_arquivo: string;
  tamanho_bytes: number;
  tipo_mime: string;
  enviado_por: string;
  criado_em: string;
};

export type RegraCategoria = {
  id: string;
  tenant_id: string;
  palavra_chave: string;
  categoria: CategoriaFinanceira;
  criado_em: string;
};

export type CorEtiqueta = "purple" | "teal" | "yellow" | "blue" | "coral" | "lime";

export type Etiqueta = {
  id: string;
  tenant_id: string;
  nome: string;
  cor: CorEtiqueta;
  criado_em: string;
};

export type TarefaEtiqueta = {
  id: string;
  tenant_id: string;
  tarefa_id: string;
  etiqueta_id: string;
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

export type TipoAtividade =
  | "criada"
  | "movida"
  | "descricao_editada"
  | "checklist_item_adicionado"
  | "checklist_item_concluido"
  | "checklist_item_reaberto"
  | "checklist_item_removido"
  | "membro_adicionado"
  | "membro_removido"
  | "excluida"
  | "comentario";

export type AtividadeTarefa = {
  id: string;
  tenant_id: string;
  projeto_id: string;
  /** Fica `null` se o cartão foi apagado depois — o registro de atividade
   * sobrevive à exclusão do cartão. */
  tarefa_id: string | null;
  user_id: string;
  tipo: TipoAtividade;
  detalhe: Record<string, string>;
  criado_em: string;
};
