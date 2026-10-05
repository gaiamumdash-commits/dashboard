"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Link do menu lateral com estado "selecionado" pela rota atual
 * (redesenho do Kanban, 2026-10-05: "Projetos deve aparecer visualmente
 * selecionado"). "/" só casa exato; as demais, a própria rota e as
 * sub-rotas (`/projetos/[id]/tarefas` → Projetos). Só aparência — mesmas
 * rotas, mesmas condições de exibição de antes (decididas em
 * `LinksNavegacao`). */
export function LinkNavegacao({
  href,
  onClick,
  className = "",
  children,
}: {
  href: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const ativo = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        ativo
          ? "bg-gaiamum-primary/15 text-gaiamum-text ring-1 ring-inset ring-gaiamum-primary/30"
          : "text-gaiamum-text hover:bg-gaiamum-surface-raised"
      } ${className}`}
    >
      {children}
    </Link>
  );
}
