"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { refazerModuloLab } from "@/lib/ecc/lab/actions";

export function BotaoRefazerLab() {
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function refazer() {
    if (!window.confirm("Refazer o Café Mangue do zero? Isso reseta o quadro e o roteiro — suas patentes já conquistadas continuam valendo.")) {
      return;
    }
    iniciarTransicao(async () => {
      try {
        await refazerModuloLab();
        router.push("/lab/quadro");
      } catch (err) {
        toast.error(mensagemDeErro(err, "Falha ao refazer o case."));
      }
    });
  }

  return (
    <button
      type="button"
      onClick={refazer}
      disabled={pendente}
      className="rounded-lg border border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text-muted transition hover:text-gaiamum-text disabled:opacity-60"
    >
      {pendente ? "Refazendo..." : "Refazer o case"}
    </button>
  );
}
