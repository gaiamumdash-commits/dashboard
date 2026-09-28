import "server-only";
import { google, type calendar_v3 } from "googleapis";
import { headers } from "next/headers";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Helpers do Google Calendar que NÃO são Server Actions — ficam fora de
// `google-calendar.ts` ("use server") de propósito: tudo que é exportado de
// um arquivo "use server" vira um endpoint chamável pelo navegador, e estas
// funções só devem ser chamadas por outras Server Actions, no servidor.

/** Nome da propriedade privada gravada no evento do Google pra ligar o
 * espelho ao compromisso do Gaiamum (`eventos_agenda.id`) — sem coluna nova
 * no banco: o vínculo vive no próprio evento do Google. */
const PROPRIEDADE_GAIAMUM = "gaiamum_id";

/** Origem exata da request atual (protocolo + host) — precisa bater com um
 * dos redirect URIs cadastrados no Google Cloud (produção, porta 3055 de
 * teste e dev local coexistem, então não dá pra fixar uma URL só). */
export async function origemAtual(): Promise<string> {
  const listaHeaders = await headers();
  const host = listaHeaders.get("host") ?? "www.gaiamum.com.br";
  const protocolo = host.startsWith("localhost") ? "http" : "https";
  return `${protocolo}://${host}`;
}

export function montarOAuth2Client(origem: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    `${origem}/api/google-calendar/callback`,
  );
}

/** Monta um OAuth2Client autenticado com o refresh_token salvo do usuário
 * atual, ou `null` se não houver conexão. */
export async function obterClienteConectado() {
  const user = await obterUsuarioAtual();
  if (!user) return null;

  const service = createServiceClient();
  const { data: conexao } = await service
    .from("google_calendar_conexoes")
    .select("refresh_token, google_email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conexao) return null;

  const origem = await origemAtual();
  const oauth2Client = montarOAuth2Client(origem);
  oauth2Client.setCredentials({ refresh_token: conexao.refresh_token });

  return { oauth2Client, googleEmail: conexao.google_email, userId: user.id };
}

/** `invalid_grant` é o erro do Google pra token revogado ou expirado —
 * comum no modo Teste, que expira o refresh_token a cada 7 dias. Nesse
 * caso a conexão é apagada e a tela volta a pedir reconexão. */
export function eErroDeTokenInvalido(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return mensagem.includes("invalid_grant");
}

/** 403 `insufficientPermissions`: a conexão existe, mas a pessoa não marcou a
 * permissão do Calendar na tela de consentimento do Google (o Google deixa
 * desmarcar cada permissão separadamente). Não adianta tentar de novo — só
 * reconectando marcando todas as caixas. */
export function eErroDePermissaoInsuficiente(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return /insufficient (authentication scopes|permission)/i.test(mensagem);
}

/** Resultado de uma tentativa de espelhar uma mudança no Google. Nunca é
 * exceção: o Gaiamum já salvou a mudança quando isso roda, então uma falha
 * do Google vira só um aviso pra pessoa (e, em produção, o Next.js redige a
 * mensagem de qualquer `throw` de Server Action de qualquer forma). */
export type ResultadoSincronizacao =
  | { status: "sincronizado" }
  | { status: "nao_conectado" }
  | { status: "falhou"; aviso: string };

const AVISO_EXPIRADO =
  "Salvo no Gaiamum, mas sua conexão com o Google expirou — reconecte na Agenda pra sincronizar.";
const AVISO_SEM_PERMISSAO =
  "Salvo no Gaiamum, mas o Google não liberou a permissão do Calendar — desconecte e conecte de novo marcando todas as caixas.";
const AVISO_GENERICO = "Salvo no Gaiamum, mas não consegui atualizar o Google Calendar agora.";

/** Roda `operacao` com o cliente do Google já conectado e traduz qualquer
 * falha num `ResultadoSincronizacao` — token inválido também apaga a
 * conexão, igual às demais funções do Calendar. */
async function comGoogle(
  operacao: (calendar: calendar_v3.Calendar) => Promise<void>,
): Promise<ResultadoSincronizacao> {
  const conexao = await obterClienteConectado();
  if (!conexao) return { status: "nao_conectado" };

  const calendar = google.calendar({ version: "v3", auth: conexao.oauth2Client });

  try {
    await operacao(calendar);
    return { status: "sincronizado" };
  } catch (erro) {
    if (eErroDeTokenInvalido(erro)) {
      const service = createServiceClient();
      await service.from("google_calendar_conexoes").delete().eq("user_id", conexao.userId);
      return { status: "falhou", aviso: AVISO_EXPIRADO };
    }
    if (eErroDePermissaoInsuficiente(erro)) {
      const service = createServiceClient();
      await service.from("google_calendar_conexoes").delete().eq("user_id", conexao.userId);
      return { status: "falhou", aviso: AVISO_SEM_PERMISSAO };
    }
    console.error("Falha ao sincronizar com o Google Calendar:", erro);
    return { status: "falhou", aviso: AVISO_GENERICO };
  }
}

function eErroNaoEncontrado(erro: unknown): boolean {
  const codigo = (erro as { code?: number | string })?.code;
  return codigo === 404 || codigo === 410 || codigo === "404" || codigo === "410";
}

async function acharEspelho(calendar: calendar_v3.Calendar, compromissoId: string): Promise<string | null> {
  const { data } = await calendar.events.list({
    calendarId: "primary",
    privateExtendedProperty: [`${PROPRIEDADE_GAIAMUM}=${compromissoId}`],
    maxResults: 1,
    showDeleted: false,
  });
  return data.items?.[0]?.id ?? null;
}

export type DadosCompromisso = {
  compromissoId: string;
  titulo: string;
  inicio: Date;
  fim: Date | null;
  /** Alarme do Gaiamum (minutos antes), espelhado como lembrete pop-up no
   * Google — assim o aviso também toca no app do Google Calendar do
   * celular. `null`/0 mantém o lembrete padrão do calendário. */
  antecedenciaMin: number | null;
};

/** Cria (ou atualiza, se já existir) a cópia de um compromisso do Gaiamum
 * no Google Calendar da pessoa. Serve pra criação e pra edição: compromissos
 * criados antes da integração ganham a cópia na primeira edição. */
export async function espelharCompromissoNoGoogle(dados: DadosCompromisso): Promise<ResultadoSincronizacao> {
  return comGoogle(async (calendar) => {
    // Google exige um fim — compromisso sem hora de término vira 1h.
    const fim = dados.fim ?? new Date(dados.inicio.getTime() + 60 * 60_000);
    const corpo: calendar_v3.Schema$Event = {
      summary: dados.titulo,
      start: { dateTime: dados.inicio.toISOString() },
      end: { dateTime: fim.toISOString() },
      extendedProperties: { private: { [PROPRIEDADE_GAIAMUM]: dados.compromissoId } },
      // Máximo aceito pelo Google: 4 semanas.
      reminders: dados.antecedenciaMin
        ? { useDefault: false, overrides: [{ method: "popup", minutes: Math.min(dados.antecedenciaMin, 40320) }] }
        : { useDefault: true },
    };

    const googleId = await acharEspelho(calendar, dados.compromissoId);
    if (googleId) {
      await calendar.events.patch({ calendarId: "primary", eventId: googleId, requestBody: corpo });
    } else {
      await calendar.events.insert({ calendarId: "primary", requestBody: corpo });
    }
  });
}

/** Apaga a cópia de um compromisso do Gaiamum no Google (se existir). */
export async function removerEspelhoDoGoogle(compromissoId: string): Promise<ResultadoSincronizacao> {
  return comGoogle(async (calendar) => {
    const googleId = await acharEspelho(calendar, compromissoId);
    if (!googleId) return;
    try {
      await calendar.events.delete({ calendarId: "primary", eventId: googleId });
    } catch (erro) {
      if (!eErroNaoEncontrado(erro)) throw erro;
    }
  });
}

/** Edita título/horário de um evento que nasceu no próprio Google. */
export async function editarEventoDoGoogle(dados: {
  googleEventId: string;
  titulo: string;
  inicio: Date;
  fim: Date;
}): Promise<ResultadoSincronizacao> {
  return comGoogle(async (calendar) => {
    await calendar.events.patch({
      calendarId: "primary",
      eventId: dados.googleEventId,
      requestBody: {
        summary: dados.titulo,
        start: { dateTime: dados.inicio.toISOString() },
        end: { dateTime: dados.fim.toISOString() },
      },
    });
  });
}

/** Apaga um evento que nasceu no próprio Google. */
export async function excluirEventoDoGoogle(googleEventId: string): Promise<ResultadoSincronizacao> {
  return comGoogle(async (calendar) => {
    try {
      await calendar.events.delete({ calendarId: "primary", eventId: googleEventId });
    } catch (erro) {
      if (!eErroNaoEncontrado(erro)) throw erro;
    }
  });
}

export { PROPRIEDADE_GAIAMUM };
