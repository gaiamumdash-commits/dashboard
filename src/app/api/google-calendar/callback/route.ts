import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const NOME_COOKIE_STATE = "google_calendar_oauth_state";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const stateEsperado = cookieStore.get(NOME_COOKIE_STATE)?.value;
  cookieStore.delete(NOME_COOKIE_STATE);

  if (!code || !state || state !== stateEsperado) {
    return NextResponse.redirect(`${origin}/agenda?erro=conexao`);
  }

  const user = await obterUsuarioAtual();
  if (!user) {
    return NextResponse.redirect(`${origin}/auth`);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    `${origin}/api/google-calendar/callback`,
  );

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    // Só acontece se o Google não forçar o consentimento de novo — não
    // deveria ocorrer, já que iniciarConexaoGoogleCalendar sempre pede
    // prompt: "consent". Melhor falhar visivelmente do que salvar uma
    // conexão que não vai conseguir renovar o access token.
    return NextResponse.redirect(`${origin}/agenda?erro=sem_refresh_token`);
  }
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
  const { data: perfil } = await oauth2.userinfo.get();

  const service = createServiceClient();
  const { error } = await service.from("google_calendar_conexoes").upsert(
    {
      user_id: user.id,
      google_email: perfil.email ?? "desconhecido",
      refresh_token: tokens.refresh_token,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.redirect(`${origin}/agenda?erro=salvar`);
  }

  return NextResponse.redirect(`${origin}/agenda`);
}
