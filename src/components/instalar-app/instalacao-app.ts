"use client";

import { useSyncExternalStore } from "react";
import {
  CHAVE_CONVITE_DISPENSADO,
  conviteDispensadoRecentemente,
  detectarFormaInstalacao,
  EVENTO_INSTALACAO_MUDOU as EVENTO_MUDOU,
  type FormaInstalacao,
} from "@/lib/instalar-app";

/** Evento `beforeinstallprompt` (Chrome/Edge/Android) — não está nos tipos
 * padrão do DOM. Capturado cedo por `SCRIPT_CAPTURA_INSTALACAO`
 * (`lib/instalar-app.ts`, no <head> do layout), porque ele pode disparar
 * antes do React hidratar. */
type PromptInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __gaiamumPromptInstalacao?: PromptInstalacao | null;
    __gaiamumAppInstalado?: boolean;
  }
}


function assinar(aoMudar: () => void): () => void {
  const modoApp = window.matchMedia("(display-mode: standalone)");
  window.addEventListener(EVENTO_MUDOU, aoMudar);
  window.addEventListener("storage", aoMudar);
  modoApp.addEventListener("change", aoMudar);
  return () => {
    window.removeEventListener(EVENTO_MUDOU, aoMudar);
    window.removeEventListener("storage", aoMudar);
    modoApp.removeEventListener("change", aoMudar);
  };
}

function lerForma(): FormaInstalacao {
  const standaloneIOS = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectarFormaInstalacao({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    emModoApp: window.matchMedia("(display-mode: standalone)").matches || standaloneIOS || window.__gaiamumAppInstalado === true,
    temPromptNativo: Boolean(window.__gaiamumPromptInstalacao),
  });
}

/** `null` no servidor e durante a hidratação (não dá pra saber o aparelho
 * lá) — quem usa renderiza nada até virar uma forma de verdade. */
export function useFormaInstalacao(): FormaInstalacao | null {
  return useSyncExternalStore(assinar, lerForma, () => null);
}

function lerDispensado(): boolean {
  try {
    return conviteDispensadoRecentemente(localStorage.getItem(CHAVE_CONVITE_DISPENSADO), Date.now());
  } catch {
    return false;
  }
}

/** Se a pessoa clicou "Agora não" há menos de 7 dias (por aparelho —
 * instalar é uma decisão de cada computador/celular, não da conta). */
export function useConviteDispensado(): boolean {
  return useSyncExternalStore(assinar, lerDispensado, () => true);
}

export function dispensarConvite(): void {
  try {
    localStorage.setItem(CHAVE_CONVITE_DISPENSADO, new Date().toISOString());
  } catch {
    // navegador sem storage (aba privada) — o convite só volta na próxima visita
  }
  window.dispatchEvent(new Event(EVENTO_MUDOU));
}

/** Abre a instalação nativa (1 clique). O prompt só pode ser usado uma vez;
 * depois disso a forma cai pra `chromium-manual` (ou `instalado`). */
export async function abrirInstalacaoNativa(): Promise<boolean> {
  const prompt = window.__gaiamumPromptInstalacao;
  if (!prompt) return false;
  window.__gaiamumPromptInstalacao = null;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  window.dispatchEvent(new Event(EVENTO_MUDOU));
  return outcome === "accepted";
}
