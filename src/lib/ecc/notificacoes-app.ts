"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import type { NotificacaoApp } from "@/lib/ecc/tipos";

const LIMITE_NOTIFICACOES_RECENTES = 20;

export async function listarNotificacoesRecentes(): Promise<NotificacaoApp[]> {
  const user = await obterUsuarioAtual();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("notificacoes_app")
    .select("*")
    .eq("user_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(LIMITE_NOTIFICACOES_RECENTES);

  return (data as NotificacaoApp[] | null) ?? [];
}

export async function contarNaoLidas(): Promise<number> {
  const user = await obterUsuarioAtual();
  if (!user) return 0;

  const supabase = await createClient();
  const { count } = await supabase
    .from("notificacoes_app")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("lida", false);

  return count ?? 0;
}

export async function marcarComoLida(notificacaoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes_app")
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq("id", notificacaoId);

  if (error) {
    throw new Error(`Falha ao marcar notificação como lida: ${error.message}`);
  }
  revalidatePath("/", "layout");
}

export async function marcarTodasComoLidas() {
  const user = await obterUsuarioAtual();
  if (!user) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes_app")
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("lida", false);

  if (error) {
    throw new Error(`Falha ao marcar notificações como lidas: ${error.message}`);
  }
  revalidatePath("/", "layout");
}
