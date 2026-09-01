"use server";

import "server-only";
import { createHash } from "node:crypto";
import { google } from "googleapis";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// openid+email+profile: só o suficiente pra identificar quem está logando
// (nome, e-mail, avatar) — não pede nada além disso. Client dedicado ao
// login, em projeto Google Cloud separado do Calendar, pra poder publicar
// (remover o limite de 100 testadores) sem arrastar o escopo mais sensível
// do Calendar (calendar.events) pra fora do modo Teste junto.
const ESCOPOS = ["openid", "email", "profile"];
const NOME_COOKIE_STATE = "google_login_oauth_state";
const NOME_COOKIE_NONCE = "google_login_oauth_nonce";

/** Origem exata da request atual — precisa bater com um dos redirect URIs
 * cadastrados no Google Cloud (produção, porta 3055 de teste e dev local
 * coexistem, então não dá pra fixar uma URL só). Mesmo cálculo usado em
 * google-calendar.ts — não há um helper compartilhado pra isso no projeto. */
async function origemAtual(): Promise<string> {
  const listaHeaders = await headers();
  const host = listaHeaders.get("host") ?? "www.gaiamum.com.br";
  const protocolo = host.startsWith("localhost") ? "http" : "https";
  return `${protocolo}://${host}`;
}

/** Inicia o login: gera a URL de consentimento do Google e redireciona.
 * O GoTrue (auth do Supabase) hasheia em SHA-256 o `nonce` recebido em
 * signInWithIdToken antes de comparar com o claim `nonce` do id_token — por
 * isso é o HASH que vai pro Google aqui, e o valor cru fica só no cookie
 * pra ser reenviado (cru) no callback. Mandar o mesmo valor cru nos dois
 * lados quebra o login com "nonce mismatch". */
export async function iniciarLoginGoogle() {
  const origem = await origemAtual();
  const state = crypto.randomUUID();
  const rawNonce = crypto.randomUUID();
  const hashedNonce = createHash("sha256").update(rawNonce).digest("hex");

  const cookieStore = await cookies();
  const opcoesCookie = {
    httpOnly: true,
    secure: origem.startsWith("https"),
    maxAge: 600,
    path: "/",
  } as const;
  cookieStore.set(NOME_COOKIE_STATE, state, opcoesCookie);
  cookieStore.set(NOME_COOKIE_NONCE, rawNonce, opcoesCookie);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_LOGIN_CLIENT_ID,
    process.env.GOOGLE_LOGIN_CLIENT_SECRET,
    `${origem}/auth/callback/google`,
  );

  const url = oauth2Client.generateAuthUrl({
    scope: ESCOPOS,
    state,
    nonce: hashedNonce,
    prompt: "select_account",
  });

  redirect(url);
}
