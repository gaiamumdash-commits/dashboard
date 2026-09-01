import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { contarNaoLidas } from "@/lib/ecc/notificacoes-app";
import { SinoNotificacoes } from "@/components/layout/sino-notificacoes";

/** Busca a contagem de não lidas separada num componente próprio, dentro de
 * `<Suspense>` — sem isso, `MenuLateral` (renderizado em toda página do
 * sistema) precisaria ser `async` e sua consulta rodaria DEPOIS de todas as
 * consultas da própria página (mais uma viagem de rede sequencial somada em
 * todo lugar). Com Suspense, o resto da página não espera o sino: o shell
 * inteiro renderiza na hora e só o número do sino aparece um instante depois. */
async function SinoComContagem() {
  const naoLidas = await contarNaoLidas();
  return <SinoNotificacoes naoLidasIniciais={naoLidas} />;
}

export function MenuLateral({
  temMetasSmart,
  acessoCompleto = true,
  souOwner = false,
}: {
  temMetasSmart: boolean;
  acessoCompleto?: boolean;
  souOwner?: boolean;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-gaiamum-border bg-gaiamum-surface px-4 py-6 sm:flex">
      <div className="mb-8 flex items-center justify-between px-2">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/crab-mark.png" alt="" width={32} height={32} />
          <span className="text-lg font-semibold text-gaiamum-text">Gaiamum</span>
        </Link>
        <Suspense fallback={<SinoNotificacoes naoLidasIniciais={0} />}>
          <SinoComContagem />
        </Suspense>
      </div>

      <nav className="flex flex-col gap-1">
        {acessoCompleto && (
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
          >
            Início
          </Link>
        )}
        <Link
          href="/projetos"
          className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
        >
          Projetos
        </Link>
        {acessoCompleto && (
          <>
            <Link
              href="/onboarding"
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
            >
              Metas SMART
              {!temMetasSmart && (
                <span className="rounded-full bg-gaiamum-primary px-2 py-0.5 text-xs font-semibold text-white">
                  Pendente
                </span>
              )}
            </Link>
            <Link
              href="/equipe"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
            >
              Equipe
            </Link>
            <Link
              href="/agenda"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
            >
              Agenda
            </Link>
          </>
        )}
        {souOwner && (
          <>
            <Link
              href="/marketing"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
            >
              Marketing
            </Link>
            <Link
              href="/financeiro"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
            >
              Financeiro
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}
