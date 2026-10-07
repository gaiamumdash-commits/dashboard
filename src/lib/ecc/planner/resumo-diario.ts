import { FUSO_BRASIL } from "@/lib/ecc/kanban";
import { diaIsoDe, horarioCurto, planejadosNoDia, somarDiasChave } from "@/lib/ecc/planner/regras";
import type { CompromissoPlanner, HabitoPlanner, ManutencaoPlanner, RegistroHabito } from "@/lib/ecc/planner/tipos";

// Conteúdo do e-mail "Resumo do dia" do Planner (migration 0058). Lógica
// pura, testada em `__tests__/planner-resumo-diario.test.ts` — o cron só
// busca as linhas (service role) e agrupa por pessoa+workspace.

export type ResumoDiario = {
  compromissos: { titulo: string; horario: string; local: string | null }[];
  rotinas: { nome: string; horario: string | null }[];
  habitos: string[];
  manutencoes: { nome: string; atrasada: boolean }[];
  /** Ontem: feitos de planejados (hábitos+rotinas). null = nada planejado ontem. */
  ontem: { feitos: number; planejados: number } | null;
};

function horaNoBrasil(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO_BRASIL, hour: "2-digit", minute: "2-digit" });
}

/** O dia de UMA pessoa num workspace. Recebe só as linhas dela. */
export function montarResumoDiario(entrada: {
  hoje: string;
  habitos: Pick<HabitoPlanner, "id" | "nome" | "tipo" | "dias_semana" | "horario" | "ativo">[];
  registrosDeOntem: Pick<RegistroHabito, "habito_id">[];
  /** Compromissos de hoje, não concluídos. */
  compromissos: Pick<CompromissoPlanner, "titulo" | "inicio" | "local">[];
  /** Manutenções ativas com próxima data até hoje. */
  manutencoes: Pick<ManutencaoPlanner, "nome" | "proxima_data">[];
}): ResumoDiario {
  const ativos = entrada.habitos.filter((h) => h.ativo);
  const doDia = planejadosNoDia(ativos, entrada.hoje);

  const ontem = somarDiasChave(entrada.hoje, -1);
  const planejadosOntem = ativos.filter((h) => h.dias_semana.includes(diaIsoDe(ontem)));
  const feitosOntem = new Set(entrada.registrosDeOntem.map((r) => r.habito_id));

  return {
    compromissos: [...entrada.compromissos]
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map((c) => ({ titulo: c.titulo, horario: horaNoBrasil(c.inicio), local: c.local })),
    rotinas: doDia.filter((h) => h.tipo === "rotina").map((h) => ({ nome: h.nome, horario: horarioCurto(h.horario) })),
    habitos: doDia.filter((h) => h.tipo === "habito").map((h) => h.nome),
    manutencoes: entrada.manutencoes
      .filter((m) => m.proxima_data && m.proxima_data <= entrada.hoje)
      .map((m) => ({ nome: m.nome, atrasada: (m.proxima_data as string) < entrada.hoje })),
    ontem:
      planejadosOntem.length === 0
        ? null
        : { feitos: planejadosOntem.filter((h) => feitosOntem.has(h.id)).length, planejados: planejadosOntem.length },
  };
}

/** Dia sem nada a fazer não gera e-mail (o "como foi ontem" sozinho não
 * justifica mandar nada). */
export function resumoTemConteudo(r: ResumoDiario): boolean {
  return r.compromissos.length + r.rotinas.length + r.habitos.length + r.manutencoes.length > 0;
}

/** Assunto curto, com o que mais importa primeiro. */
export function assuntoDoResumo(r: ResumoDiario): string {
  const partes: string[] = [];
  if (r.compromissos.length) partes.push(`${r.compromissos.length} ${r.compromissos.length === 1 ? "compromisso" : "compromissos"}`);
  const recorrentes = r.rotinas.length + r.habitos.length;
  if (recorrentes) partes.push(`${recorrentes} ${recorrentes === 1 ? "hábito/rotina" : "hábitos e rotinas"}`);
  if (r.manutencoes.length) partes.push(`${r.manutencoes.length} ${r.manutencoes.length === 1 ? "manutenção" : "manutenções"}`);
  return `Seu dia no Planner: ${partes.join(", ")}`;
}

/** Texto puro (fallback do e-mail e base do teste). */
export function textoDoResumo(r: ResumoDiario, nome: string, urlPlanner: string): string {
  const linhas = [`Bom dia, ${nome}! Este é o seu dia no Planner do Gaiamum.`, ""];
  if (r.compromissos.length) {
    linhas.push("Compromissos:", ...r.compromissos.map((c) => `- ${c.horario} ${c.titulo}${c.local ? ` (${c.local})` : ""}`), "");
  }
  if (r.rotinas.length) {
    linhas.push("Rotinas:", ...r.rotinas.map((x) => `- ${x.horario ? `${x.horario} ` : ""}${x.nome}`), "");
  }
  if (r.habitos.length) linhas.push("Hábitos de hoje:", ...r.habitos.map((h) => `- ${h}`), "");
  if (r.manutencoes.length) {
    linhas.push("Manutenções:", ...r.manutencoes.map((m) => `- ${m.nome}${m.atrasada ? " (atrasada)" : " (vence hoje)"}`), "");
  }
  if (r.ontem) linhas.push(`Ontem: ${r.ontem.feitos} de ${r.ontem.planejados} hábitos e rotinas feitos.`, "");
  linhas.push(`Abrir meu Planner: ${urlPlanner}`, "", "Pra não receber mais este resumo, desligue em Meu Planner → “Resumo do dia por e-mail”.");
  return linhas.join("\n");
}
