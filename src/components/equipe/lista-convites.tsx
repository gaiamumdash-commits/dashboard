"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Convite, Projeto } from "@/lib/ecc/tipos";
import { cancelarConvite, reenviarConvite } from "@/lib/ecc/actions";

export function ListaConvites({
  convites,
  origem,
  projetos,
}: {
  convites: Convite[];
  origem: string;
  projetos: Pick<Projeto, "id" | "nome">[];
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [reenviadoId, setReenviadoId] = useState<string | null>(null);
  const router = useRouter();

  function copiar(conviteId: string, link: string) {
    navigator.clipboard.writeText(link);
    setCopiadoId(conviteId);
    setTimeout(() => setCopiadoId(null), 2000);
  }

  function cancelar(conviteId: string) {
    iniciarTransicao(async () => {
      await cancelarConvite(conviteId);
      router.refresh();
    });
  }

  function reenviar(conviteId: string) {
    iniciarTransicao(async () => {
      await reenviarConvite(conviteId);
      setReenviadoId(conviteId);
      setTimeout(() => setReenviadoId(null), 2000);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <h2 className="text-sm font-semibold text-gaiamum-text">Convites pendentes ({convites.length})</h2>
      <div className="mt-3 flex flex-col gap-2">
        {convites.map((convite) => {
          const link = `${origem}/convite/${convite.token}`;
          const projeto = convite.projeto_id ? projetos.find((p) => p.id === convite.projeto_id) : null;
          const expirado = new Date(convite.expira_em) < new Date();
          return (
            <div
              key={convite.id}
              className="flex flex-col gap-2 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm text-gaiamum-text">{convite.email}</p>
                <p className="text-xs text-gaiamum-text-muted">
                  {convite.papel === "owner" ? "Dono" : "Membro"} ·{" "}
                  {convite.projeto_id ? `quadro: ${projeto?.nome ?? "projeto removido"}` : "workspace inteiro"} ·{" "}
                  {expirado ? (
                    <span className="text-gaiamum-danger">expirou em {new Date(convite.expira_em).toLocaleDateString("pt-BR")}</span>
                  ) : (
                    `expira em ${new Date(convite.expira_em).toLocaleDateString("pt-BR")}`
                  )}
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
                  onClick={() => reenviar(convite.id)}
                  disabled={pendente}
                  className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-xs text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text disabled:opacity-50"
                >
                  {reenviadoId === convite.id ? "Reenviado!" : "Reenviar"}
                </button>
                <button
                  type="button"
                  onClick={() => cancelar(convite.id)}
                  disabled={pendente}
                  className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger disabled:opacity-50"
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
