"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { instrucoesInstalacao, type FormaInstalacao } from "@/lib/instalar-app";
import { abrirInstalacaoNativa, dispensarConvite, useConviteDispensado, useFormaInstalacao } from "@/components/instalar-app/instalacao-app";

function PassoAPasso({ forma }: { forma: FormaInstalacao }) {
  const passos = instrucoesInstalacao(forma);
  if (passos.length === 0) return null;
  return (
    <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm text-gaiamum-text">
      {passos.map((passo) => (
        <li key={passo}>{passo}</li>
      ))}
    </ol>
  );
}

async function instalarComUmClique() {
  try {
    const aceitou = await abrirInstalacaoNativa();
    if (aceitou) toast.success("Gaiamum instalado! Agora é só abrir pelo ícone.");
  } catch {
    toast.error("O navegador não abriu a instalação. Tente pelo ícone de instalar na barra de endereço.");
  }
}

/** Card do Painel geral (1ª tela depois do cadastro) — some sozinho quando o
 * app já está instalado neste aparelho, e "Agora não" esconde por 7 dias. */
export function ConviteInstalarApp() {
  const forma = useFormaInstalacao();
  const dispensado = useConviteDispensado();
  const [mostrandoPassos, setMostrandoPassos] = useState(false);

  if (!forma || forma === "instalado" || dispensado) return null;

  return (
    <section className="rounded-2xl border border-gaiamum-primary/40 bg-gaiamum-surface p-5">
      <div className="flex items-start gap-4">
        <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-gaiamum-text">Tenha o Gaiamum a um clique</h2>
          <p className="mt-1 text-sm text-gaiamum-text-muted">
            Instale o app neste aparelho: ele abre direto pelo ícone, em janela própria e já com você conectado — sem abrir
            navegador nem digitar endereço.
          </p>

          {(mostrandoPassos || (forma !== "um-clique" && forma !== "chromium-manual")) && <PassoAPasso forma={forma} />}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {forma === "um-clique" && (
              <button
                type="button"
                onClick={instalarComUmClique}
                className="rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-gaiamum-primary-dark"
              >
                Instalar o app
              </button>
            )}
            {forma === "chromium-manual" && !mostrandoPassos && (
              <button
                type="button"
                onClick={() => setMostrandoPassos(true)}
                className="rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-gaiamum-primary-dark"
              >
                Como instalar
              </button>
            )}
            <button type="button" onClick={dispensarConvite} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
              Agora não
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Item fixo do menu (desktop e celular) — pra quem pulou o convite ou quer
 * instalar em outro aparelho. Não aparece quando já está rodando como app. */
export function BotaoInstalarAppMenu() {
  const forma = useFormaInstalacao();
  const [aberto, setAberto] = useState(false);

  if (!forma || forma === "instalado") return null;

  return (
    <div className="px-1">
      <button
        type="button"
        onClick={() => (forma === "um-clique" ? instalarComUmClique() : setAberto((a) => !a))}
        className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
      >
        📲 Instalar o app
      </button>
      {aberto && (
        <div className="mx-3 mb-2 rounded-lg bg-gaiamum-surface-raised p-3">
          <PassoAPasso forma={forma} />
        </div>
      )}
    </div>
  );
}
