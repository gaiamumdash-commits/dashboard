"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EventoGoogleCalendar, ResultadoAgenda } from "@/lib/ecc/tipos";
import { criarEventoGoogleCalendar, desconectarGoogleCalendar, iniciarConexaoGoogleCalendar } from "@/lib/ecc/google-calendar";

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

type GrupoDoDia = { chave: string; rotulo: string; eEhHoje: boolean; eventos: EventoGoogleCalendar[] };

/** Agrupa a lista (já ordenada por início pelo Google) em blocos por dia,
 * preservando a ordem cronológica dos grupos. */
function agruparPorDia(eventos: EventoGoogleCalendar[]): GrupoDoDia[] {
  const grupos: GrupoDoDia[] = [];

  for (const evento of eventos) {
    const data = paraDataLocal(evento.inicio);
    const chave = Number.isNaN(data.getTime()) ? evento.inicio : data.toDateString();
    const ultimo = grupos[grupos.length - 1];

    if (ultimo?.chave === chave) {
      ultimo.eventos.push(evento);
    } else {
      grupos.push({ chave, rotulo: rotuloDia(data), eEhHoje: mesmoDia(data, new Date()), eventos: [evento] });
    }
  }

  return grupos;
}

const MENSAGEM_POR_ERRO: Record<string, string> = {
  conexao: "A conexão com o Google falhou ou expirou no meio do caminho — tenta de novo.",
  sem_refresh_token: "O Google não devolveu a permissão esperada — tenta desconectar no Google e conectar de novo.",
  salvar: "Deu erro salvando a conexão no Gaiamum — tenta de novo em alguns segundos.",
};

export function PainelAgenda({ resultado, erro }: { resultado: ResultadoAgenda; erro?: string }) {
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

  if (resultado.status === "nao_conectado" || resultado.status === "expirado") {
    return (
      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6 text-center">
        {resultado.status === "expirado" && (
          <p className="mb-3 text-sm text-gaiamum-danger">
            Sua conexão com o Google expirou — conecte de novo pra continuar.
          </p>
        )}
        {erro && (
          <p className="mb-3 text-sm text-gaiamum-danger">
            {MENSAGEM_POR_ERRO[erro] ?? "Algo deu errado ao conectar — tenta de novo."}
          </p>
        )}
        <p className="mb-4 text-sm text-gaiamum-text-muted">
          Conecte sua conta do Google pra ver e criar eventos sem sair do Gaiamum.
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
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
        <span className="text-sm text-gaiamum-text-muted">
          Conectado como <span className="font-medium text-gaiamum-text">{resultado.googleEmail}</span>
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

      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
        <h2 className="text-sm font-medium text-gaiamum-text-muted">Novo evento</h2>
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

      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
        <h2 className="text-sm font-medium text-gaiamum-text-muted">Próximos eventos</h2>
        {resultado.eventos.length === 0 ? (
          <p className="mt-3 text-sm text-gaiamum-text-muted">Nenhum evento nos próximos dias.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-5">
            {agruparPorDia(resultado.eventos).map((grupo) => (
              <div key={grupo.chave}>
                <h3
                  className={`text-sm font-semibold ${grupo.eEhHoje ? "text-gaiamum-primary" : "text-gaiamum-text"}`}
                >
                  {grupo.rotulo}
                </h3>
                <div className="mt-2 flex flex-col divide-y divide-gaiamum-border overflow-hidden rounded-lg border border-gaiamum-border">
                  {grupo.eventos.map((evento) => (
                    <a
                      key={evento.id}
                      href={evento.link ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gaiamum-surface-raised"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-gaiamum-primary" />
                      <span className="w-12 shrink-0 text-xs text-gaiamum-text-muted">
                        {formatarHora(evento.inicio)}
                      </span>
                      <span className="text-gaiamum-text">{evento.titulo}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
