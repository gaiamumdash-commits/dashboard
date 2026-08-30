"use client";

import { useState } from "react";
import { convidarMembro } from "@/lib/ecc/actions";
import type { Projeto } from "@/lib/ecc/tipos";

export function FormularioConvite({ projetos }: { projetos: Pick<Projeto, "id" | "nome">[] }) {
  const [erro, setErro] = useState<string | null>(null);
  const [projetoId, setProjetoId] = useState("");

  return (
    <form
      action={async (formData) => {
        setErro(null);
        try {
          await convidarMembro(formData);
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Falha ao convidar.");
        }
      }}
      className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 sm:flex-row sm:items-end sm:flex-wrap"
    >
      <label className="flex flex-1 flex-col gap-1 text-sm text-gaiamum-text-muted">
        Convidar por e-mail
        <input
          type="email"
          name="email"
          required
          placeholder="pessoa@exemplo.com"
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Convidar pra qual quadro
        <select
          name="projeto_id"
          value={projetoId}
          onChange={(e) => setProjetoId(e.target.value)}
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none"
        >
          <option value="">Workspace inteiro</option>
          {projetos.map((projeto) => (
            <option key={projeto.id} value={projeto.id}>
              {projeto.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Papel
        <select
          name="papel"
          defaultValue="member"
          disabled={projetoId !== ""}
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none disabled:opacity-50"
        >
          <option value="member">Membro</option>
          <option value="owner">Dono</option>
        </select>
      </label>

      <button
        type="submit"
        className="rounded-lg bg-gaiamum-primary px-5 py-2 font-medium text-white transition hover:bg-gaiamum-primary-dark"
      >
        Gerar convite
      </button>

      {projetoId !== "" && (
        <p className="text-xs text-gaiamum-text-muted sm:basis-full">
          Convite pra um quadro específico sempre entra como Membro daquele quadro só — não vê Metas SMART
          nem os outros projetos.
        </p>
      )}

      {erro && <p className="text-sm text-gaiamum-danger sm:basis-full">{erro}</p>}
    </form>
  );
}
