"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ItemAgenda } from "@/lib/ecc/tipos";
import { excluirEventoAgendaLab } from "@/lib/ecc/lab/agenda";
import { FormularioEventoAgendaLab } from "@/components/lab/formulario-evento-agenda-lab";
import { GradeSemanalLab } from "@/components/lab/grade-semanal-lab";
import { RÓTULO_FONTE, formatarHora, mesmoDia, paraDataLocal } from "@/lib/ecc/agenda-apresentacao";
import { chaveSemanaAtual, semanaAnterior, semanaSeguinte } from "@/lib/ecc/semana";

function rotuloDia(data: Date): string {
  const hoje = new Date();
  if (mesmoDia(data, hoje)) return "Hoje";

  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);
  if (mesmoDia(data, amanha)) return "Amanhã";

  const formatado = data.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return formatado.charAt(0).toUpperCase() + formatado.slice(1);
}

type GrupoDoDia = { chave: string; rotulo: string; eEhHoje: boolean; itens: ItemAgenda[] };

function agruparPorDia(itens: ItemAgenda[]): GrupoDoDia[] {
  const grupos: GrupoDoDia[] = [];

  for (const item of itens) {
    const data = paraDataLocal(item.quando);
    const chave = Number.isNaN(data.getTime()) ? item.quando : data.toDateString();
    const ultimo = grupos[grupos.length - 1];

    if (ultimo?.chave === chave) {
      ultimo.itens.push(item);
    } else {
      grupos.push({ chave, rotulo: rotuloDia(data), eEhHoje: mesmoDia(data, new Date()), itens: [item] });
    }
  }

  return grupos;
}

/** Versão só-do-Lab de PainelAgenda (components/agenda/painel-agenda.tsx) —
 * sem a seção de conexão/desconexão/criação de evento no Google Calendar (o
 * Lab nunca inclui essa fonte, ver achado #1 do plano). Navegação de semana
 * aponta pra /lab/agenda em vez de /agenda; exclusão usa
 * excluirEventoAgendaLab em vez de excluirEventoAgenda. */
export function PainelAgendaLab({
  itens,
  chaveSemana,
  tenantIdLab,
}: {
  itens: ItemAgenda[];
  chaveSemana: string;
  tenantIdLab: string;
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gaiamum-text-muted">
            <span className="sm:hidden">Próximos compromissos</span>
            <span className="hidden sm:inline">Semana</span>
          </h2>
          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href={`/lab/agenda?semana=${semanaAnterior(chaveSemana)}`}
              scroll={false}
              className="rounded-lg border border-gaiamum-border px-2 py-1 text-sm text-gaiamum-text-muted hover:bg-gaiamum-surface-raised"
              aria-label="Semana anterior"
            >
              ‹
            </Link>
            <Link
              href={chaveSemana === chaveSemanaAtual() ? "#" : "/lab/agenda"}
              scroll={false}
              className="rounded-lg border border-gaiamum-border px-3 py-1 text-xs font-medium text-gaiamum-text-muted hover:bg-gaiamum-surface-raised"
            >
              Hoje
            </Link>
            <Link
              href={`/lab/agenda?semana=${semanaSeguinte(chaveSemana)}`}
              scroll={false}
              className="rounded-lg border border-gaiamum-border px-2 py-1 text-sm text-gaiamum-text-muted hover:bg-gaiamum-surface-raised"
              aria-label="Próxima semana"
            >
              ›
            </Link>
          </div>
        </div>

        <div className="sm:hidden">
          {itens.length === 0 ? (
            <p className="mt-3 text-sm text-gaiamum-text-muted">Nada por aqui nos próximos dias.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-5">
              {agruparPorDia(itens).map((grupo) => (
                <div key={grupo.chave}>
                  <h3
                    className={`text-sm font-semibold ${grupo.eEhHoje ? "text-gaiamum-primary" : "text-gaiamum-text"}`}
                  >
                    {grupo.rotulo}
                  </h3>
                  <div className="mt-2 flex flex-col divide-y divide-gaiamum-border overflow-hidden rounded-lg border border-gaiamum-border">
                    {grupo.itens.map((item) => {
                      const conteudo = (
                        <>
                          <span className="h-2 w-2 shrink-0 rounded-full bg-gaiamum-primary" />
                          <span className="w-12 shrink-0 text-xs text-gaiamum-text-muted">
                            {formatarHora(item.quando)}
                          </span>
                          <span className="flex-1 text-gaiamum-text">{item.titulo}</span>
                          {item.badge && (
                            <span className="shrink-0 text-xs text-gaiamum-text-muted">{item.badge}</span>
                          )}
                          <span className="shrink-0 text-[11px] uppercase tracking-wide text-gaiamum-text-muted">
                            {RÓTULO_FONTE[item.fonte]}
                          </span>
                        </>
                      );

                      if (item.fonte === "evento_agenda") {
                        return (
                          <div key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                            {conteudo}
                            <button
                              type="button"
                              disabled={pendente}
                              onClick={() => {
                                iniciarTransicao(async () => {
                                  await excluirEventoAgendaLab(item.id);
                                  router.refresh();
                                });
                              }}
                              className="shrink-0 text-xs text-gaiamum-text-muted underline hover:text-gaiamum-danger disabled:opacity-60"
                            >
                              Excluir
                            </button>
                          </div>
                        );
                      }

                      return item.link ? (
                        <a
                          key={item.id}
                          href={item.link}
                          className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gaiamum-surface-raised"
                        >
                          {conteudo}
                        </a>
                      ) : (
                        <div key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                          {conteudo}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden sm:block">
          <GradeSemanalLab itens={itens} chaveSemana={chaveSemana} />
        </div>
      </div>

      <FormularioEventoAgendaLab tenantIdLab={tenantIdLab} />
    </div>
  );
}
