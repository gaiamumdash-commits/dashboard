"use client";

import { useState } from "react";

/** Campo de senha com o "olhinho" pra mostrar/esconder o que foi digitado —
 * pedido do Fabio (2026-10-05): a Angeline errava a senha sem conseguir ver
 * o que tinha digitado, principalmente no celular. */
export function CampoSenha({
  value,
  onChange,
  minLength = 6,
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (valor: string) => void;
  minLength?: number;
  autoComplete?: "current-password" | "new-password";
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <input
        type={visivel ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised py-2 pl-3 pr-11 text-gaiamum-text outline-none focus:border-gaiamum-primary"
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
        aria-pressed={visivel}
        title={visivel ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-gaiamum-text-muted transition hover:text-gaiamum-text"
      >
        {visivel ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
