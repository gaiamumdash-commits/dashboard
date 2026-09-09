import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type CodigoPatente = "explorador" | "estrategista" | "master";

export type PatenteUsuario = {
  codigo: CodigoPatente;
  conquistada_em: string;
  contexto: Record<string, unknown> | null;
};

const ORDEM_PATENTES: CodigoPatente[] = ["explorador", "estrategista", "master"];

export const ROTULO_PATENTE: Record<CodigoPatente, string> = {
  explorador: "Explorador",
  estrategista: "Estrategista",
  master: "Estrategista Master",
};

/** Concede uma patente ao usuário — idempotente (unique(user_id, codigo) no
 * banco cobre a corrida; erro 23505 = já tinha, tratado como sucesso
 * silencioso). Via service client: não existe policy de insert em
 * patentes_usuario pro usuário comum, mesmo padrão de notificacoes_app — a
 * concessão é sempre lógica server-side, nunca ação direta do usuário. */
export async function concederPatente(
  userId: string,
  codigo: CodigoPatente,
  contexto?: Record<string, unknown>,
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("patentes_usuario")
    .insert({ user_id: userId, codigo, contexto: contexto ?? null });

  if (error && error.code !== "23505") {
    throw new Error(`Falha ao conceder patente ${codigo}: ${error.message}`);
  }
}

export async function listarPatentesDoUsuario(userId: string): Promise<PatenteUsuario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patentes_usuario")
    .select("codigo, conquistada_em, contexto")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Falha ao listar patentes: ${error.message}`);
  }

  return (data as PatenteUsuario[] | null) ?? [];
}

/** A patente mais alta já conquistada, ou `null` se nenhuma ainda — usada
 * pro selo no menu lateral e pra tela de progresso. */
export function patenteMaisAlta(patentes: PatenteUsuario[]): CodigoPatente | null {
  const codigos = new Set(patentes.map((p) => p.codigo));
  for (let i = ORDEM_PATENTES.length - 1; i >= 0; i--) {
    if (codigos.has(ORDEM_PATENTES[i])) return ORDEM_PATENTES[i];
  }
  return null;
}

export { ORDEM_PATENTES };
