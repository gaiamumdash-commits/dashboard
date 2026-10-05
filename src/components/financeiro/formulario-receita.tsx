"use client";

import { useState } from "react";
import { criarReceita } from "@/lib/ecc/receitas";
import { ROTULO_CATEGORIA_RECEITA } from "@/lib/ecc/receitas-regras";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { BotaoFormulario } from "@/components/botao-formulario";

const CLASSE_CAMPO =
  "rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none focus:border-gaiamum-primary";

/** Cadastro rápido: descrição, valor e data são obrigatórios; categoria e
 * projeto ficam opcionais (decisão do Fabio, 2026-10-05). */
export function FormularioReceita({ projetos }: { projetos: { id: string; nome: string }[] }) {
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setErro(null);
        try {
          await criarReceita(formData);
        } catch (e) {
          setErro(mensagemDeErro(e, "Falha ao lançar receita."));
        }
      }}
      className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm text-gaiamum-text-muted">
        Descrição
        <input name="descricao" required maxLength={200} placeholder="Trabalho do cliente X, venda do curso..." className={CLASSE_CAMPO} />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Valor
        <input type="number" name="valor" step="0.01" min="0.01" required inputMode="decimal" className={`w-32 ${CLASSE_CAMPO}`} />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Data prevista
        <input type="date" name="data_prevista" required className={CLASSE_CAMPO} />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
        Categoria
        <select name="categoria" defaultValue="" className={CLASSE_CAMPO}>
          <option value="">Sem categoria</option>
          {Object.entries(ROTULO_CATEGORIA_RECEITA).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </label>

      {projetos.length > 0 && (
        <label className="flex flex-col gap-1 text-sm text-gaiamum-text-muted">
          Projeto
          <select name="projeto_id" defaultValue="" className={`max-w-[220px] ${CLASSE_CAMPO}`}>
            <option value="">Nenhum</option>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <BotaoFormulario label="Lançar receita" labelPendente="Lançando..." />

      {erro && <p className="text-sm text-gaiamum-danger sm:basis-full">{erro}</p>}
    </form>
  );
}
