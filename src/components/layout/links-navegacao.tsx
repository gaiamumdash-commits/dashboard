import Link from "next/link";

/** Sem "use client" nem "use server": roda no servidor quando importado por
 * MenuLateral (aside desktop), e entra no bundle do cliente quando importado
 * por MenuMobile (drawer) — evita duplicar a lista de links em 2 arquivos. */
export function LinksNavegacao({
  temMetasSmart,
  acessoCompleto = true,
  souOwner = false,
  aoClicarLink,
}: {
  temMetasSmart: boolean;
  acessoCompleto?: boolean;
  souOwner?: boolean;
  /** Fecha o drawer mobile ao navegar; undefined no desktop (sem drawer). */
  aoClicarLink?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {acessoCompleto && (
        <Link
          href="/"
          onClick={aoClicarLink}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
        >
          Início
        </Link>
      )}
      <Link
        href="/projetos"
        onClick={aoClicarLink}
        className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
      >
        Projetos
      </Link>
      {acessoCompleto && (
        <>
          <Link
            href="/onboarding"
            onClick={aoClicarLink}
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
            onClick={aoClicarLink}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
          >
            Equipe
          </Link>
          <Link
            href="/agenda"
            onClick={aoClicarLink}
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
            onClick={aoClicarLink}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
          >
            Marketing
          </Link>
          <Link
            href="/financeiro"
            onClick={aoClicarLink}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
          >
            Financeiro
          </Link>
        </>
      )}
    </nav>
  );
}
