import "server-only";
import { obterUsuarioAtual } from "@/lib/supabase/server";

/** Gate por e-mail fixo, restrito à conta pessoal do dono do SaaS — não tem
 * relação com `papel === "owner"` (que é "dono deste tenant/workspace",
 * concedido a qualquer cliente). Sem fallback hardcoded: `EMAIL_DONO_SAAS`
 * só existe configurado no ambiente (Vercel/.env.local), mesmo espírito de
 * `CRON_SECRET`. */
export async function souDonoDoSaas(): Promise<boolean> {
  const emailDono = process.env.EMAIL_DONO_SAAS;
  if (!emailDono) return false;
  const user = await obterUsuarioAtual();
  return user?.email?.toLowerCase() === emailDono.toLowerCase();
}
