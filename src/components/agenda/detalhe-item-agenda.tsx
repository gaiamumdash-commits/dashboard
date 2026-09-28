"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EntidadeAlarme, ItemAgenda } from "@/lib/ecc/tipos";
import { obterAlarme } from "@/lib/ecc/alarmes";
import { editarEventoAgenda, excluirEventoAgenda } from "@/lib/ecc/eventos-agenda";
import { editarEventoGoogleCalendar, excluirEventoGoogleCalendar } from "@/lib/ecc/google-calendar";
import { CampoAlarme, PRESETS_ANTECEDENCIA } from "@/components/campo-alarme";
import { avisarResultadoAgenda } from "@/components/agenda/avisar-sincronizacao";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { toast } from "sonner";
import { APENAS_DATA, RÓTULO_FONTE } from "@/lib/ecc/agenda-apresentacao";

function formatarDataHoraCompleta(item: ItemAgenda): string {
  const ehDiaInteiro = /^\d{4}-\d{2}-\d{2}$/.test(item.quando);
  if (ehDiaInteiro) {
    return new Date(`${item.quando}T00:00:00`).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  const inicio = new Date(item.quando);
  const dataHora = inicio.toLocaleString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!item.fim) return dataHora;

  const fim = new Date(item.fim);
  const horaFim = fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dataHora} até ${horaFim}`;
}

/** ISO (UTC) → valor de `<input type="datetime-local">` no fuso do navegador
 * ("2026-09-02T14:00"). */
function paraInputLocal(iso: string): string {
  const data = new Date(iso);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}T${dois(data.getHours())}:${dois(data.getMinutes())}`;
}

const CLASSE_CAMPO =
  "rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary";

export function DetalheItemAgenda({ item, aoFechar }: { item: ItemAgenda; aoFechar: () => void }) {
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();
  // undefined = ainda carregando; null = sem alarme configurado.
  const [alarme, setAlarme] = useState<number | null | undefined>(undefined);
  const [editando, setEditando] = useState(false);

  // Alarme só existe pra entidades cobertas por `EntidadeAlarme` — google é
  // gerenciado pelo próprio Google, decisão não tem alarme (fora de escopo
  // desta rodada; `alarmes.entidade_tipo` no banco não aceita "decisao").
  const suportaAlarme = item.fonte !== "google" && item.fonte !== "decisao";

  // Compromisso do Gaiamum ou evento do Google com hora marcada podem ser
  // editados/excluídos aqui. Eventos de dia inteiro do Google seguem sendo
  // geridos no próprio Google (o formulário só cobre data + hora).
  const ehEventoGaiamum = item.fonte === "evento_agenda";
  const ehEventoGoogleComHora = item.fonte === "google" && !APENAS_DATA.test(item.quando);
  const podeEditar = ehEventoGaiamum || ehEventoGoogleComHora;
  const podeExcluir = ehEventoGaiamum || item.fonte === "google";

  useEffect(() => {
    if (!suportaAlarme) return;
    let cancelado = false;
    obterAlarme(item.fonte as EntidadeAlarme, item.id).then((resultado) => {
      if (!cancelado) setAlarme(resultado?.antecedencia_min ?? null);
    });
    return () => {
      cancelado = true;
    };
    // `item` muda de identidade a cada abertura (a grade agora monta um
    // `DetalheItemAgenda` novo por item, com `key={item.id}`), então este
    // efeito só roda uma vez por abertura — sem precisar resetar o estado
    // manualmente antes do fetch.
  }, [item, suportaAlarme]);

  function excluir() {
    const aviso = ehEventoGaiamum
      ? "Excluir este compromisso? Se o Google estiver conectado, ele também some do Google Calendar."
      : "Excluir este evento do Google Calendar?";
    if (!window.confirm(aviso)) return;

    iniciarTransicao(async () => {
      try {
        const resultado = ehEventoGaiamum
          ? await excluirEventoAgenda(item.id)
          : await excluirEventoGoogleCalendar(item.id);
        avisarResultadoAgenda(resultado, "Compromisso excluído");
        router.refresh();
        aoFechar();
      } catch (erro) {
        toast.error(mensagemDeErro(erro, "Falha ao excluir."));
      }
    });
  }

  function salvarEdicao(formData: FormData) {
    formData.set("fuso", Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (ehEventoGaiamum) {
      formData.set("evento_id", item.id);
      formData.set("antecedencia_anterior", String(alarme ?? 0));
    } else {
      formData.set("google_event_id", item.id);
    }

    iniciarTransicao(async () => {
      try {
        const resultado = ehEventoGaiamum
          ? await editarEventoAgenda(formData)
          : await editarEventoGoogleCalendar(formData);
        const salvou = avisarResultadoAgenda(resultado, "Compromisso atualizado");
        if (!salvou) return;
        router.refresh();
        aoFechar();
      } catch (erro) {
        toast.error(mensagemDeErro(erro, "Falha ao salvar a alteração."));
      }
    });
  }

  const inicioPadrao = APENAS_DATA.test(item.quando) ? "" : paraInputLocal(item.quando);
  const fimPadrao = item.fim
    ? paraInputLocal(item.fim)
    : ehEventoGoogleComHora
      ? paraInputLocal(new Date(new Date(item.quando).getTime() + 60 * 60_000).toISOString())
      : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onClick={aoFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gaiamum-text">{editando ? "Editar compromisso" : item.titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="px-1 text-gaiamum-text-muted hover:text-gaiamum-text"
          >
            ✕
          </button>
        </div>

        {editando ? (
          <form action={salvarEdicao} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Título
              <input name="titulo" required defaultValue={item.titulo} className={CLASSE_CAMPO} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                Início
                <input type="datetime-local" name="inicio" required defaultValue={inicioPadrao} className={CLASSE_CAMPO} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                Fim {ehEventoGaiamum ? "(opcional)" : ""}
                <input
                  type="datetime-local"
                  name="fim"
                  required={!ehEventoGaiamum}
                  defaultValue={fimPadrao}
                  className={CLASSE_CAMPO}
                />
              </label>
            </div>
            {ehEventoGaiamum && (
              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                Avisar
                {alarme === undefined ? (
                  <span className="text-xs font-normal">Carregando alarme…</span>
                ) : (
                  <select name="antecedencia_min" defaultValue={alarme ?? ""} className={CLASSE_CAMPO}>
                    <option value="">Sem alarme</option>
                    {PRESETS_ANTECEDENCIA.map((p) => (
                      <option key={p.minutos} value={p.minutos}>
                        {p.rotulo}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}
            <div className="mt-1 flex items-center gap-3">
              <button
                type="submit"
                disabled={pendente || (ehEventoGaiamum && alarme === undefined)}
                className="rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {pendente ? "Salvando..." : "Salvar alterações"}
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                disabled={pendente}
                className="text-sm text-gaiamum-text-muted underline hover:text-gaiamum-text"
              >
                Cancelar
              </button>
            </div>
            <p className="text-xs text-gaiamum-text-muted">
              Com o Google conectado, a alteração também é feita no seu Google Calendar.
            </p>
          </form>
        ) : (
          <>
            <p className="mt-1 text-sm capitalize text-gaiamum-text-muted">{formatarDataHoraCompleta(item)}</p>

            <span className="mt-3 inline-block text-[11px] uppercase tracking-wide text-gaiamum-text-muted">
              {RÓTULO_FONTE[item.fonte]}
            </span>

            {item.badge && <p className="mt-2 text-sm text-gaiamum-text">{item.badge}</p>}

            {suportaAlarme && (
              <div className="mt-4">
                {alarme === undefined ? (
                  <p className="text-xs text-gaiamum-text-muted">Carregando alarme…</p>
                ) : (
                  <CampoAlarme
                    entidadeTipo={item.fonte as EntidadeAlarme}
                    entidadeId={item.id}
                    antecedenciaAtual={alarme}
                    caminhoRevalidar="/agenda"
                  />
                )}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              {item.link ? (
                <a
                  href={item.link}
                  target={item.fonte === "google" ? "_blank" : undefined}
                  rel={item.fonte === "google" ? "noreferrer" : undefined}
                  className="text-sm text-gaiamum-primary underline"
                >
                  Ver em {RÓTULO_FONTE[item.fonte]}
                </a>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-4">
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => setEditando(true)}
                    className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-sm font-medium text-gaiamum-text hover:bg-gaiamum-surface-raised"
                  >
                    Editar
                  </button>
                )}
                {podeExcluir && (
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={excluir}
                    className="text-xs text-gaiamum-text-muted underline hover:text-gaiamum-danger disabled:opacity-60"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
