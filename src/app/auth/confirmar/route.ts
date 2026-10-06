import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino dos links dos e-mails de autenticação (redefinir senha, confirmar
 * cadastro) — templates em `supabase/templates/`.
 *
 * Achado real (2026-10-06, redefinindo a senha da Angeline): o link padrão
 * do Supabase usa o fluxo PKCE, que só funciona no MESMO navegador que pediu
 * o e-mail (o "code verifier" fica num cookie dele). Aberto em outro
 * aparelho/navegador — ou no navegador embutido do app de e-mail — não
 * criava sessão e a tela de nova senha dava "Auth session missing!".
 * Aqui o servidor valida o `token_hash` do próprio e-mail (`verifyOtp`), que
 * não depende de nada guardado no navegador, e grava a sessão em cookie.
 */
const TIPOS_ACEITOS: EmailOtpType[] = ["recovery", "email", "signup", "invite", "email_change"];

/** Só caminhos internos (evita usar o link pra mandar a pessoa pra outro site). */
function destinoSeguro(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const destino = destinoSeguro(searchParams.get("next"));

  if (tokenHash && tipo && TIPOS_ACEITOS.includes(tipo)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  // Link expirado, já usado ou adulterado — a tela de login explica o que fazer.
  return NextResponse.redirect(`${origin}/auth?aviso=link-invalido`);
}
