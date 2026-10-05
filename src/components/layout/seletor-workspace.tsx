"use client";

import { useTransition } from "react";
import { trocarWorkspace } from "@/lib/ecc/workspaces-actions";
import type { WorkspaceDoUsuario } from "@/lib/ecc/workspaces-servidor";

/** Seletor de workspace (pedido do Fabio, 2026-10-05) — só é renderizado
 * pra quem participa de mais de um. Trocar recarrega em /projetos já no
 * workspace escolhido; a escolha fica lembrada neste navegador. */
export function SeletorWorkspace({ workspaces, atual }: { workspaces: WorkspaceDoUsuario[]; atual: string | null }) {
  const [pendente, iniciarTransicao] = useTransition();

  return (
    <form action={(formData) => iniciarTransicao(() => trocarWorkspace(formData))}>
      <label className="flex flex-col gap-1">
        <span className="px-1 text-[11px] uppercase tracking-wide text-gaiamum-text-muted">Workspace</span>
        <select
          name="tenant_id"
          value={atual ?? undefined}
          disabled={pendente}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="w-full rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2.5 py-1.5 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary disabled:opacity-60"
        >
          {workspaces.map((w) => (
            <option key={w.tenantId} value={w.tenantId}>
              {w.nome}
              {w.papel === "owner" ? " (seu)" : ""}
            </option>
          ))}
        </select>
      </label>
      {pendente && <p className="mt-1 px-1 text-xs text-gaiamum-text-muted">Trocando...</p>}
    </form>
  );
}
