import type { ReactNode } from "react";
import { LinkNavegacao } from "@/components/layout/link-navegacao";
import { GrupoNavegacaoPlanner } from "@/components/layout/grupo-navegacao-planner";

/** Sem "use client" nem "use server": roda no servidor quando importado por
 * MenuLateral (aside desktop), e entra no bundle do cliente quando importado
 * por MenuMobile (drawer) — evita duplicar a lista de links em 2 arquivos.
 * Cada link é um `LinkNavegacao` (cliente) só pra marcar a rota atual como
 * selecionada — as condições de exibição continuam todas aqui. */
export function LinksNavegacao({
  temMetasSmart,
  acessoCompleto = true,
  souOwner = false,
  aoClicarLink,
  linkLab,
  extra,
}: {
  temMetasSmart: boolean;
  acessoCompleto?: boolean;
  souOwner?: boolean;
  /** Fecha o drawer mobile ao navegar; undefined no desktop (sem drawer). */
  aoClicarLink?: () => void;
  /** Link do Gaiamum Lab, resolvido fora daqui (depende da patente do
   * usuário — dado que este componente não pode ser async, ver MenuMobile).
   * Renderizado na posição fixa em que o link estático vivia antes, pra não
   * deslocar visualmente com o slot `extra` (que fica depois de Marketing/
   * Financeiro). Nunca esconde: o rótulo/selo é quem muda, ver
   * LinkLabCondicional em menu-lateral.tsx. */
  linkLab?: ReactNode;
  /** Slot pra links condicionais que não cabem nos papéis já existentes (ex.:
   * gate por conta específica) — JSX já resolvido (geralmente um `<Suspense>`
   * vindo de MenuLateral), nunca uma função, pra não forçar este componente
   * nem MenuMobile a virar async. */
  extra?: ReactNode;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {acessoCompleto && (
        <LinkNavegacao href="/" onClick={aoClicarLink}>
          Início
        </LinkNavegacao>
      )}
      <LinkNavegacao href="/projetos" onClick={aoClicarLink}>
        Projetos
      </LinkNavegacao>
      {/* Planner é pessoal (cada um vê só o seu), então aparece pra todo
          mundo — inclusive quem entrou convidado só pra um quadro. Pra quem
          tem acesso completo, fica logo depois da Agenda (abaixo). */}
      {!acessoCompleto && <GrupoNavegacaoPlanner aoClicarLink={aoClicarLink} />}
      {acessoCompleto && (
        <>
          <LinkNavegacao href="/onboarding" onClick={aoClicarLink} className="flex items-center justify-between">
            Metas SMART
            {!temMetasSmart && (
              <span className="rounded-full bg-gaiamum-primary px-2 py-0.5 text-xs font-semibold text-white">
                Pendente
              </span>
            )}
          </LinkNavegacao>
          <LinkNavegacao href="/equipe" onClick={aoClicarLink}>
            Equipe
          </LinkNavegacao>
          <LinkNavegacao href="/agenda" onClick={aoClicarLink}>
            Agenda
          </LinkNavegacao>
          <GrupoNavegacaoPlanner aoClicarLink={aoClicarLink} />
          {linkLab}
          <LinkNavegacao href="/configuracoes" onClick={aoClicarLink}>
            ⚙️ Configurações
          </LinkNavegacao>
        </>
      )}
      {souOwner && (
        <>
          <LinkNavegacao href="/marketing" onClick={aoClicarLink}>
            Marketing
          </LinkNavegacao>
          <LinkNavegacao href="/financeiro" onClick={aoClicarLink}>
            Financeiro
          </LinkNavegacao>
        </>
      )}
      {extra}
    </nav>
  );
}
