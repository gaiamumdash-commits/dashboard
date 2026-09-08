import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/** Notifica in-app a pessoa afetada por uma mudança de equipe (promovido a
 * coordenador, removido de quadro/workspace) — quem age já vê o resultado na
 * tela na hora, isso aqui é pra quem NÃO agiu saber depois. Usa service
 * client porque a pessoa afetada não é o usuário da sessão atual (não há
 * policy de insert em `notificacoes_app` pra usuário comum, só leitura da
 * própria linha). Convite não passa por aqui: quem ainda não tem conta não
 * tem pra onde mandar notificação in-app. */
export async function notificarEquipe({
  tenantId,
  userId,
  titulo,
  corpo,
  link,
}: {
  tenantId: string;
  userId: string;
  titulo: string;
  corpo?: string | null;
  link?: string | null;
}) {
  const service = createServiceClient();
  const { error } = await service.from("notificacoes_app").insert({
    tenant_id: tenantId,
    user_id: userId,
    titulo,
    corpo: corpo ?? null,
    link: link ?? null,
    tipo: "equipe",
  });

  if (error) {
    console.error(`Falha ao criar notificação de equipe pra ${userId}:`, error);
  }
}
