import type { CorEtiqueta, FonteItemAgenda } from "@/lib/ecc/tipos";

// Eventos de dia inteiro vêm do Google como "2026-09-02" (só data, sem
// hora) — o JS interpreta isso como meia-noite UTC, não local, o que
// adianta/atrasa o dia em fusos negativos (Brasil). Forçar hora local
// explícita evita isso — mesmo padrão já usado em checklist-contas.tsx.
export const APENAS_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function paraDataLocal(iso: string): Date {
  return APENAS_DATA.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
}

export function formatarHora(iso: string): string {
  if (!iso) return "";
  if (APENAS_DATA.test(iso)) return "Dia inteiro";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const RÓTULO_FONTE: Record<FonteItemAgenda, string> = {
  google: "Google",
  conta_a_pagar: "Financeiro",
  tarefa: "Kanban",
  evento_agenda: "Agenda",
  decisao: "Decisões",
};

/** Mapeia cada fonte a uma das 6 cores fixas já usadas no kanban
 * (`CLASSE_COR_ETIQUETA`/`CorEtiqueta` em kanban.ts) — reaproveitadas pelos
 * blocos da grade semanal e pela faixa "dia inteiro", zero token novo. */
export const COR_FONTE_AGENDA: Record<FonteItemAgenda, CorEtiqueta> = {
  google: "blue",
  conta_a_pagar: "coral",
  tarefa: "purple",
  evento_agenda: "teal",
  decisao: "yellow",
};
