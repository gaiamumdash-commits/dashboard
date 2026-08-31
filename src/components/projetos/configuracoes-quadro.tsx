"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CorEtiqueta, Projeto } from "@/lib/ecc/tipos";
import { alternarArquivadoProjeto, mudarCorProjeto, renomearProjeto } from "@/lib/ecc/actions";
import { CLASSE_FUNDO_QUADRO } from "@/lib/ecc/kanban";

const CORES: CorEtiqueta[] = ["purple", "teal", "yellow", "blue", "coral", "lime"];

export function ConfiguracoesQuadro({ projeto }: { projeto: Projeto }) {
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  function alternarArquivado() {
    if (!projeto.arquivado) {
      if (!confirm(`Arquivar o quadro "${projeto.nome}"? Ele some da lista de projetos até você desarquivar.`)) {
        return;
      }
    }
    iniciarTransicao(async () => {
      await alternarArquivadoProjeto(projeto.id, !projeto.arquivado);
      router.push(projeto.arquivado ? `/projetos/${projeto.id}/configuracoes` : "/projetos");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        action={(formData) => iniciarTransicao(() => renomearProjeto(projeto.id, formData))}
        className="flex flex-col gap-1.5"
      >
        <label className="text-xs font-medium text-gaiamum-text-muted">Nome do quadro</label>
        <div className="flex gap-2">
          <input
            name="nome"
            required
            defaultValue={projeto.nome}
            className="flex-1 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
          <button
            type="submit"
            className="rounded-lg border border-gaiamum-border px-3 py-2 text-sm text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
          >
            Salvar
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-gaiamum-text-muted">Cor de fundo</span>
        <div className="flex gap-2">
          {CORES.map((cor) => (
            <button
              key={cor}
              type="button"
              onClick={() => iniciarTransicao(() => mudarCorProjeto(projeto.id, cor))}
              title={cor}
              className={`h-8 w-8 rounded-full ${CLASSE_FUNDO_QUADRO[cor]} ${
                projeto.cor_fundo === cor ? "ring-2 ring-gaiamum-text ring-offset-2 ring-offset-gaiamum-surface" : ""
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-gaiamum-border pt-6">
        <span className="text-xs font-medium text-gaiamum-text-muted">
          {projeto.arquivado ? "Arquivado" : "Arquivar"}
        </span>
        <p className="text-sm text-gaiamum-text-muted">
          {projeto.arquivado
            ? "Este quadro está arquivado — some da lista de projetos até você desarquivar."
            : "O quadro some da lista de projetos, mas nada é apagado — dá pra desarquivar depois."}
        </p>
        <button
          type="button"
          onClick={alternarArquivado}
          className="mt-1 self-start rounded-lg border border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text-muted hover:border-gaiamum-danger hover:text-gaiamum-danger"
        >
          {projeto.arquivado ? "Desarquivar este quadro" : "Arquivar este quadro"}
        </button>
      </div>
    </div>
  );
}
