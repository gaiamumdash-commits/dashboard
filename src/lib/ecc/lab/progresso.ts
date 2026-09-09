import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type PassoLab = "explorar_quadro" | "concluir";

const MODULO_NUCLEO = "nucleo";

export async function passosConcluidos(userId: string): Promise<Set<PassoLab>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lab_passos")
    .select("passo")
    .eq("user_id", userId)
    .eq("modulo", MODULO_NUCLEO);

  if (error) {
    throw new Error(`Falha ao ler progresso do Lab: ${error.message}`);
  }

  return new Set((data ?? []).map((linha) => linha.passo as PassoLab));
}

/** Grava um passo do roteiro como concluído — idempotente (unique constraint
 * cobre reexecução, erro 23505 tratado como sucesso silencioso). Via
 * service client: sem policy de insert pro usuário comum, mesmo padrão do
 * resto do módulo do Lab. */
export async function marcarPassoConcluido(userId: string, passo: PassoLab): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("lab_passos")
    .insert({ user_id: userId, modulo: MODULO_NUCLEO, passo });

  if (error && error.code !== "23505") {
    throw new Error(`Falha ao registrar passo do Lab: ${error.message}`);
  }
}

/** Usado pelo "refazer o case" — reseta só o roteiro do módulo núcleo, nunca
 * as patentes já conquistadas (patentes_usuario não é tocado aqui). */
export async function resetarPassosDoModulo(userId: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("lab_passos")
    .delete()
    .eq("user_id", userId)
    .eq("modulo", MODULO_NUCLEO);

  if (error) {
    throw new Error(`Falha ao resetar progresso do Lab: ${error.message}`);
  }
}
