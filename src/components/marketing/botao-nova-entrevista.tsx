"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { iniciarEntrevista } from "@/lib/ecc/entrevista";

export function BotaoNovaEntrevista() {
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function comecar() {
    iniciarTransicao(async () => {
      const id = await iniciarEntrevista();
      router.push(`/marketing/entrevista/${id}`);
    });
  }

  return (
    <button
      type="button"
      onClick={comecar}
      disabled={pendente}
      className="rounded-lg bg-gaiamum-primary px-5 py-2 font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
    >
      {pendente ? "Iniciando..." : "Nova entrevista"}
    </button>
  );
}
