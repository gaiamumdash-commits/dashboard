"use client";

import { useState, useTransition } from "react";
import type { Convite, Projeto } from "@/lib/ecc/tipos";
import { cancelarConvite } from "@/lib/ecc/actions";

export function ListaConvites({
  convites,
  origem,
  projetos,
}: {
  convites: Convite[];
  origem: string;
  projetos: Pick<Projeto, "id" | "nome">[];
}) {
  const [, iniciarTransicao] = useTransition();
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  function copiar(conviteId: string, link: string) {
    navigator.clipboard.writeText(link);
    setCopiadoId(conviteId);
    setTimeout(() => setCopiadoId(null), 2000);
  }

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <h2 className="text-sm font-semibold text-gaiamum-text">Convites pendentes ({convites.length})</h2>
      <div className="mt-3 flex flex-col gap-2">
        {convites.map((convite) => {
          const link = `${origem}/convite/${convite.token}`;
          const projeto = convite.projeto_id ? projetos.find((p) => p.id === convite.projeto_id) : null;
          return (
            <div
              key={convite.id}
              className="flex flex-col gap-2 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm text-gaiamum-text">{convite.email}</p>
                <p className="text-xs text-gaiamum-text-muted">
                  {convite.papel === "owner" ? "Dono" : "Membro"} ·{" "}
                  {convite.projeto_id ? `quadro: ${projeto?.nome ?? "projeto removido"}` : "workspace inteiro"} ·
                  expira em {new Date(convite.expira_em).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copiar(convite.id, link)}
                  className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-xs text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
                >
                  {copiadoId === convite.id ? "Copiado!" : "Copiar link"}
                </button>
                <button
                  type="button"
                  onClick={() => iniciarTransicao(() => cancelarConvite(convite.id))}
                  className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
                >
                  Cancelar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
