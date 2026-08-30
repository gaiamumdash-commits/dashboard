import Link from "next/link";
import Image from "next/image";

export function MenuLateral({
  temMetasSmart,
  acessoCompleto = true,
}: {
  temMetasSmart: boolean;
  acessoCompleto?: boolean;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-gaiamum-border bg-gaiamum-surface px-4 py-6 sm:flex">
      <Link href="/projetos" className="mb-8 flex items-center gap-2 px-2">
        <Image src="/brand/crab-mark.png" alt="" width={32} height={32} />
        <span className="text-lg font-semibold text-gaiamum-text">Gaiamum</span>
      </Link>

      <nav className="flex flex-col gap-1">
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
          </>
        )}
      </nav>
    </aside>
  );
}
