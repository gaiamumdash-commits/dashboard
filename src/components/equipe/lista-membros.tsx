"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MembroTenant } from "@/lib/ecc/tipos";
import { removerMembro } from "@/lib/ecc/actions";

export function ListaMembros({ membros, souOwner }: { membros: MembroTenant[]; souOwner: boolean }) {
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function remover(userId: string) {
    if (!window.confirm("Remover esta pessoa do workspace? Ela perde acesso a tudo, não só a este quadro."))
      return;
    iniciarTransicao(async () => {
      await removerMembro(userId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <h2 className="text-sm font-semibold text-gaiamum-text">Membros ({membros.length})</h2>
      <div className="mt-3 flex flex-col gap-2">
        {membros.map((membro) => (
          <div
            key={membro.user_id}
            className="flex items-center justify-between rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2"
          >
            <div>
              <p className="text-sm text-gaiamum-text">{membro.email}</p>
              <p className="text-xs text-gaiamum-text-muted">{membro.papel === "owner" ? "Dono" : "Membro"}</p>
            </div>
            {souOwner && membro.papel !== "owner" && (
              <button
                type="button"
                onClick={() => remover(membro.user_id)}
                disabled={pendente}
                className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger disabled:opacity-60"
              >
                Remover
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
