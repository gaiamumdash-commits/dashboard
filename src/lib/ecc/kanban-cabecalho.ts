import { FUSO_BRASIL } from "@/lib/ecc/kanban";
import type { CompromissoDoDia } from "@/lib/ecc/agenda";
import type { ColunaKanban, Tarefa } from "@/lib/ecc/tipos";

/** Lógica pura (sem I/O) por trás do cabeçalho redesenhado do Kanban
 * (`/projetos/[id]/tarefas`, redesenho de 2026-10-05) — progresso, faixa
 * contextual do dia e filtros visuais da toolbar. Mesmo padrão de
 * `kanban.ts`/`painel-geral.ts`: decisões testáveis isoladas dos
 * componentes. Nenhuma regra de negócio nova: tudo aqui só RESUME dado que
 * o quadro já tinha (colunas, prazos, cronômetro de hiperfoco). */

export type ResumoProgressoQuadro = {
  concluidas: number;
  total: number;
  abertas: number;
  percentual: number;
};

/** Mesma fórmula que a barra de rodapé do quadro usava antes do redesenho
 * (cartões na coluna fixa "Concluído" ÷ total de cartões, arredondado) — só
 * mudou de lugar, não de cálculo. `abertas` = o que não está concluído. */
export function resumirProgressoQuadro(
  tarefas: Pick<Tarefa, "coluna_id">[],
  colunaConcluidoId: string | null,
): ResumoProgressoQuadro {
  const total = tarefas.length;
  const concluidas = colunaConcluidoId ? tarefas.filter((t) => t.coluna_id === colunaConcluidoId).length : 0;
  const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  return { concluidas, total, abertas: total - concluidas, percentual };
}

/** Quantos cartões estão na coluna de foco (`dispara_hiperfoco`, "Em
 * Desenvolvimento") — o "N em foco" do cabeçalho. */
export function contarEmFoco(
  tarefas: Pick<Tarefa, "coluna_id">[],
  colunas: Pick<ColunaKanban, "id" | "dispara_hiperfoco">[],
): number {
  const idsFoco = new Set(colunas.filter((c) => c.dispara_hiperfoco).map((c) => c.id));
  return tarefas.filter((t) => idsFoco.has(t.coluna_id)).length;
}

const formatadorChaveDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BRASIL });

/** "Prazo importante hoje" da faixa do dia — cartões ainda não concluídos
 * cujo prazo cai na data civil de hoje (fuso Brasil). Destaque: marco
 * primeiro (mesmo critério de `proximoMarco` no Painel), senão o de horário
 * mais cedo. `hojeChave` ("AAAA-MM-DD") vem de fora pra manter a função pura. */
export function prazosDeHoje<T extends Pick<Tarefa, "coluna_id" | "data_limite" | "is_marco">>(
  tarefas: T[],
  colunasConcluidoIds: Set<string>,
  hojeChave: string,
): { quantidade: number; destaque: T | null } {
  const deHoje = tarefas
    .filter(
      (t) =>
        t.data_limite &&
        !colunasConcluidoIds.has(t.coluna_id) &&
        formatadorChaveDia.format(new Date(t.data_limite)) === hojeChave,
    )
    .sort((a, b) => {
      if (a.is_marco !== b.is_marco) return a.is_marco ? -1 : 1;
      return new Date(a.data_limite as string).getTime() - new Date(b.data_limite as string).getTime();
    });
  return { quantidade: deHoje.length, destaque: deHoje[0] ?? null };
}

/** Cronômetro de hiperfoco ativo DA PESSOA LOGADA — no máximo 1 por pessoa
 * (índice único da migration 0052), então basta achar o primeiro. Cartão sem
 * duração definida (`tempo_estimado_min`) não tem contagem a mostrar. */
export function focoAtivoDoUsuario<
  T extends Pick<Tarefa, "hiperfoco_iniciado_em" | "hiperfoco_user_id" | "tempo_estimado_min">,
>(tarefas: T[], usuarioId: string | null): T | null {
  if (!usuarioId) return null;
  return (
    tarefas.find((t) => t.hiperfoco_iniciado_em && t.tempo_estimado_min && t.hiperfoco_user_id === usuarioId) ?? null
  );
}

/** Fração já decorrida do cronômetro (0 a 1) — alimenta a barrinha de
 * progresso do timer. `Date.now()` encapsulado aqui pelo mesmo motivo de
 * `minutosRestantesHiperfoco` (`react-hooks/purity` proíbe no corpo do
 * componente). */
export function fracaoDecorridaHiperfoco(iniciadoEm: string, minutos: number, agoraMs: number = Date.now()): number {
  const duracaoMs = minutos * 60_000;
  if (duracaoMs <= 0) return 1;
  const decorrido = agoraMs - new Date(iniciadoEm).getTime();
  return Math.min(1, Math.max(0, decorrido / duracaoMs));
}

export function segundosRestantesHiperfoco(iniciadoEm: string, minutos: number, agoraMs: number = Date.now()): number {
  const fimMs = new Date(iniciadoEm).getTime() + minutos * 60_000;
  return Math.max(0, Math.ceil((fimMs - agoraMs) / 1000));
}

/** "18:42" / "1:05:09" — contagem regressiva do cartão em foco. */
export function formatarCronometro(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const horas = Math.floor(s / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  const resto = s % 60;
  const mm = String(minutos).padStart(horas > 0 ? 2 : 1, "0");
  const ss = String(resto).padStart(2, "0");
  return horas > 0 ? `${horas}:${mm}:${ss}` : `${mm.padStart(2, "0")}:${ss}`;
}

/** Próximo compromisso do dia (início a partir de agora). Compromisso de dia
 * inteiro (`ordem === 0`, ver `listarCompromissosDoDia`) não tem "hora" pra
 * ser o próximo — fica de fora. `null` quando não sobra nenhum hoje. */
export function proximoCompromisso(compromissos: CompromissoDoDia[], agoraMs: number = Date.now()): CompromissoDoDia | null {
  return compromissos.filter((c) => c.ordem > 0 && c.ordem >= agoraMs).sort((a, b) => a.ordem - b.ordem)[0] ?? null;
}

/** Só o horário de início de "09:00–10:00" (ou o próprio texto, se não tiver
 * intervalo — "Dia inteiro", "09:00"). */
export function horarioDeInicio(horario: string): string {
  return horario.split("–")[0].trim();
}

export type FiltroQuadro = {
  busca: string;
  somenteMinhas: boolean;
  prioridades: Tarefa["prioridade"][];
  etiquetaIds: string[];
};

export const FILTRO_QUADRO_VAZIO: FiltroQuadro = { busca: "", somenteMinhas: false, prioridades: [], etiquetaIds: [] };

export function filtroQuadroAtivo(filtro: FiltroQuadro): boolean {
  return (
    filtro.busca.trim().length > 0 || filtro.somenteMinhas || filtro.prioridades.length > 0 || filtro.etiquetaIds.length > 0
  );
}

function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Filtro VISUAL da toolbar (busca, "Minhas tarefas", prioridade, etiqueta)
 * — só decide quais cartões aparecem; nunca toca no estado real do quadro,
 * na ordem ou no banco (arrastar/"Mover para..." continuam calculando a
 * posição sobre a lista completa). Critérios combinam com E; dentro de
 * prioridade/etiqueta, com OU. */
export function filtrarTarefasDoQuadro<T extends Pick<Tarefa, "id" | "titulo" | "prioridade">>(
  tarefas: T[],
  filtro: FiltroQuadro,
  contexto: { tarefasDoUsuario: Set<string>; etiquetasPorTarefa: Map<string, Set<string>> },
): T[] {
  if (!filtroQuadroAtivo(filtro)) return tarefas;
  const busca = normalizarTexto(filtro.busca.trim());
  return tarefas.filter((t) => {
    if (busca && !normalizarTexto(t.titulo).includes(busca)) return false;
    if (filtro.somenteMinhas && !contexto.tarefasDoUsuario.has(t.id)) return false;
    if (filtro.prioridades.length > 0 && !filtro.prioridades.includes(t.prioridade)) return false;
    if (filtro.etiquetaIds.length > 0) {
      const daTarefa = contexto.etiquetasPorTarefa.get(t.id);
      if (!daTarefa || !filtro.etiquetaIds.some((id) => daTarefa.has(id))) return false;
    }
    return true;
  });
}
