"use server";

import "server-only";
import { google } from "googleapis";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  PROPRIEDADE_GAIAMUM,
  editarEventoDoGoogle,
  eErroDeTokenInvalido,
  excluirEventoDoGoogle,
  montarOAuth2Client,
  obterClienteConectado,
  origemAtual,
  type ResultadoSincronizacao,
} from "@/lib/ecc/google-calendar-interno";
import { paraUtcDoFuso } from "@/lib/ecc/kanban";
import type { EventoGoogleCalendar, ResultadoAgenda } from "@/lib/ecc/tipos";

// calendar.events: restrito a eventos (ver + criar/editar/excluir em todos
// os calendários) — não pede acesso a gerenciar calendários/ACLs/
// configurações, que o Gaiamum não usa. userinfo.email: só pra mostrar qual
// conta Google está conectada na tela — escopo não sensível, não exige nada
// especial de verificação. Os dois precisam estar marcados na tela "Acesso
// a dados" do Google Auth Platform.
const ESCOPOS = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];
const NOME_COOKIE_STATE = "google_calendar_oauth_state";

/** Inicia a conexão: gera a URL de consentimento do Google e redireciona.
 * `prompt: "consent"` força o Google a sempre reemitir um refresh_token,
 * mesmo se a pessoa já tiver autorizado antes. */
export async function iniciarConexaoGoogleCalendar() {
  const origem = await origemAtual();
  const oauth2Client = montarOAuth2Client(origem);
  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set(NOME_COOKIE_STATE, state, {
    httpOnly: true,
    secure: origem.startsWith("https"),
    maxAge: 600,
    path: "/",
  });

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ESCOPOS,
    state,
  });

  redirect(url);
}

export async function desconectarGoogleCalendar() {
  const user = await obterUsuarioAtual();
  if (!user) return;

  const service = createServiceClient();
  const { data: conexao } = await service
    .from("google_calendar_conexoes")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (conexao?.refresh_token) {
    // Revogação é best-effort — se falhar (token já inválido, rede etc.),
    // a linha é apagada de qualquer forma e a conexão já para de funcionar.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${conexao.refresh_token}`, {
      method: "POST",
    }).catch(() => {});
  }

  await service.from("google_calendar_conexoes").delete().eq("user_id", user.id);
  revalidatePath("/agenda");
}

export async function listarEventosGoogleCalendar(inicio: Date, fimExclusivo: Date): Promise<ResultadoAgenda> {
  const conexao = await obterClienteConectado();
  if (!conexao) return { status: "nao_conectado" };

  const calendar = google.calendar({ version: "v3", auth: conexao.oauth2Client });

  try {
    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin: inicio.toISOString(),
      timeMax: fimExclusivo.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      // Era limite de "próximos eventos" (20); agora é teto por semana, não
      // corte de lista — folga generosa pra não truncar semana cheia.
      maxResults: 250,
    });

    const eventos: EventoGoogleCalendar[] = (data.items ?? []).map((evento) => ({
      id: evento.id ?? "",
      titulo: evento.summary ?? "(sem título)",
      inicio: evento.start?.dateTime ?? evento.start?.date ?? "",
      fim: evento.end?.dateTime ?? evento.end?.date ?? "",
      link: evento.htmlLink ?? null,
      // Presente só nas cópias de compromissos do Gaiamum — a Agenda usa
      // pra não mostrar o mesmo compromisso duas vezes.
      gaiamumId: evento.extendedProperties?.private?.[PROPRIEDADE_GAIAMUM] ?? null,
    }));

    return { status: "conectado", googleEmail: conexao.googleEmail, eventos };
  } catch (erro) {
    if (eErroDeTokenInvalido(erro)) {
      const service = createServiceClient();
      await service.from("google_calendar_conexoes").delete().eq("user_id", conexao.userId);
      return { status: "expirado" };
    }
    throw erro;
  }
}

export async function criarEventoGoogleCalendar(formData: FormData) {
  const conexao = await obterClienteConectado();
  if (!conexao) {
    throw new Error("Conecte sua conta do Google antes de criar um evento.");
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const inicio = String(formData.get("inicio") ?? "");
  const fim = String(formData.get("fim") ?? "");
  const fuso = String(formData.get("fuso") ?? "UTC");

  if (!titulo || !inicio || !fim) {
    throw new Error("Preencha título, início e fim do evento.");
  }

  // <input type="datetime-local"> não inclui segundos ("2026-09-02T14:00")
  // — a API do Google espera RFC3339 completo, então completa com ":00".
  const comSegundos = (valor: string) => (valor.length === 16 ? `${valor}:00` : valor);
  const inicioCompleto = comSegundos(inicio);
  const fimCompleto = comSegundos(fim);

  // <input type="datetime-local"> devolve hora local sem fuso ("2026-09-02T14:00").
  // Essa Server Action roda no servidor (UTC), não no navegador de quem
  // preenche — diferente de um Client Component, `new Date(inicio)` aqui
  // interpretaria a string no fuso do SERVIDOR, não do usuário. Por isso
  // manda a string tal como veio + o fuso horário do navegador (campo
  // "fuso" do form) direto pro Google, que sabe converter — evita
  // qualquer conversão de fuso do nosso lado.
  const calendar = google.calendar({ version: "v3", auth: conexao.oauth2Client });

  try {
    await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: titulo,
        start: { dateTime: inicioCompleto, timeZone: fuso },
        end: { dateTime: fimCompleto, timeZone: fuso },
      },
    });
  } catch (erro) {
    if (eErroDeTokenInvalido(erro)) {
      const service = createServiceClient();
      await service.from("google_calendar_conexoes").delete().eq("user_id", conexao.userId);
      throw new Error("Sua conexão com o Google expirou — reconecte e tente de novo.");
    }
    throw erro;
  }

  revalidatePath("/agenda");
}

/** Edita título e horário de um evento que nasceu no Google (compromissos
 * criados pelo Gaiamum são editados por `editarEventoAgenda`, que já cuida da
 * cópia no Google). Devolve o resultado em vez de lançar erro: em produção o
 * Next.js redige a mensagem de qualquer `throw` de Server Action. */
export async function editarEventoGoogleCalendar(
  formData: FormData,
): Promise<ResultadoSincronizacao | { status: "invalido"; aviso: string }> {
  const googleEventId = String(formData.get("google_event_id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const inicio = String(formData.get("inicio") ?? "");
  const fim = String(formData.get("fim") ?? "");
  const fuso = String(formData.get("fuso") ?? "America/Sao_Paulo");

  if (!googleEventId || !titulo || !inicio || !fim) {
    return { status: "invalido", aviso: "Preencha título, início e fim do evento." };
  }

  const inicioUtc = paraUtcDoFuso(inicio, fuso);
  const fimUtc = paraUtcDoFuso(fim, fuso);
  if (fimUtc <= inicioUtc) {
    return { status: "invalido", aviso: "O fim precisa ser depois do início." };
  }

  const resultado = await editarEventoDoGoogle({ googleEventId, titulo, inicio: inicioUtc, fim: fimUtc });
  revalidatePath("/agenda");
  return resultado;
}

export async function excluirEventoGoogleCalendar(googleEventId: string): Promise<ResultadoSincronizacao> {
  const resultado = await excluirEventoDoGoogle(googleEventId);
  revalidatePath("/agenda");
  return resultado;
}
