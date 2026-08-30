"use client";

import { useState, useTransition } from "react";
import { aceitarConvite } from "@/lib/ecc/actions";

export function AceitarConviteBotao({ token, emailBate }: { token: string; emailBate: boolean }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  if (!emailBate) {
    return (
      <p className="mt-6 text-sm text-gaiamum-danger">
        Este convite foi feito para outro e-mail. Saia da conta atual e entre com o e-mail correto pra
        aceitar.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={pendente}
        onClick={() => {
          setErro(null);
          iniciarTransicao(async () => {
            try {
              await aceitarConvite(token);
            } catch (e) {
              setErro(e instanceof Error ? e.message : "Falha ao aceitar convite.");
            }
          });
        }}
        className="mt-6 rounded-lg bg-gaiamum-primary px-6 py-3 font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
      >
        {pendente ? "Entrando..." : "Aceitar convite"}
      </button>
      {erro && <p className="mt-3 text-sm text-gaiamum-danger">{erro}</p>}
    </>
  );
}
