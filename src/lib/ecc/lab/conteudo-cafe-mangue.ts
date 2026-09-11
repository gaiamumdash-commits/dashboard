import type { CategoriaFinanceira, Horizonte, Prioridade } from "@/lib/ecc/tipos";
import type { PassoLab } from "@/lib/ecc/lab/progresso";

/** Conteúdo do estudo de caso fictício "Café Mangue" — constantes puras, sem
 * I/O. Calibrado pra render um score de Alinhamento Gaiamum intermediário
 * (nem 0 nem 100%), mostrando os 4 fatores com dado real: 1 de 6 tarefas
 * concluídas, 1 tarefa atrasada, indicadores abaixo da meta em graus
 * diferentes, meta SMART vinculada. */

export const NOME_PROJETO_CAFE_MANGUE = "Café do Mangue";

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
  visao_macro: "Aumentar o faturamento mensal do Café do Mangue em 25% com um canal de delivery ativo.",
  specific: "Lançar um serviço de delivery próprio (não terceirizado) para os produtos do Café do Mangue.",
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
  /** Ponte pro Financeiro (Sub-entrega 1 do cross-módulo): custo já
   * conhecido de antemão, `null` quando a missão é o usuário preencher do
   * zero (ver MISSOES_FINANCEIRO_CAFE_MANGUE). */
  valorEstimado: number | null;
}[] = [
  {
    titulo: "Definir cardápio de delivery",
    coluna: "Concluído",
    isMarco: true,
    prioridade: "P2",
    offsetDias: -5,
    valorEstimado: null,
  },
  {
    titulo: "Testar embalagens térmicas",
    coluna: "A Fazer",
    isMarco: false,
    prioridade: "P1",
    offsetDias: -2,
    valorEstimado: 640,
  },
  {
    titulo: "Configurar app de pedidos",
    coluna: "Em Andamento",
    isMarco: false,
    prioridade: "P2",
    offsetDias: 4,
    valorEstimado: null,
  },
  {
    titulo: "Contratar motoboy parceiro",
    coluna: "A Fazer",
    isMarco: true,
    prioridade: "P2",
    offsetDias: 10,
    valorEstimado: null,
  },
  {
    titulo: "Divulgar lançamento nas redes",
    coluna: "A Fazer",
    isMarco: false,
    prioridade: "P3",
    offsetDias: null,
    valorEstimado: null,
  },
  {
    titulo: "Rodar teste piloto com clientes fiéis",
    coluna: "Em Andamento",
    isMarco: false,
    prioridade: "P1",
    offsetDias: 1,
    valorEstimado: null,
  },
];

/** Critério de conclusão de uma missão do quadro — resolvido por TÍTULO de
 * tarefa / NOME de coluna, nunca por ID (mesmo padrão do resto do módulo:
 * IDs são UUIDs gerados no seed e mudam a cada "refazer o case"). Nada aqui
 * é persistido — sempre derivado do estado atual das tarefas (ver missoes.ts). */
export type CriterioMissaoQuadro =
  | { tipo: "mover_tarefa"; tarefaTitulo: string; colunaDiferenteDe: string }
  | { tipo: "dependente"; dependeDeMissaoId: string };

export type MissaoQuadroCafeMangue = {
  id: string;
  texto: string;
  criterio: CriterioMissaoQuadro;
};

/** Decomposição do mesmo parágrafo que antes ficava acima do QuadroLab numa
 * lista de missões — mesmo texto, sem conteúdo novo. A missão 2 depende da 1. */
export const MISSOES_QUADRO_CAFE_MANGUE: MissaoQuadroCafeMangue[] = [
  {
    id: "mover-embalagens",
    texto: "Mova a tarefa “Testar embalagens térmicas” para fora de “A Fazer”.",
    criterio: { tipo: "mover_tarefa", tarefaTitulo: "Testar embalagens térmicas", colunaDiferenteDe: "A Fazer" },
  },
  {
    id: "reparar-teste-piloto",
    texto: "Repare: isso destrava “Rodar teste piloto com clientes fiéis”.",
    criterio: { tipo: "dependente", dependeDeMissaoId: "mover-embalagens" },
  },
];

export const INDICADORES_CAFE_MANGUE: { nome: string; valor_atual: number; meta: number; unidade: string }[] = [
  { nome: "Pedidos de delivery por semana", valor_atual: 18, meta: 50, unidade: "pedidos" },
  { nome: "Novos clientes cadastrados no app", valor_atual: 40, meta: 100, unidade: "clientes" },
  { nome: "Nota média de avaliação do delivery", valor_atual: 4.2, meta: 5, unidade: "estrelas" },
];

export const DECISOES_CAFE_MANGUE: {
  titulo: string;
  decisao: string;
  motivo: string;
  impacto_esperado: string;
  valor_estimado: number | null;
}[] = [
  {
    titulo: "Delivery próprio em vez de marketplace terceirizado",
    decisao:
      "Priorizar um app de pedidos próprio, mesmo sendo mais lento pra lançar, em vez de entrar num marketplace de delivery terceirizado.",
    motivo: "A taxa dos marketplaces (até 30% por pedido) inviabilizaria a margem do cardápio do Café do Mangue.",
    impacto_esperado: "Margem melhor por pedido, ao custo de um lançamento mais lento e mais trabalho de divulgação própria.",
    valor_estimado: 4500,
  },
];

/** Contas a pagar fictícias do Financeiro do Lab (Sub-entrega 1 do
 * cross-módulo) — cobrem os 3 estados visuais possíveis (vencida/em
 * aberto/paga) e demonstram os dois vínculos de origem (tarefa/decisão) mais
 * uma conta avulsa, mesmo espírito de INDICADORES_CAFE_MANGUE/DECISOES_CAFE_MANGUE.
 * Datas relativas a "agora" (mesmo padrão de offsetDias das tarefas) — ver
 * dataDoOffset() em seed-cafe-mangue.ts. */
export const CONTAS_A_PAGAR_CAFE_MANGUE: {
  nome: string;
  valor: number;
  categoria: CategoriaFinanceira;
  offsetDiasVencimento: number;
  pago: boolean;
  offsetDiasPagamento: number | null;
  tarefaTitulo: string | null;
  decisaoTitulo: string | null;
}[] = [
  {
    nome: "Fornecedor de embalagens térmicas",
    valor: 640,
    categoria: "consumo",
    offsetDiasVencimento: -3,
    pago: false,
    offsetDiasPagamento: null,
    tarefaTitulo: "Testar embalagens térmicas",
    decisaoTitulo: null,
  },
  {
    nome: "Aluguel do ponto",
    valor: 3200,
    categoria: "despesa",
    offsetDiasVencimento: 6,
    pago: false,
    offsetDiasPagamento: null,
    tarefaTitulo: null,
    decisaoTitulo: null,
  },
  {
    nome: "Desenvolvimento do app de pedidos",
    valor: 4500,
    categoria: "investimento",
    offsetDiasVencimento: -20,
    pago: true,
    offsetDiasPagamento: -18,
    tarefaTitulo: null,
    decisaoTitulo: "Delivery próprio em vez de marketplace terceirizado",
  },
];

/** Missão de uma etapa do Lab pós-quadro (Visão 360°, Financeiro, ...) — o
 * critério de conclusão não deriva do estado atual dos dados (frágil: editar
 * e depois voltar ao valor original do seed desmarcaria uma missão
 * genuinamente feita). Aqui o critério é a presença do passo em lab_passos,
 * gravado dentro da própria Server Action Lab-aware no sucesso do
 * insert/update (ver decisoes-indicadores.ts/financeiro.ts). Generalizado
 * (antes MissaoVisao360CafeMangue, restrito à Fase A2) na Sub-entrega 1 da
 * integração cross-módulo pra reaproveitar também no Financeiro. */
export type MissaoLab = {
  id: PassoLab;
  texto: string;
};

export const MISSOES_VISAO_360_CAFE_MANGUE: MissaoLab[] = [
  { id: "criar_decisao", texto: "Registre uma nova decisão do Café do Mangue." },
  { id: "atualizar_indicador", texto: "Atualize o valor atual de um indicador." },
];

export const MISSOES_FINANCEIRO_CAFE_MANGUE: MissaoLab[] = [
  {
    id: "marcar_valor_estimado",
    texto: 'Preencha o valor estimado da tarefa "Contratar motoboy parceiro".',
  },
  {
    id: "gerar_conta_a_pagar",
    texto: "Gere a conta a pagar dessa tarefa a partir do valor estimado.",
  },
  {
    id: "marcar_conta_paga",
    texto: "Marque essa conta como paga.",
  },
];

/** Estatísticas fictícias de incentivo — sempre exibidas com moldura visual
 * própria (ver estatistica-ficticia.tsx), claramente contextualizadas como
 * parte da narrativa do case, nunca confundíveis com dado real do Gaiamum. */
export const ESTATISTICAS_FICTICIAS_CAFE_MANGUE: string[] = [
  "No case do Café do Mangue, quem resolve a tarefa atrasada antes de continuar costuma destravar o teste piloto até 2x mais rápido.",
  "Cafeterias fictícias que vinculam uma meta SMART ao projeto, como o Café do Mangue fez, chegam à Visão 360° com um fator a menos pra se preocupar.",
];

/** Texto fixo simulando como seria a explicação de IA do Alinhamento
 * Gaiamum — nunca chama o Gemini de verdade dentro do Lab. Escrito em termos
 * qualitativos (não cita o score numérico exato), pra continuar coerente
 * mesmo que o score calculado ao vivo varie um pouco. */
export const EXPLICACAO_SIMULADA_CAFE_MANGUE = `O Café do Mangue está com uma base estratégica boa — a meta SMART dá clareza de rumo — mas a execução ainda está no começo: só 1 das 6 tarefas do quadro foi concluída, e os dois indicadores de tração (pedidos e clientes cadastrados) estão bem abaixo da meta. O ponto de atenção real é a única tarefa atrasada, "Testar embalagens térmicas" — ela trava o teste piloto com clientes fiéis, que depende dela pra rodar. Prioridade prática: destravar essa tarefa primeiro, porque é ela que libera o resto da fila e começa a puxar os indicadores de pedidos e clientes pra cima.`;

/** Blocos "por que isso existe no Gaiamum" (PorQueIssoExiste) — pedido do
 * Fabio (sessão da Sub-entrega 1 do cross-módulo): explicam o produto REAL
 * (não o case), pra quem nunca usou Notion/OKR entender de cara o valor de
 * uma Decisão, um Indicador, ou uma tarefa virando lançamento financeiro
 * sozinha. Diferente de EXPLICACAO_SIMULADA_CAFE_MANGUE (comenta o case). */
export const PORQUE_DECISOES_INDICADORES = `Uma "Decisão" aqui não é uma tarefa — é um registro do que foi decidido, por quê, e qual resultado se esperava. Meses depois, quando o resultado chegar (bom ou ruim), você vai lembrar exatamente a lógica que usou pra decidir, não só o que aconteceu — muito útil quando alguém pergunta "por que a gente fez isso mesmo?". Um "Indicador" é um número que você acompanha ao longo do tempo, sempre ligado a uma meta — ele existe pra você enxergar, de forma objetiva, se está se aproximando ou se afastando do que quer alcançar, em vez de confiar só na sensação de "acho que estamos indo bem".`;

export const PORQUE_FINANCEIRO_CAFE_MANGUE = `Repare que a tarefa e a decisão que você viu na Visão 360° têm um valor estimado — e viram um lançamento aqui no Financeiro com um clique. Isso não é coincidência: no Gaiamum, o que você decide e executa no dia a dia se conecta automaticamente com o dinheiro do negócio, sem precisar copiar a mesma informação em duas ferramentas separadas. O Kanban, as Decisões e o Financeiro são o mesmo sistema, vistos de ângulos diferentes.`;
