"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { listarAgendaUnificada } from "@/lib/ecc/agenda";
import { paraUtcDoFuso } from "@/lib/ecc/kanban";
import { marcarPassoConcluido, MODULO_AGENDA } from "@/lib/ecc/lab/progresso";
import type { ItemAgenda } from "@/lib/ecc/tipos";

/** Espelha src/lib/ecc/agenda.ts/eventos-agenda.ts trocando garantirWorkspace()
 * por garantirTenantLab() — mesmo cuidado das outras Server Actions Lab-aware
 * (financeiro.ts, decisoes-indicadores.ts). O tenant do Lab é sempre
 * solo-owner (souOwner=true) e nunca inclui o Google Calendar real do usuário
 * (incluirGoogle=false) — ver achados #1/#2 do plano da sub-entrega. */

const LINK_LAB_POR_FONTE: Partial<Record<ItemAgenda["fonte"], string>> = {
  conta_a_pagar: "/lab/financeiro",
  tarefa: "/lab/quadro",
  decisao: "/lab/visao-360",
};

async function exigirUsuario() {
  const user = await obterUsuarioAtual();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }
  return user;
}

export async function listarAgendaUnificadaLab(
  tenantIdLab: string,
  inicioSemana: Date,
  fimSemanaExclusivo: Date,
): Promise<{ itens: ItemAgenda[] }> {
  const { itens } = await listarAgendaUnificada(tenantIdLab, true, inicioSemana, fimSemanaExclusivo, false);

  return {
    itens: itens.map((item) => ({
      ...item,
      link: LINK_LAB_POR_FONTE[item.fonte] ?? item.link,
    })),
  };
}

export async function criarEventoAgendaManualLab(formData: FormData): Promise<void> {
  const user = await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();

  const titulo = String(formData.get("titulo") ?? "").trim();
  const inicio = String(formData.get("inicio") ?? "");
  const fim = String(formData.get("fim") ?? "");
  const fuso = String(formData.get("fuso") ?? "America/Sao_Paulo");
  const origem = formData.get("origem") === "voz" ? "voz" : "manual";
  const transcricaoBruta = formData.get("transcricao_bruta") ? String(formData.get("transcricao_bruta")) : null;

  if (!titulo || !inicio) {
    throw new Error("Preencha título e data/hora do compromisso.");
  }

  const inicioUtc = paraUtcDoFuso(inicio, fuso);
  const fimUtc = fim ? paraUtcDoFuso(fim, fuso) : null;
  if (fimUtc && fimUtc <= inicioUtc) {
    throw new Error("O fim precisa ser depois do início.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("eventos_agenda").insert({
    tenant_id: tenantIdLab,
    titulo,
    inicio: inicioUtc.toISOString(),
    fim: fimUtc ? fimUtc.toISOString() : null,
    origem,
    transcricao_bruta: transcricaoBruta,
    criado_por: user.id,
  });

  if (error) {
    throw new Error(`Falha ao criar compromisso do Lab: ${error.message}`);
  }

  await marcarPassoConcluido(user.id, origem === "voz" ? "usar_agenda_por_voz" : "criar_evento_agenda", MODULO_AGENDA);
  revalidatePath("/lab/agenda");
}

export async function excluirEventoAgendaLab(eventoId: string): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const { error } = await supabase
    .from("eventos_agenda")
    .delete()
    .eq("id", eventoId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao excluir compromisso do Lab: ${error.message}`);
  }

  revalidatePath("/lab/agenda");
}
