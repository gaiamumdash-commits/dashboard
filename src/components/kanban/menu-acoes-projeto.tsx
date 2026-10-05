"use client";

import Link from "next/link";
import { BotaoFreeze } from "@/components/kanban/botao-freeze";
import { IconePontos } from "@/components/kanban/icones-kanban";
import { MenuSuspenso } from "@/components/ui/menu-suspenso";

/** Menu de overflow "⋯" do cabeçalho do projeto (redesenho do Kanban,
 * 2026-10-05) — Freeze e Configurações saíram da linha principal e vieram
 * pra cá, sem mudar nada do comportamento. Quem renderiza este menu já é
 * só quem tinha esses 2 botões antes (`podeExcluirTarefa` na página: dono
 * do workspace ou gestor do projeto) — a regra continua na página e no
 * servidor, não aqui. `manterMontado`: o Freeze mostra "Enviado pra N
 * pessoa(s)" depois do envio; com o painel desmontado ao fechar, essa
 * confirmação se perderia. */
export function MenuAcoesProjeto({ projetoId }: { projetoId: string }) {
  return (
    <MenuSuspenso
      rotulo="Mais ações do projeto"
      icone={<IconePontos className="h-4 w-4" />}
      manterMontado
      classeBotao="h-8 w-8 border border-gaiamum-border bg-gaiamum-surface hover:border-gaiamum-border-forte sm:h-9 sm:w-9"
      itens={(fechar) => (
        <>
          <BotaoFreeze projetoId={projetoId} variante="menu" />
          <Link
            href={`/projetos/${projetoId}/configuracoes`}
            role="menuitem"
            onClick={fechar}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
          >
            ⚙ Configurações
          </Link>
        </>
      )}
    />
  );
}
