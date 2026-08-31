"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Projeto, StatusProjeto } from "@/lib/ecc/tipos";
import { atualizarStatusProjeto, deletarProjeto } from "@/lib/ecc/actions";
import { CLASSE_FUNDO_QUADRO } from "@/lib/ecc/kanban";

const ROTULO_STATUS: Record<StatusProjeto, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
};

export function CartaoProjeto({
  projeto,
  podeExcluir,
  podeConfigurar,
}: {
  projeto: Projeto;
  podeExcluir: boolean;
  podeConfigurar: boolean;
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function mudarStatus(status: StatusProjeto) {
    iniciarTransicao(async () => {
      await atualizarStatusProjeto(projeto.id, status);
      router.refresh();
    });
  }

  function excluir() {
    if (!confirm(`Excluir o projeto "${projeto.nome}"? As tarefas dele também somem.`)) return;
    iniciarTransicao(async () => {
      await deletarProjeto(projeto.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <div className={`-mx-5 -mt-5 h-1.5 rounded-t-2xl ${CLASSE_FUNDO_QUADRO[projeto.cor_fundo]}`} />
      <div className="flex items-start justify-between gap-2">
        <Link href={`/projetos/${projeto.id}/tarefas`} className="text-lg font-semibold text-gaiamum-text hover:text-gaiamum-primary">
          {projeto.nome}
        </Link>
        <select
          value={projeto.status}
          disabled={pendente}
          onChange={(e) => mudarStatus(e.target.value as StatusProjeto)}
          className="rounded-md border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1 text-xs text-gaiamum-text-muted outline-none"
        >
          {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </div>

      {projeto.descricao && <p className="text-sm text-gaiamum-text-muted">{projeto.descricao}</p>}

      <div className="mt-auto flex items-center justify-between pt-2">
        <Link href={`/projetos/${projeto.id}/tarefas`} className="text-sm text-gaiamum-primary hover:underline">
          Ver kanban →
        </Link>
        <div className="flex items-center gap-3">
          {podeConfigurar && (
            <Link
              href={`/projetos/${projeto.id}/configuracoes`}
              className="text-xs text-gaiamum-text-muted hover:text-gaiamum-text"
              title="Configurações do quadro"
            >
              ⚙
            </Link>
          )}
          {podeExcluir && (
            <button
              type="button"
              onClick={excluir}
              disabled={pendente}
              className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
            >
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
