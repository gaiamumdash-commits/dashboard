import type { Horizonte, Prioridade } from "@/lib/ecc/tipos";

/** Conteúdo do estudo de caso fictício "Café Mangue" — constantes puras, sem
 * I/O. Calibrado pra render um score de Alinhamento Gaiamum intermediário
 * (nem 0 nem 100%), mostrando os 4 fatores com dado real: 1 de 6 tarefas
 * concluídas, 1 tarefa atrasada, indicadores abaixo da meta em graus
 * diferentes, meta SMART vinculada. */

export const NOME_PROJETO_CAFE_MANGUE = "Café Mangue";

export const PROJETO_CAFE_MANGUE = {
  resultadoEsperado:
    "Lançar o delivery da cafeteria em 60 dias sem perder qualidade no atendimento do salão.",
};

export const META_SMART_CAFE_MANGUE: {
  horizonte: Horizonte;
  visao_macro: string;
  specific: string;
  measurable: string;
  attainable: string;
  relevant: string;
  time_bound: string;
} = {
  horizonte: "medio_prazo",
  visao_macro: "Aumentar o faturamento mensal do Café Mangue em 25% com um canal de delivery ativo.",
  specific: "Lançar um serviço de delivery próprio (não terceirizado) para os produtos do Café Mangue.",
  measurable: "50 pedidos de delivery por semana, com nota média de avaliação acima de 4,5.",
  attainable:
    "A cafeteria já tem cozinha com capacidade ociosa no meio da tarde e uma base de clientes fiéis pra validar o serviço.",
  relevant:
    "O movimento do salão não cresce há 2 meses — o delivery é a próxima alavanca de receita sem abrir uma segunda unidade.",
  time_bound: "60 dias, a partir do início da divulgação do cardápio de delivery.",
};

export const COLUNAS_CAFE_MANGUE: { nome: string; ordem: number; concluido: boolean }[] = [
  { nome: "A Fazer", ordem: 0, concluido: false },
  { nome: "Em Andamento", ordem: 1, concluido: false },
  { nome: "Concluído", ordem: 2, concluido: true },
];

export const TAREFAS_CAFE_MANGUE: {
  titulo: string;
  coluna: string;
  isMarco: boolean;
  prioridade: Prioridade;
  /** Dias relativos a "agora" (negativo = passado). `null` = sem prazo. */
  offsetDias: number | null;
}[] = [
  { titulo: "Definir cardápio de delivery", coluna: "Concluído", isMarco: true, prioridade: "P2", offsetDias: -5 },
  { titulo: "Testar embalagens térmicas", coluna: "A Fazer", isMarco: false, prioridade: "P1", offsetDias: -2 },
  { titulo: "Configurar app de pedidos", coluna: "Em Andamento", isMarco: false, prioridade: "P2", offsetDias: 4 },
  { titulo: "Contratar motoboy parceiro", coluna: "A Fazer", isMarco: true, prioridade: "P2", offsetDias: 10 },
  { titulo: "Divulgar lançamento nas redes", coluna: "A Fazer", isMarco: false, prioridade: "P3", offsetDias: null },
  {
    titulo: "Rodar teste piloto com clientes fiéis",
    coluna: "Em Andamento",
    isMarco: false,
    prioridade: "P1",
    offsetDias: 1,
  },
];

export const INDICADORES_CAFE_MANGUE: { nome: string; valor_atual: number; meta: number; unidade: string }[] = [
  { nome: "Pedidos de delivery por semana", valor_atual: 18, meta: 50, unidade: "pedidos" },
  { nome: "Novos clientes cadastrados no app", valor_atual: 40, meta: 100, unidade: "clientes" },
  { nome: "Nota média de avaliação do delivery", valor_atual: 4.2, meta: 5, unidade: "estrelas" },
];

export const DECISOES_CAFE_MANGUE: { titulo: string; decisao: string; motivo: string; impacto_esperado: string }[] = [
  {
    titulo: "Delivery próprio em vez de marketplace terceirizado",
    decisao:
      "Priorizar um app de pedidos próprio, mesmo sendo mais lento pra lançar, em vez de entrar num marketplace de delivery terceirizado.",
    motivo: "A taxa dos marketplaces (até 30% por pedido) inviabilizaria a margem do cardápio do Café Mangue.",
    impacto_esperado: "Margem melhor por pedido, ao custo de um lançamento mais lento e mais trabalho de divulgação própria.",
  },
];

/** Estatísticas fictícias de incentivo — sempre exibidas com moldura visual
 * própria (ver estatistica-ficticia.tsx), claramente contextualizadas como
 * parte da narrativa do case, nunca confundíveis com dado real do Gaiamum. */
export const ESTATISTICAS_FICTICIAS_CAFE_MANGUE: string[] = [
  "No case do Café Mangue, quem resolve a tarefa atrasada antes de continuar costuma destravar o teste piloto até 2x mais rápido.",
  "Cafeterias fictícias que vinculam uma meta SMART ao projeto, como o Café Mangue fez, chegam à Visão 360° com um fator a menos pra se preocupar.",
];

/** Texto fixo simulando como seria a explicação de IA do Alinhamento
 * Gaiamum — nunca chama o Gemini de verdade dentro do Lab. Escrito em termos
 * qualitativos (não cita o score numérico exato), pra continuar coerente
 * mesmo que o score calculado ao vivo varie um pouco. */
export const EXPLICACAO_SIMULADA_CAFE_MANGUE = `O Café Mangue está com uma base estratégica boa — a meta SMART dá clareza de rumo — mas a execução ainda está no começo: só 1 das 6 tarefas do quadro foi concluída, e os dois indicadores de tração (pedidos e clientes cadastrados) estão bem abaixo da meta. O ponto de atenção real é a única tarefa atrasada, "Testar embalagens térmicas" — ela trava o teste piloto com clientes fiéis, que depende dela pra rodar. Prioridade prática: destravar essa tarefa primeiro, porque é ela que libera o resto da fila e começa a puxar os indicadores de pedidos e clientes pra cima.`;
