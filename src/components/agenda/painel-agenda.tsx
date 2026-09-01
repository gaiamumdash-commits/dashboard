"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemAgenda, ResultadoAgenda } from "@/lib/ecc/tipos";
import { criarEventoGoogleCalendar, desconectarGoogleCalendar, iniciarConexaoGoogleCalendar } from "@/lib/ecc/google-calendar";
import { excluirEventoAgenda } from "@/lib/ecc/eventos-agenda";
import { FormularioEventoAgenda } from "@/components/agenda/formulario-evento-agenda";

// Eventos de dia inteiro vêm do Google como "2026-09-02" (só data, sem
// hora) — o JS interpreta isso como meia-noite UTC, não local, o que
// adianta/atrasa o dia em fusos negativos (Brasil). Forçar hora local
// explícita evita isso — mesmo padrão já usado em checklist-contas.tsx.
const APENAS_DATA = /^\d{4}-\d{2}-\d{2}$/;

function paraDataLocal(iso: string): Date {
  return APENAS_DATA.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
}

function formatarHora(iso: string): string {
  if (!iso) return "";
  if (APENAS_DATA.test(iso)) return "Dia inteiro";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Hoje" / "Amanhã" / "terça-feira, 2 de setembro" — mesma lógica de
 * rótulo relativo que o Google Calendar usa na visão "Agenda". */
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

/** Agrupa a lista (já ordenada por data) em blocos por dia, preservando a
 * ordem cronológica dos grupos. Serve tanto pra eventos do Google quanto
 * pra contas a pagar/tarefas/eventos manuais — todos normalizados em
 * `ItemAgenda` antes de chegar aqui. */
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

const RÓTULO_FONTE: Record<ItemAgenda["fonte"], string> = {
  google: "Google",
  conta_a_pagar: "Financeiro",
  tarefa: "Kanban",
  evento_agenda: "Agenda",
};

const MENSAGEM_POR_ERRO: Record<string, string> = {
  conexao: "A conexão com o Google falhou ou expirou no meio do caminho — tenta de novo.",
  sem_refresh_token: "O Google não devolveu a permissão esperada — tenta desconectar no Google e conectar de novo.",
  salvar: "Deu erro salvando a conexão no Gaiamum — tenta de novo em alguns segundos.",
};

export function PainelAgenda({
  google,
  itens,
  erro,
}: {
  google: ResultadoAgenda;
  itens: ItemAgenda[];
  erro?: string;
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function conectar() {
    iniciarTransicao(async () => {
      await iniciarConexaoGoogleCalendar();
    });
  }

  function desconectar() {
    iniciarTransicao(async () => {
      await desconectarGoogleCalendar();
      router.refresh();
    });
  }

  function criarEvento(formData: FormData) {
    iniciarTransicao(async () => {
      await criarEventoGoogleCalendar(formData);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status da conexão com o Google — não bloqueia mais o resto da
          Agenda: contas a pagar e tarefas com prazo aparecem mesmo sem
          conectar o Google. */}
      {google.status === "conectado" ? (
        <div className="flex items-center justify-between rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
          <span className="text-sm text-gaiamum-text-muted">
            Google conectado como <span className="font-medium text-gaiamum-text">{google.googleEmail}</span>
          </span>
          <button
            type="button"
            onClick={desconectar}
            disabled={pendente}
            className="text-xs text-gaiamum-text-muted underline hover:text-gaiamum-danger disabled:opacity-60"
          >
            Desconectar
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4 text-center">
          {google.status === "expirado" && (
            <p className="mb-2 text-sm text-gaiamum-danger">
              Sua conexão com o Google expirou — conecte de novo pra continuar.
            </p>
          )}
          {erro && (
            <p className="mb-2 text-sm text-gaiamum-danger">
              {MENSAGEM_POR_ERRO[erro] ?? "Algo deu errado ao conectar — tenta de novo."}
            </p>
          )}
          <p className="mb-3 text-sm text-gaiamum-text-muted">
            Conecte sua conta do Google pra ver e criar eventos pessoais sem sair do Gaiamum.
          </p>
          <button
            type="button"
            onClick={conectar}
            disabled={pendente}
            className="rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            Conectar Google Calendar
          </button>
        </div>
      )}

      {google.status === "conectado" && (
        <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
          <h2 className="text-sm font-medium text-gaiamum-text-muted">Novo evento no Google</h2>
          <form action={criarEvento} className="mt-3 flex flex-col gap-3">
            {/* O <input type="datetime-local"> não carrega fuso horário — a
                Server Action roda no servidor (UTC), não no navegador de quem
                preenche, então precisa saber o fuso local explicitamente pra
                não errar o horário do evento. */}
            <input type="hidden" name="fuso" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
            <input
              name="titulo"
              required
              placeholder="Título do evento"
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                Início
                <input
                  type="datetime-local"
                  name="inicio"
                  required
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                Fim
                <input
                  type="datetime-local"
                  name="fim"
                  required
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={pendente}
              className="self-start rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              Criar evento
            </button>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
        <h2 className="text-sm font-medium text-gaiamum-text-muted">Próximos compromissos</h2>
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
                                await excluirEventoAgenda(item.id);
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
                        target={item.fonte === "google" ? "_blank" : undefined}
                        rel={item.fonte === "google" ? "noreferrer" : undefined}
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

      <FormularioEventoAgenda />
    </div>
  );
}
