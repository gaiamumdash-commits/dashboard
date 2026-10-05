/**
 * Convite pra instalar o Gaiamum como app (PWA) — pedido do Fabio,
 * 2026-10-05: app de uso diário tem que abrir com 1 clique no ícone, no
 * celular E no computador, sem abrir navegador/digitar endereço/logar.
 *
 * Lógica pura (sem `window`), testável isolada. Quem lê o navegador de
 * verdade é `components/instalar-app/instalacao-app.ts`.
 */

/** Como ESTE navegador/aparelho instala o app:
 * - `instalado`: já está rodando como app (ou acabou de ser instalado).
 * - `um-clique`: Chrome/Edge/Android ofereceram o prompt nativo — o botão
 *   abre a instalação direto.
 * - `chromium-manual`: Chrome/Edge sem o prompt disponível agora (ex.: a
 *   pessoa já recusou uma vez) — dá pra instalar pelo menu do navegador.
 * - `ios`: iPhone/iPad — Apple não deixa site abrir instalação; só pelo
 *   botão Compartilhar.
 * - `safari-mac`: Safari no Mac — Arquivo → Adicionar ao Dock.
 * - `sem-suporte`: navegador que não instala apps (ex.: Firefox no PC). */
export type FormaInstalacao = "instalado" | "um-clique" | "chromium-manual" | "ios" | "safari-mac" | "sem-suporte";

export function detectarFormaInstalacao(info: {
  userAgent: string;
  maxTouchPoints: number;
  emModoApp: boolean;
  temPromptNativo: boolean;
}): FormaInstalacao {
  if (info.emModoApp) return "instalado";
  if (info.temPromptNativo) return "um-clique";

  const ua = info.userAgent;
  // iPadOS se apresenta como "Macintosh"; a diferença é a tela de toque.
  const ehIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && info.maxTouchPoints > 1);
  if (ehIOS) return "ios";

  const ehChromium = /Chrome|Chromium|CriOS|Edg\/|OPR\/|SamsungBrowser/.test(ua);
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !ehChromium && !/Firefox/.test(ua)) return "safari-mac";
  if (ehChromium || /Android/.test(ua)) return "chromium-manual";
  return "sem-suporte";
}

/** Passo a passo mostrado quando não dá pra instalar com 1 clique. */
export function instrucoesInstalacao(forma: FormaInstalacao): string[] {
  switch (forma) {
    case "ios":
      return ["Toque no botão Compartilhar (o quadrado com a seta pra cima).", "Escolha “Adicionar à Tela de Início” e confirme."];
    case "safari-mac":
      return ["No menu do Safari, clique em Arquivo.", "Escolha “Adicionar ao Dock”."];
    case "chromium-manual":
      return [
        "No computador: clique no ícone de instalar na barra de endereço (um monitor com uma seta), à direita.",
        "Se não aparecer, abra o menu ⋮ do navegador e procure “Instalar Gaiamum” (no Edge: Aplicativos → Instalar este site como aplicativo). No celular: menu ⋮ → “Adicionar à tela inicial”.",
      ];
    case "sem-suporte":
      return ["Este navegador não instala apps. Abra gaiamum.com.br no Chrome ou no Edge e instale por lá."];
    default:
      return [];
  }
}

export const EVENTO_INSTALACAO_MUDOU = "gaiamum:instalacao-mudou";

/** Script inline do <head> (layout raiz): guarda o prompt nativo e cancela
 * a barrinha automática do navegador — quem oferece a instalação é o nosso
 * convite — e marca quando o app acabou de ser instalado nesta aba. Fica
 * aqui (e não no módulo "use client") porque o layout é Server Component e
 * precisa do TEXTO do script, não de uma referência de cliente. */
export const SCRIPT_CAPTURA_INSTALACAO = `
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__gaiamumPromptInstalacao = e;
  window.dispatchEvent(new Event("${EVENTO_INSTALACAO_MUDOU}"));
});
window.addEventListener("appinstalled", function () {
  window.__gaiamumPromptInstalacao = null;
  window.__gaiamumAppInstalado = true;
  window.dispatchEvent(new Event("${EVENTO_INSTALACAO_MUDOU}"));
});
`;

export const CHAVE_CONVITE_DISPENSADO = "gaiamum-convite-instalar-dispensado-em";
export const DIAS_SEM_INSISTIR = 7;

/** "Agora não" esconde o convite por alguns dias — sem insistir todo dia,
 * mas também sem sumir pra sempre pra quem só estava sem tempo. */
export function conviteDispensadoRecentemente(dispensadoEmISO: string | null, agoraMs: number, dias = DIAS_SEM_INSISTIR): boolean {
  if (!dispensadoEmISO) return false;
  const dispensadoEm = new Date(dispensadoEmISO).getTime();
  if (Number.isNaN(dispensadoEm)) return false;
  return agoraMs - dispensadoEm < dias * 24 * 60 * 60 * 1000;
}
