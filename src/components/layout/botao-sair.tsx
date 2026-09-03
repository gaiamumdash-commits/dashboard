"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BotaoSair() {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();

  function sair() {
    iniciarTransicao(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={pendente}
      className="rounded-lg px-3 py-2 text-left text-sm font-medium text-gaiamum-text-muted transition hover:bg-gaiamum-danger/10 hover:text-gaiamum-danger disabled:opacity-60"
    >
      {pendente ? "Saindo..." : "Sair"}
    </button>
  );
}
