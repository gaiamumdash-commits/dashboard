"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { PaginaLivre } from "@/lib/ecc/tipos";
import { criarPaginaLivreLab, excluirPaginaLivreLab } from "@/lib/ecc/lab/paginas-livres";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { Dialog } from "@/components/ui/dialog";

/** Espelha src/components/projetos/lista-paginas-livres.tsx, usando as Server
 * Actions Lab-aware e navegando pra /lab/paginas/[id]. Sem prop `podeExcluir`
 * — o tenant do Lab é sempre solo-owner, excluir sempre disponível (mesmo
 * padrão simplificado de lista-contas-lab.tsx). */
export function ListaPaginasLivresLab({
  projetoId,
  paginasIniciais,
}: {
  projetoId: string;
  paginasIniciais: PaginaLivre[];
}) {
  const [criando, setCriando] = useState(false);
  const [salvando, iniciarTransicao] = useTransition();
  const router = useRouter();

  function criar(formData: FormData) {
    const titulo = String(formData.get("titulo") ?? "");
    iniciarTransicao(async () => {
      try {
        const nova = await criarPaginaLivreLab(projetoId, titulo);
        setCriando(false);
        router.push(`/lab/paginas/${nova.id}`);
      } catch (err) {
        toast.error(mensagemDeErro(err, "Falha ao criar página."));
      }
    });
  }

  function excluir(pagina: PaginaLivre) {
    if (!confirm(`Excluir a página "${pagina.titulo}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    iniciarTransicao(async () => {
      try {
        await excluirPaginaLivreLab(pagina.id, projetoId);
        router.refresh();
      } catch (err) {
        toast.error(mensagemDeErro(err, "Falha ao excluir página."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setCriando(true)}
        className="self-start rounded-lg border border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text hover:border-gaiamum-primary"
      >
        + Nova página
      </button>

      {paginasIniciais.length === 0 && (
        <p className="text-sm text-gaiamum-text-muted">Nenhuma página livre criada ainda.</p>
      )}

      <div className="flex flex-col gap-3">
        {paginasIniciais.map((pagina) => (
          <div
            key={pagina.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4"
          >
            <Link href={`/lab/paginas/${pagina.id}`} className="flex-1">
              <h3 className="text-base font-semibold text-gaiamum-text">{pagina.titulo}</h3>
              <p className="text-xs text-gaiamum-text-muted">
                Atualizada em{" "}
                {new Date(pagina.atualizado_em).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => excluir(pagina)}
              className="shrink-0 text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
            >
              Excluir
            </button>
          </div>
        ))}
      </div>

      {criando && (
        <Dialog
          titulo="Nova página"
          aoFechar={() => setCriando(false)}
          acoesExtras={salvando ? <span className="text-xs text-gaiamum-text-muted">Criando…</span> : null}
        >
          <form action={criar} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Título
              <input
                name="titulo"
                required
                autoFocus
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>
            <button
              type="submit"
              disabled={salvando}
              className="mt-2 self-start rounded-lg border border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text hover:border-gaiamum-primary disabled:opacity-50"
            >
              {salvando ? "Criando…" : "Criar e abrir"}
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
