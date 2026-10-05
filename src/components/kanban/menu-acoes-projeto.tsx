"use client";

import { useState } from "react";
import Link from "next/link";
import { ModalPlanejarNoProjeto } from "@/components/projetos/modal-planejar-no-projeto";
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
 * confirmação se perderia.
 * "Planejar com IA" (Fase 1 do prompt copiável): replanejar no meio do
 * caminho — mesma regra de quem vê o menu, reforçada no banco
 * (`adicionar_tarefas_planejadas`, migration 0055). */
export function MenuAcoesProjeto({ projetoId, nomeProjeto }: { projetoId: string; nomeProjeto: string }) {
  const [planejando, setPlanejando] = useState(false);

  return (
    <>
      <MenuSuspenso
        rotulo="Mais ações do projeto"
        icone={<IconePontos className="h-4 w-4" />}
        manterMontado
        classeBotao="h-8 w-8 border border-gaiamum-border bg-gaiamum-surface hover:border-gaiamum-border-forte sm:h-9 sm:w-9"
        itens={(fechar) => (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                fechar();
                setPlanejando(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
            >
              ✨ Planejar com IA
            </button>
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
      {planejando && <ModalPlanejarNoProjeto projetoId={projetoId} nomeProjeto={nomeProjeto} aoFechar={() => setPlanejando(false)} />}
    </>
  );
}
