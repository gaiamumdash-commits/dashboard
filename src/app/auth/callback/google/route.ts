import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

const NOME_COOKIE_STATE = "google_login_oauth_state";
const NOME_COOKIE_NONCE = "google_login_oauth_nonce";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const stateEsperado = cookieStore.get(NOME_COOKIE_STATE)?.value;
  const rawNonce = cookieStore.get(NOME_COOKIE_NONCE)?.value;
  cookieStore.delete(NOME_COOKIE_STATE);
  cookieStore.delete(NOME_COOKIE_NONCE);

  if (!code || !state || state !== stateEsperado || !rawNonce) {
    console.error("Login com Google: state/nonce inválido ou ausente no callback.");
    return NextResponse.redirect(`${origin}/auth`);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_LOGIN_CLIENT_ID,
    process.env.GOOGLE_LOGIN_CLIENT_SECRET,
    `${origin}/auth/callback/google`,
  );

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.id_token) {
    console.error("Login com Google: Google não retornou id_token (escopo openid ausente?).");
    return NextResponse.redirect(`${origin}/auth`);
  }

  const supabase = await createClient();
  // nonce aqui é o valor CRU (o mesmo que foi hasheado em SHA-256 antes de
  // mandar pro Google em iniciarLoginGoogle) — o GoTrue hasheia de novo
  // internamente antes de comparar com o claim `nonce` do id_token.
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokens.id_token,
    nonce: rawNonce,
  });

  if (error) {
    console.error("Login com Google: signInWithIdToken falhou:", error.message);
    return NextResponse.redirect(`${origin}/auth`);
  }

  return NextResponse.redirect(`${origin}/`);
}
