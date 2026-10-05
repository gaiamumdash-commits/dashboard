"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { LinksNavegacao } from "@/components/layout/links-navegacao";
import { BotaoSair } from "@/components/layout/botao-sair";
import { BotaoInstalarAppMenu } from "@/components/instalar-app/convite-instalar-app";
import { SeletorTema } from "@/components/theme-toggle";

/** Cabeçalho + painel visíveis abaixo de `sm` (640px) OU em qualquer
 * dispositivo de toque (`pointer: coarse`) — espelha exatamente o critério
 * do `<aside>` de MenuLateral (achado real, 2026-10-01: celular DEITADO
 * passa de 640px de largura, então só olhar a largura mostraria os dois
 * menus — o de desktop E este — ou nenhum dos dois, dependendo de qual
 * breakpoint ganhasse). Tudo dentro de um único wrapper: se o painel estiver
 * aberto e a viewport crescer pra desktop real (resize/rotação de device),
 * `display:none` no ancestral remove a subárvore inteira, inclusive o
 * overlay `fixed`, sem precisar de listener de resize.
 *
 * Painel cai pra baixo, largura cheia — não é uma gaveta lateral. A lista de
 * links já é vertical por natureza, então um painel de largura cheia logo
 * abaixo do cabeçalho é mais natural que uma gaveta estreita numa tela
 * também vertical. */
export function MenuMobile({
  temMetasSmart,
  acessoCompleto = true,
  souOwner = false,
  sino,
  linkLab,
  linkExtra,
  emailConta,
}: {
  temMetasSmart: boolean;
  acessoCompleto?: boolean;
  souOwner?: boolean;
  sino: ReactNode;
  linkLab?: ReactNode;
  linkExtra?: ReactNode;
  emailConta?: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="hidden max-[639px]:block [@media(pointer:coarse)]:block">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gaiamum-border bg-gaiamum-surface px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/crab-mark.png" alt="" width={28} height={28} />
          <span className="text-base font-semibold text-gaiamum-text">Gaiamum</span>
        </Link>
        <div className="flex items-center gap-1">
          {sino}
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={aberto}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
          >
            {aberto ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {aberto && (
        <div className="fixed inset-0 z-20 bg-black/50" onClick={() => setAberto(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 top-14 flex max-h-[calc(100vh-3.5rem)] flex-col gap-1 overflow-y-auto border-b border-gaiamum-border bg-gaiamum-surface px-4 py-4 shadow-lg"
          >
            <LinksNavegacao
              temMetasSmart={temMetasSmart}
              acessoCompleto={acessoCompleto}
              souOwner={souOwner}
              aoClicarLink={() => setAberto(false)}
              linkLab={linkLab}
              extra={linkExtra}
            />
            <div className="mt-2 flex flex-col gap-2 border-t border-gaiamum-border pt-3">
              <BotaoInstalarAppMenu />
              {emailConta}
              <div className="flex items-center justify-between">
                <SeletorTema />
                <BotaoSair />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
