"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LinkNavegacao } from "@/components/layout/link-navegacao";

const SUBITENS = [
  { href: "/planner", rotulo: "Meu Planner" },
  { href: "/planner/pessoal", rotulo: "Pessoal" },
  { href: "/planner/estudos", rotulo: "Estudos" },
  { href: "/planner/casa", rotulo: "Casa" },
  { href: "/planner/saude", rotulo: "Saúde" },
];

/** Grupo expansível "Planner" do menu (desktop e celular). Abre sozinho
 * em qualquer rota /planner; fora dela, começa fechado e a pessoa abre/fecha
 * pela setinha. "Meu Planner" só fica ativo na rota exata — as áreas
 * (`/planner/pessoal`...) marcam o próprio subitem, não o "Meu Planner". */
export function GrupoNavegacaoPlanner({ aoClicarLink }: { aoClicarLink?: () => void }) {
  const pathname = usePathname();
  const dentroDoPlanner = pathname === "/planner" || pathname.startsWith("/planner/");
  // null = segue a rota; true/false = a pessoa escolheu.
  const [escolha, setEscolha] = useState<boolean | null>(null);
  const aberto = escolha ?? dentroDoPlanner;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setEscolha(!aberto)}
        aria-expanded={aberto}
        aria-controls="submenu-planner"
        className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
          dentroDoPlanner
            ? "bg-gaiamum-primary/15 text-gaiamum-text ring-1 ring-inset ring-gaiamum-primary/30"
            : "text-gaiamum-text hover:bg-gaiamum-surface-raised"
        }`}
      >
        Planner
        <span aria-hidden className={`text-xs text-gaiamum-text-muted transition-transform ${aberto ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {aberto && (
        <div id="submenu-planner" className="ml-3 flex flex-col gap-0.5 border-l border-gaiamum-border pl-2">
          {SUBITENS.map((item) => (
            <LinkNavegacao
              key={item.href}
              href={item.href}
              exato={item.href === "/planner"}
              onClick={aoClicarLink}
              className="py-1.5 text-[13px]"
            >
              {item.rotulo}
            </LinkNavegacao>
          ))}
        </div>
      )}
    </div>
  );
}
