import type { ReactNode, SVGProps } from "react";

/** Ícones de linha do Kanban redesenhado (2026-10-05) — SVG inline, traço
 * herdando `currentColor`, pra seguir os tokens de tema (claro/escuro/black)
 * sem nenhuma dependência nova de biblioteca de ícones. Tamanho padrão 16px;
 * ajustar via `className` (`h-4 w-4` etc.). */
function Base({ children, className = "h-4 w-4", ...resto }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...resto}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const IconeMais = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const IconeBusca = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);
export const IconeFiltro = (p: P) => (
  <Base {...p}>
    <path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" />
  </Base>
);
export const IconePessoa = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />
  </Base>
);
export const IconeGrade = (p: P) => (
  <Base {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
  </Base>
);
export const IconeCalendario = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Base>
);
export const IconeRelogio = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);
export const IconeCheckCirculo = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.4 2.4 4.8-5" />
  </Base>
);
export const IconeSol = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Base>
);
export const IconeNascerDoSol = (p: P) => (
  <Base {...p}>
    <path d="M7 16a5 5 0 0 1 10 0M3 16h18M12 4v4M5.6 9.6l1.4 1.4M18.4 9.6 17 11M4 20h16" />
  </Base>
);
export const IconeLua = (p: P) => (
  <Base {...p}>
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
  </Base>
);
export const IconePrancheta = (p: P) => (
  <Base {...p}>
    <rect x="5" y="4.5" width="14" height="16" rx="2" />
    <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6" />
  </Base>
);
export const IconeAlvo = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </Base>
);
export const IconeAlerta = (p: P) => (
  <Base {...p}>
    <path d="M12 4 2.8 19.5h18.4z" />
    <path d="M12 10v4M12 17v.01" />
  </Base>
);
export const IconeBandeira = (p: P) => (
  <Base {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Base>
);
export const IconeChecklist = (p: P) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="m8.5 12 2.4 2.4 4.6-4.8" />
  </Base>
);
export const IconeClipe = (p: P) => (
  <Base {...p}>
    <path d="m20 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
  </Base>
);
export const IconeAmpulheta = (p: P) => (
  <Base {...p}>
    <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
  </Base>
);
export const IconePontos = (p: P) => (
  <Base {...p} strokeWidth={0}>
    <circle cx="5" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="19" cy="12" r="1.7" fill="currentColor" />
  </Base>
);
export const IconePontosVertical = (p: P) => (
  <Base {...p} strokeWidth={0}>
    <circle cx="12" cy="5" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="19" r="1.7" fill="currentColor" />
  </Base>
);
export const IconeChevronBaixo = (p: P) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);
export const IconeChevronCima = (p: P) => (
  <Base {...p}>
    <path d="m6 15 6-6 6 6" />
  </Base>
);
export const IconeChevronDireita = (p: P) => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
);
export const IconePlay = (p: P) => (
  <Base {...p} strokeWidth={0}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </Base>
);
export const IconeAlca = (p: P) => (
  <Base {...p} strokeWidth={0}>
    {[7, 12, 17].map((y) => (
      <g key={y}>
        <circle cx="9" cy={y} r="1.5" fill="currentColor" />
        <circle cx="15" cy={y} r="1.5" fill="currentColor" />
      </g>
    ))}
  </Base>
);
export const IconeDinheiro = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2s1.2 1.7 2.8 2.1 2.8.9 2.8 2.1-1.2 2-2.8 2c-1.3 0-2.4-.5-2.9-1.5M12 6.3v1.5M12 16.2v1.5" />
  </Base>
);
export const IconeSetaExterna = (p: P) => (
  <Base {...p}>
    <path d="M14 5h5v5M19 5l-8 8M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10" />
  </Base>
);
