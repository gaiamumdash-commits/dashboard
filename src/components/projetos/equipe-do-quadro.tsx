"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Convite, PapelProjeto } from "@/lib/ecc/tipos";
import {
  cancelarConvite,
  convidarParaProjeto,
  definirPapelDoMembroNoProjeto,
  removerMembroDoProjeto,
} from "@/lib/ecc/actions";

export type MembroDoQuadro = {
  user_id: string;
  email: string;
  origem: "owner" | "workspace" | "projeto";
  papelProjeto: PapelProjeto | null;
};

/** Convidar/promover/remover gente do quadro — pedido do Fabio: o
 * "coordenador" (gestor promovido depois da criação do projeto, não só
 * quem criou) precisa disso direto na página do quadro, porque ele não
 * enxerga /equipe se foi convidado só pra este projeto. */
export function EquipeDoQuadro({
  projetoId,
  membros,
  convitesPendentes,
}: {
  projetoId: string;
  membros: MembroDoQuadro[];
  convitesPendentes: Convite[];
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function rotulo(m: MembroDoQuadro): string {
    if (m.origem === "owner") return "dono do workspace";
    if (m.papelProjeto === "gestor") return "coordenador do quadro";
    if (m.origem === "workspace") return "acesso completo ao workspace";
    return "membro do quadro";
  }

  function definirPapel(userId: string, papel: PapelProjeto) {
    setErro(null);
    iniciarTransicao(async () => {
      try {
        await definirPapelDoMembroNoProjeto(projetoId, userId, papel);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao mudar papel no quadro.");
      }
    });
  }

  function remover(userId: string) {
    if (!confirm("Tirar essa pessoa deste quadro? Ela deixa de ver este projeto.")) return;
    setErro(null);
    iniciarTransicao(async () => {
      try {
        await removerMembroDoProjeto(projetoId, userId);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao remover do quadro.");
      }
    });
  }

  function convidar(formData: FormData) {
    setErro(null);
    iniciarTransicao(async () => {
      try {
        await convidarParaProjeto(projetoId, formData);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao convidar.");
      }
    });
  }

  function cancelarConviteDoQuadro(conviteId: string) {
    iniciarTransicao(async () => {
      await cancelarConvite(conviteId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5 border-t border-gaiamum-border pt-6">
      <div>
        <span className="text-xs font-medium text-gaiamum-text-muted">Quem tem acesso a este quadro</span>
        <ul className="mt-2 flex flex-col gap-1.5">
          {membros.map((m) => (
            <li
              key={m.user_id}
              className="flex flex-col gap-1.5 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm text-gaiamum-text">
                {m.email} <span className="text-xs text-gaiamum-text-muted">({rotulo(m)})</span>
              </span>
              {m.origem !== "owner" && (
                <div className="flex gap-2">
                  {m.papelProjeto === "gestor" ? (
                    <button
                      type="button"
                      onClick={() => definirPapel(m.user_id, "usuario")}
                      className="rounded-lg border border-gaiamum-border px-2 py-1 text-xs text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
                    >
                      Tirar coordenação
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => definirPapel(m.user_id, "gestor")}
                      className="rounded-lg border border-gaiamum-border px-2 py-1 text-xs text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
                    >
                      Tornar coordenador
                    </button>
                  )}
                  {m.origem === "projeto" && (
                    <button
                      type="button"
                      onClick={() => remover(m.user_id)}
                      className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
                    >
                      Remover do quadro
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <form action={convidar} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
          Convidar pra este quadro
          <input
            type="email"
            name="email"
            required
            placeholder="pessoa@exemplo.com"
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
        </label>
        <button
          type="submit"
          disabled={pendente}
          className="rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
        >
          {pendente ? "Convidando..." : "Convidar"}
        </button>
      </form>

      {erro && <p className="text-sm text-gaiamum-danger">{erro}</p>}

      {convitesPendentes.length > 0 && (
        <div>
          <span className="text-xs font-medium text-gaiamum-text-muted">
            Convites pendentes ({convitesPendentes.length})
          </span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {convitesPendentes.map((convite) => (
              <li
                key={convite.id}
                className="flex items-center justify-between rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm"
              >
                <span className="text-gaiamum-text">{convite.email}</span>
                <button
                  type="button"
                  onClick={() => cancelarConviteDoQuadro(convite.id)}
                  className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
                >
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
