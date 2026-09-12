import type { CategoriaFinanceira, Horizonte, Prioridade } from "@/lib/ecc/tipos";
import type { PassoLab } from "@/lib/ecc/lab/progresso";
import type { PartialBlock } from "@blocknote/core";

/** Conteúdo do estudo de caso fictício "Café Mangue" — constantes puras, sem
 * I/O. Calibrado pra render um score de Alinhamento Gaiamum intermediário
 * (nem 0 nem 100%), mostrando os 4 fatores com dado real: 1 de 6 tarefas
 * concluídas, 1 tarefa atrasada, indicadores abaixo da meta em graus
 * diferentes, meta SMART vinculada. */

export const NOME_PROJETO_CAFE_MANGUE = "Café do Mangue";

export const PROJETO_CAFE_MANGUE = {
  resultadoEsperado:
    "Criar uma noite fixa de música ao vivo em 60 dias, sem perder qualidade no atendimento do dia a dia.",
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
  visao_macro: "Aumentar o faturamento mensal do Café do Mangue em 25% enchendo o salão nos dias de semana mais fracos.",
  specific: "Criar a Noite do Mangue: uma noite fixa de música ao vivo, com consumação mínima, nas terças do Café do Mangue.",
  measurable: "50 pessoas por noite, com nota média de avaliação acima de 4,5.",
  attainable:
    "A cafeteria já tem o salão vazio nas noites de semana e uma base de clientes fiéis pra validar o formato.",
  relevant:
    "O movimento do salão não cresce há 2 meses, principalmente nos dias de semana — a Noite do Mangue é a próxima alavanca de receita sem abrir uma segunda unidade.",
  time_bound: "60 dias, a partir do início da divulgação da primeira Noite do Mangue.",
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
    titulo: "Definir o repertório da primeira Noite do Mangue",
    coluna: "Concluído",
    isMarco: true,
    prioridade: "P2",
    offsetDias: -5,
    valorEstimado: null,
  },
  {
    titulo: "Testar o sistema de som",
    coluna: "A Fazer",
    isMarco: false,
    prioridade: "P1",
    offsetDias: -2,
    valorEstimado: 640,
  },
  {
    titulo: "Divulgar a Noite do Mangue nas redes",
    coluna: "Em Andamento",
    isMarco: false,
    prioridade: "P2",
    offsetDias: 4,
    valorEstimado: null,
  },
  {
    titulo: "Fechar músico fixo pras noites",
    coluna: "A Fazer",
    isMarco: true,
    prioridade: "P2",
    offsetDias: 10,
    valorEstimado: null,
  },
  {
    titulo: "Organizar reserva de mesas",
    coluna: "A Fazer",
    isMarco: false,
    prioridade: "P3",
    offsetDias: null,
    valorEstimado: null,
  },
  {
    titulo: "Rodar noite piloto com clientes fiéis",
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
    texto: "Mova a tarefa “Testar o sistema de som” para fora de “A Fazer”.",
    criterio: { tipo: "mover_tarefa", tarefaTitulo: "Testar o sistema de som", colunaDiferenteDe: "A Fazer" },
  },
  {
    id: "reparar-teste-piloto",
    texto: "Repare: isso destrava “Rodar noite piloto com clientes fiéis”.",
    criterio: { tipo: "dependente", dependeDeMissaoId: "mover-embalagens" },
  },
];

export const INDICADORES_CAFE_MANGUE: { nome: string; valor_atual: number; meta: number; unidade: string }[] = [
  { nome: "Público presente por noite", valor_atual: 18, meta: 50, unidade: "pessoas" },
  { nome: "Clientes novos captados nas noites", valor_atual: 40, meta: 100, unidade: "clientes" },
  { nome: "Nota média de avaliação da noite", valor_atual: 4.2, meta: 5, unidade: "estrelas" },
];

export const DECISOES_CAFE_MANGUE: {
  titulo: string;
  decisao: string;
  motivo: string;
  impacto_esperado: string;
  valor_estimado: number | null;
}[] = [
  {
    titulo: "Cobrar consumação mínima em vez de entrada paga",
    decisao:
      "Cobrar consumação mínima na Noite do Mangue, em vez de cobrar entrada paga na porta.",
    motivo: "Entrada paga afasta quem só quer passar pra ver — consumação mínima garante faturamento sem barreira na porta.",
    impacto_esperado: "Mais gente experimentando a noite, ao custo de um ticket médio um pouco menor no começo.",
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
    nome: "Conserto do sistema de som",
    valor: 640,
    categoria: "consumo",
    offsetDiasVencimento: -3,
    pago: false,
    offsetDiasPagamento: null,
    tarefaTitulo: "Testar o sistema de som",
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
    nome: "Montagem do cantinho de shows (palco e iluminação)",
    valor: 4500,
    categoria: "investimento",
    offsetDiasVencimento: -20,
    pago: true,
    offsetDiasPagamento: -18,
    tarefaTitulo: null,
    decisaoTitulo: "Cobrar consumação mínima em vez de entrada paga",
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
    texto: 'Preencha o valor estimado da tarefa "Fechar músico fixo pras noites".',
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
  "No case do Café do Mangue, quem resolve a tarefa atrasada antes de continuar costuma destravar a noite piloto até 2x mais rápido.",
  "Cafeterias fictícias que vinculam uma meta SMART ao projeto, como o Café do Mangue fez, chegam à Visão 360° com um fator a menos pra se preocupar.",
];

/** Texto fixo simulando como seria a explicação de IA do Alinhamento
 * Gaiamum — nunca chama o Gemini de verdade dentro do Lab. Escrito em termos
 * qualitativos (não cita o score numérico exato), pra continuar coerente
 * mesmo que o score calculado ao vivo varie um pouco. */
export const EXPLICACAO_SIMULADA_CAFE_MANGUE = `O Café do Mangue está com uma base estratégica boa — a meta SMART dá clareza de rumo — mas a execução ainda está no começo: só 1 das 6 tarefas do quadro foi concluída, e os dois indicadores de tração (público por noite e clientes novos) estão bem abaixo da meta. O ponto de atenção real é a única tarefa atrasada, "Testar o sistema de som" — ela trava a noite piloto com clientes fiéis, que depende dela pra rodar. Prioridade prática: destravar essa tarefa primeiro, porque é ela que libera o resto da fila e começa a puxar os indicadores de público e clientes pra cima.`;

/** Blocos "por que isso existe no Gaiamum" (PorQueIssoExiste) — pedido do
 * Fabio (sessão da Sub-entrega 1 do cross-módulo): explicam o produto REAL
 * (não o case), pra quem nunca usou Notion/OKR entender de cara o valor de
 * uma Decisão, um Indicador, ou uma tarefa virando lançamento financeiro
 * sozinha. Diferente de EXPLICACAO_SIMULADA_CAFE_MANGUE (comenta o case). */
export const PORQUE_DECISOES_INDICADORES = `Uma "Decisão" aqui não é uma tarefa — é um registro do que foi decidido, por quê, e qual resultado se esperava. Meses depois, quando o resultado chegar (bom ou ruim), você vai lembrar exatamente a lógica que usou pra decidir, não só o que aconteceu — muito útil quando alguém pergunta "por que a gente fez isso mesmo?". Um "Indicador" é um número que você acompanha ao longo do tempo, sempre ligado a uma meta — ele existe pra você enxergar, de forma objetiva, se está se aproximando ou se afastando do que quer alcançar, em vez de confiar só na sensação de "acho que estamos indo bem".`;

export const PORQUE_FINANCEIRO_CAFE_MANGUE = `Repare que a tarefa e a decisão que você viu na Visão 360° têm um valor estimado — e viram um lançamento aqui no Financeiro com um clique. Isso não é coincidência: no Gaiamum, o que você decide e executa no dia a dia se conecta automaticamente com o dinheiro do negócio, sem precisar copiar a mesma informação em duas ferramentas separadas. O Kanban, as Decisões e o Financeiro são o mesmo sistema, vistos de ângulos diferentes.`;

/** Compromissos fictícios da Agenda do Lab — mesmo padrão de offsetDias das
 * tarefas (dataLimiteDoOffset em seed-cafe-mangue.ts), cobrindo os 2 estados
 * visuais de origem: um criado manualmente e um "por voz" (com
 * transcricaoBruta preenchida, simulando que o Nonato criou por voz), pra
 * reforçar visualmente que os dois caminhos já existem no case sem o usuário
 * precisar criar nada pra ver a diferença. */
export type EventoAgendaSeedCafeMangue = {
  titulo: string;
  offsetDias: number;
  origem: "manual" | "voz";
  transcricaoBruta: string | null;
};

export const EVENTOS_AGENDA_CAFE_MANGUE: EventoAgendaSeedCafeMangue[] = [
  {
    titulo: "Reunião com fornecedor de bebidas — fechar consumação mínima",
    offsetDias: 3,
    origem: "manual",
    transcricaoBruta: null,
  },
  {
    titulo: "Ensaio de som com a banda",
    offsetDias: 5,
    origem: "voz",
    transcricaoBruta: "ensaio de som com a banda quinta às 19h",
  },
];

export const MISSOES_AGENDA_CAFE_MANGUE: MissaoLab[] = [
  { id: "criar_evento_agenda", texto: "Marque um compromisso manual, tipo a divulgação com o Théo." },
  { id: "usar_agenda_por_voz", texto: "Use o gravador de voz pra criar outro compromisso, tipo o ensaio de som." },
];

export const PORQUE_AGENDA_CAFE_MANGUE = `Repare que a grade abaixo já mostra, no mesmo lugar, uma conta a pagar vencendo, uma tarefa com prazo, uma decisão datada e um compromisso manual ou por voz — sem exigir nada novo de você. No Gaiamum, a Agenda não é mais um lugar pra anotar coisas: ela junta o que já existe espalhado pelo Kanban, pelas Decisões e pelo Financeiro num único calendário, pra você não precisar checar 4 telas diferentes só pra saber o que tem hoje.`;

/** Página livre fictícia pré-semeada — preenche os 2 blocos do template
 * (Material de referência / Ideias-algum dia) com conteúdo do case "Noite do
 * Mangue" pra reforçar visualmente a diferença entre os dois termos GTD, não
 * só o rótulo: o primeiro bloco é estático e consultável (contato, valor
 * combinado), o segundo são ideias ainda não comprometidas como tarefa ou
 * decisão. Ver PORQUE_PAGINAS_LIVRES_CAFE_MANGUE abaixo. */
export const PAGINA_LIVRE_CAFE_MANGUE: { titulo: string; conteudo: PartialBlock[] } = {
  titulo: "Notas da Noite do Mangue",
  conteudo: [
    {
      type: "heading",
      props: { level: 2 },
      content: "Material de referência",
    },
    {
      type: "bulletListItem",
      content: "Técnico de som (Rogério): (91) 98123-4567 — só chamar se o equipamento falhar de novo.",
    },
    {
      type: "bulletListItem",
      content: "Consumação mínima combinada com o salão: R$ 35 por pessoa.",
    },
    {
      type: "bulletListItem",
      content: "Senha do roteador do salão pra quem for tocar música (pedem sempre): mangue2024",
    },
    {
      type: "heading",
      props: { level: 2 },
      content: "Ideias / algum dia",
    },
    {
      type: "bulletListItem",
      content: "Fazer uma noite temática uma vez por mês (samba, MPB, forró) em vez de sempre o mesmo repertório.",
    },
    {
      type: "bulletListItem",
      content: "Parceria com uma cervejaria artesanal local pra ter uma cerveja exclusiva da Noite do Mangue.",
    },
    {
      type: "bulletListItem",
      content: "Testar cobrar ingresso antecipado pelo site quando a casa já estiver lotando toda terça.",
    },
  ],
};

export const MISSOES_PAGINAS_LIVRES_CAFE_MANGUE: MissaoLab[] = [
  { id: "criar_pagina_livre", texto: "Crie sua própria página livre." },
  { id: "editar_pagina_livre", texto: "Escreva algo em Material de referência ou em Ideias/algum dia." },
];

export const PORQUE_PAGINAS_LIVRES_CAFE_MANGUE = `"Material de referência" é onde fica o que você só precisa consultar depois — não é uma tarefa, não tem prazo, não vai pro Kanban, só existe pra você não perder (tipo o contato de um fornecedor ou um valor combinado). "Ideias / algum dia" é onde ficam ideias que você ainda não decidiu perseguir — se um dia virar um compromisso de verdade, ela sai daqui e vira uma tarefa no quadro ou uma Decisão registrada. A Página livre existe pra essas duas coisas não ficarem perdidas num post-it, no bloco de notas do celular ou numa conversa que ninguém mais acha.`;
