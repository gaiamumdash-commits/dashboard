import { hojeISOBrasil, FUSO_BRASIL, urgenciaDoPrazo } from "@/lib/ecc/kanban";
import type { ContaAPagar, MetaSmart, Receita, Tarefa } from "@/lib/ecc/tipos";

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** `Date.now()` chamado aqui, fora de componente — direto no corpo de um
 * Server Component/dentro do JSX viola `react-hooks/purity` (achado real já
 * documentado no projeto, checkpoint #65 do handoff). Usado por
 * `contasVencendoEmDias`/`tarefasNaJanelaDeDias` abaixo. */
function dentroDeDiasAPartirDeAgora(dias: number): number {
  return Date.now() + dias * UM_DIA_MS;
}

/** Tarefas em aberto com `data_limite` dentro da janela (inclui atrasadas,
 * cuja data já passou). Mesma janela usada por "Próximos passos" e pelo
 * cálculo de "prazo importante da semana" em `prazoImportanteDaSemana`. */
export function tarefasNaJanelaDeDias<T extends Pick<Tarefa, "data_limite">>(tarefas: T[], dias = 7): T[] {
  const limite = dentroDeDiasAPartirDeAgora(dias);
  return tarefas.filter((t) => t.data_limite && new Date(t.data_limite).getTime() <= limite);
}

/** Contas a pagar não pagas com vencimento entre agora e `dias` dias — usado
 * pelo alerta amarelo da faixa de saudação e pelo aviso do card "Financeiro
 * do mês" (mesma janela nos dois). */
export function contasVencendoEmDias(
  contas: Pick<ContaAPagar, "pago" | "data_vencimento" | "valor">[],
  dias = 7,
): { quantidade: number; valorTotal: number } {
  const agora = Date.now();
  const limite = dentroDeDiasAPartirDeAgora(dias);
  const vencendo = contas.filter((c) => {
    if (c.pago) return false;
    const vencimento = new Date(c.data_vencimento).getTime();
    return vencimento >= agora && vencimento <= limite;
  });
  return { quantidade: vencendo.length, valorTotal: vencendo.reduce((soma, c) => soma + c.valor, 0) };
}

export type FinanceiroDoMes = {
  entradas: number;
  saidas: number;
  saldoPrevisto: number;
  comprometido: number | null;
};

/** Números do card "Financeiro do mês". `entradas` soma as receitas do mês
 * (`receitas`, migration 0054) — previstas e já recebidas, do mesmo jeito que
 * `saidas` soma as contas do mês pagas ou não: os dois lados são "o que o mês
 * prevê". `saldoPrevisto` é a diferença de verdade (entradas - saídas), e
 * fica negativo quando o mês gasta mais do que entra — reflete a realidade,
 * não esconde ela. `comprometido` é `saídas/entradas`; sem nenhuma entrada
 * mas com saída, o comprometimento é 100% (gastando sem nenhuma renda
 * registrada); sem saída nem entrada, `null` (nada pra medir). */
export function calcularFinanceiroDoMes(
  contasDoMes: Pick<ContaAPagar, "valor">[],
  receitasDoMes: Pick<Receita, "valor">[] = [],
): FinanceiroDoMes {
  const entradas = receitasDoMes.reduce((soma, r) => soma + r.valor, 0);
  const saidas = contasDoMes.reduce((soma, c) => soma + c.valor, 0);
  const saldoPrevisto = entradas - saidas;
  const comprometido = entradas > 0 ? Math.min(100, Math.round((100 * saidas) / entradas)) : saidas > 0 ? 100 : null;
  return { entradas, saidas, saldoPrevisto, comprometido };
}

/** Lógica pura (sem I/O, sem Server Component/Action) por trás do "Painel
 * geral" (`src/app/page.tsx`) — mesmo padrão de `kanban.ts`/`visao-360.ts`:
 * decisões testáveis isoladas das queries. */

/** Saudação de acordo com o horário (fuso de Brasília, não o do servidor —
 * Vercel roda em UTC). Faixas simples: madrugada/manhã = "Bom dia", tarde =
 * "Boa tarde", noite = "Boa noite". */
export function saudacaoPorHorario(data: Date): "Bom dia" | "Boa tarde" | "Boa noite" {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_BRASIL, hour: "2-digit", hour12: false }).format(data),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** Primeiro nome pra saudação, a partir do e-mail — não existe campo de nome
 * cadastrado em lugar nenhum do sistema (`nome_exibicao`, em
 * `membros_do_tenant()`, já é a mesma derivação). Mesmo padrão já usado em
 * `components/kanban/detalhe-tarefa.tsx` e `api/cron/reengajamento-lab`. */
export function primeiroNome(email: string): string {
  const parteLocal = email.split("@")[0] || email;
  return parteLocal.charAt(0).toUpperCase() + parteLocal.slice(1);
}

export type SaudeProjeto = "no_caminho" | "atencao";

/** Saúde do projeto pro design ("No caminho"/"Atenção") — deliberadamente
 * calculada, não um campo manual: é diferente de `Projeto.status`
 * (ativo/pausado/concluído, ciclo de vida escolhido pela pessoa). "Atenção"
 * quando há pelo menos 1 tarefa aberta atrasada. */
export function calcularSaudeProjeto(
  tarefas: Pick<Tarefa, "coluna_id" | "data_limite">[],
  colunasConcluidoIds: Set<string>,
): SaudeProjeto {
  const temAtrasada = tarefas.some(
    (t) => urgenciaDoPrazo(t, colunasConcluidoIds.has(t.coluna_id)) === "atrasado",
  );
  return temAtrasada ? "atencao" : "no_caminho";
}

/** A meta "principal" pra destacar na home. `metas_smart` tem índice único
 * `(tenant_id, horizonte)` — no máximo 1 meta por horizonte, nunca mais de 2
 * no total. A de longo prazo é a visão maior ("North Star"); se só existir a
 * de médio prazo, usa essa. Sem campo novo de "é a principal". */
export function selecionarMetaPrincipal(metas: MetaSmart[]): MetaSmart | null {
  return metas.find((m) => m.horizonte === "longo_prazo") ?? metas[0] ?? null;
}

/** % de tarefas concluídas entre as informadas — reaproveitável tanto pra 1
 * projeto quanto pra um conjunto agregado (todos os projetos vinculados à
 * meta principal). `null` quando não há tarefa nenhuma (nada pra medir). */
export function progressoDeTarefas(
  tarefas: Pick<Tarefa, "coluna_id">[],
  colunasConcluidoIds: Set<string>,
): number | null {
  if (tarefas.length === 0) return null;
  const concluidas = tarefas.filter((t) => colunasConcluidoIds.has(t.coluna_id)).length;
  return Math.round((100 * concluidas) / tarefas.length);
}

/** Próximo marco em aberto (menor `data_limite` entre `is_marco && !concluída
 * && data_limite`) — usado tanto pra "Meta principal" quanto pra "Seu dia"
 * (prazo importante da semana). `null` quando não há marco pendente. */
export function proximoMarco<T extends Pick<Tarefa, "coluna_id" | "is_marco" | "data_limite">>(
  tarefas: T[],
  colunasConcluidoIds: Set<string>,
): T | null {
  const candidatos = tarefas
    .filter((t) => t.is_marco && t.data_limite && !colunasConcluidoIds.has(t.coluna_id))
    .sort((a, b) => new Date(a.data_limite as string).getTime() - new Date(b.data_limite as string).getTime());
  return candidatos[0] ?? null;
}

/** "Prazo importante da semana" ("Seu dia") — dentro da janela (7 dias por
 * padrão), prioriza marcos (`proximoMarco`); sem marco na janela, cai pra
 * tarefa de prazo mais próximo, de qualquer prioridade. `null` sem nada
 * pendente na janela. */
export function prazoImportanteDaSemana<
  T extends Pick<Tarefa, "coluna_id" | "is_marco" | "data_limite">,
>(tarefas: T[], colunasConcluidoIds: Set<string>, dentroDeDias = 7): T | null {
  const limite = Date.now() + dentroDeDias * 24 * 60 * 60 * 1000;
  const abertasNaJanela = tarefas.filter(
    (t) =>
      t.data_limite &&
      !colunasConcluidoIds.has(t.coluna_id) &&
      new Date(t.data_limite).getTime() <= limite,
  );

  const marco = proximoMarco(abertasNaJanela, colunasConcluidoIds);
  if (marco) return marco;

  const ordenadas = [...abertasNaJanela].sort(
    (a, b) => new Date(a.data_limite as string).getTime() - new Date(b.data_limite as string).getTime(),
  );
  return ordenadas[0] ?? null;
}

const DIAS_SEMANA_BRASIL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "Hoje" / "Amanhã" / nome do dia da semana (até 7 dias) / data curta depois
 * disso — comparação por data civil no fuso de Brasília (não por diferença
 * de milissegundos, que erra perto da virada do dia). */
export function prazoRelativo(dataIso: string): string {
  const hojeChave = hojeISOBrasil();
  const dataFormatador = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BRASIL });
  const dataChave = dataFormatador.format(new Date(dataIso)); // AAAA-MM-DD

  if (dataChave === hojeChave) return "Hoje";

  const diffDias = Math.round(
    (new Date(`${dataChave}T00:00:00`).getTime() - new Date(`${hojeChave}T00:00:00`).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  if (diffDias === 1) return "Amanhã";
  if (diffDias < 0) {
    return new Date(dataIso).toLocaleDateString("pt-BR", { timeZone: FUSO_BRASIL, day: "2-digit", month: "2-digit" });
  }
  if (diffDias <= 6) {
    // `T00:00:00` sem fuso explícito cai no mesmo dia civil em qualquer
    // fuso — seguro aqui porque só queremos o dia da semana de uma data
    // civil (AAAA-MM-DD), não um instante.
    const diaSemanaHoje = new Date(`${hojeChave}T00:00:00`).getDay();
    return DIAS_SEMANA_BRASIL[(diaSemanaHoje + diffDias) % 7];
  }
  return new Date(dataIso).toLocaleDateString("pt-BR", { timeZone: FUSO_BRASIL, day: "2-digit", month: "2-digit" });
}

export type SeveridadeAlerta = "vermelho" | "amarelo" | "azul";

export type Alerta = {
  severidade: SeveridadeAlerta;
  texto: string;
};

/** Monta até 3 alertas prioritários pra faixa de saudação, na ordem: tarefas
 * atrasadas (vermelho) → contas vencendo em 7 dias (amarelo, só pra quem vê
 * financeiro) → compromissos de hoje (azul). Entra em "azul" tanto a
 * contagem de compromissos quanto, na ausência deles, um convite pra
 * conectar a agenda — nunca mais que 3 ao todo. */
export function montarAlertasPrioritarios(entrada: {
  tarefasAtrasadas: number;
  contasVencendoEm7Dias: { quantidade: number; valorTotal: number } | null;
  compromissosHoje: number | "oculto" | "problema";
}): Alerta[] {
  const alertas: Alerta[] = [];

  if (entrada.tarefasAtrasadas > 0) {
    alertas.push({
      severidade: "vermelho",
      texto:
        entrada.tarefasAtrasadas === 1
          ? "1 tarefa atrasada"
          : `${entrada.tarefasAtrasadas} tarefas atrasadas`,
    });
  }

  if (entrada.contasVencendoEm7Dias && entrada.contasVencendoEm7Dias.quantidade > 0) {
    const valorFormatado = entrada.contasVencendoEm7Dias.valorTotal.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    alertas.push({ severidade: "amarelo", texto: `${valorFormatado} vencem nos próximos 7 dias` });
  }

  if (typeof entrada.compromissosHoje === "number") {
    alertas.push({
      severidade: "azul",
      texto:
        entrada.compromissosHoje === 0
          ? "Nenhum compromisso hoje"
          : entrada.compromissosHoje === 1
            ? "1 compromisso hoje"
            : `${entrada.compromissosHoje} compromissos hoje`,
    });
  } else if (entrada.compromissosHoje === "oculto") {
    alertas.push({ severidade: "azul", texto: "Conecte sua agenda pra ver os compromissos de hoje" });
  }

  return alertas.slice(0, 3);
}
