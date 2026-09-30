"use client";

import { useMemo, useState } from "react";
import { salvarMetasSmart, pularOnboarding } from "@/lib/ecc/actions";
import { CAMPOS_SMART, HORIZONTES } from "@/lib/ecc/smart";
import { BotaoSalvar } from "@/components/onboarding/botao-salvar";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import type { MetaSmart } from "@/lib/ecc/tipos";

const TOTAL_CAMPOS = HORIZONTES.length * (1 + CAMPOS_SMART.length);

/** Monta o mapa inicial `nome_do_campo -> valor` a partir das metas já
 * salvas, pro formulário abrir preenchido em modo edição (correção do P0:
 * antes, não havia jeito de reabrir o formulário com os valores existentes
 * — "Editar" levava a uma tela sem formulário nenhum). Sem metas ainda,
 * devolve `{}` e o formulário abre vazio, mesmo comportamento de sempre. */
function valoresIniciaisDe(metas: MetaSmart[]): Record<string, string> {
  const iniciais: Record<string, string> = {};
  for (const meta of metas) {
    iniciais[`${meta.horizonte}_visao_macro`] = meta.visao_macro;
    iniciais[`${meta.horizonte}_specific`] = meta.specific;
    iniciais[`${meta.horizonte}_measurable`] = meta.measurable;
    iniciais[`${meta.horizonte}_attainable`] = meta.attainable;
    iniciais[`${meta.horizonte}_relevant`] = meta.relevant;
    iniciais[`${meta.horizonte}_time_bound`] = meta.time_bound;
  }
  return iniciais;
}

export function FormularioSmart({ metasExistentes = [] }: { metasExistentes?: MetaSmart[] }) {
  const iniciais = useMemo(() => valoresIniciaisDe(metasExistentes), [metasExistentes]);
  const [valores, setValores] = useState<Record<string, string>>(iniciais);
  const emEdicao = metasExistentes.length > 0;

  const preenchidos = Object.values(valores).filter((valor) => valor.trim() !== "").length;
  const percentual = Math.round((preenchidos / TOTAL_CAMPOS) * 100);

  function handleChange(nome: string, valor: string) {
    setValores((anterior) => ({ ...anterior, [nome]: valor }));
  }

  return (
    <form action={salvarMetasSmart} className="mt-8 flex flex-col gap-10">
      <BarraProgresso percentual={percentual} rotulo="Metas SMART preenchidas" />

      {HORIZONTES.map((horizonte) => (
        <div
          key={horizonte.valor}
          role="group"
          aria-labelledby={`titulo-${horizonte.valor}`}
          className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6"
        >
          <h2 id={`titulo-${horizonte.valor}`} className="text-lg font-semibold text-gaiamum-primary">
            {horizonte.titulo}
          </h2>
          <p className="mb-4 mt-1 text-sm text-gaiamum-text-muted">{horizonte.ajuda}</p>

          <label className="mb-4 flex flex-col gap-2 text-sm">
            <span className="font-semibold text-gaiamum-text">Visão macro</span>
            <textarea
              name={`${horizonte.valor}_visao_macro`}
              required
              rows={2}
              placeholder={horizonte.placeholder}
              defaultValue={iniciais[`${horizonte.valor}_visao_macro`]}
              onChange={(e) => handleChange(`${horizonte.valor}_visao_macro`, e.target.value)}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none placeholder:text-gaiamum-text-muted/60 focus:border-gaiamum-primary"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS_SMART.map((campo) => (
              <label key={campo.campo} className="flex flex-col gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gaiamum-primary/15 text-xs font-bold text-gaiamum-primary">
                    {campo.letra}
                  </span>
                  <span className="font-semibold text-gaiamum-text">{campo.titulo}</span>
                </span>
                <span className="text-xs text-gaiamum-text-muted">{campo.ajuda}</span>
                <textarea
                  name={`${horizonte.valor}_${campo.campo}`}
                  required
                  rows={2}
                  placeholder={campo.placeholder}
                  defaultValue={iniciais[`${horizonte.valor}_${campo.campo}`]}
                  onChange={(e) => handleChange(`${horizonte.valor}_${campo.campo}`, e.target.value)}
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-gaiamum-text outline-none placeholder:text-gaiamum-text-muted/60 focus:border-gaiamum-primary"
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-4">
        <BotaoSalvar rotulo={emEdicao ? "Salvar alterações" : "Salvar metas e continuar"} />
        {!emEdicao && (
          <button
            type="submit"
            formAction={pularOnboarding}
            formNoValidate
            className="text-sm text-gaiamum-text-muted underline underline-offset-2 hover:text-gaiamum-text"
          >
            Pular, preencho depois
          </button>
        )}
      </div>
    </form>
  );
}
