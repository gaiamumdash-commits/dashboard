import type { ReactNode } from "react";
import Link from "next/link";
import { MenuLateral } from "@/components/layout/menu-lateral";

/** Casca das telas de Mapas: menu lateral + caminho (Mapas › título). */
export function EstruturaMapas({
  ctx,
  titulo,
  children,
}: {
  ctx: { temMetasSmart: boolean; acessoCompleto: boolean; souOwner: boolean };
  /** Ausente na lista de mapas. */
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={ctx.temMetasSmart} acessoCompleto={ctx.acessoCompleto} souOwner={ctx.souOwner} />
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <nav aria-label="Você está em" className="text-sm text-gaiamum-text-muted">
          <ol className="flex min-w-0 items-center gap-2">
            <li>
              {titulo ? (
                <Link href="/mapas" className="hover:text-gaiamum-text">
                  Mapas
                </Link>
              ) : (
                <span aria-current="page" className="font-medium text-gaiamum-text">
                  Mapas
                </span>
              )}
            </li>
            {titulo && (
              <>
                <li aria-hidden>›</li>
                <li aria-current="page" className="truncate font-medium text-gaiamum-text">
                  {titulo}
                </li>
              </>
            )}
          </ol>
        </nav>
        {children}
      </main>
    </div>
  );
}
