"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarEventoAgendaManual } from "@/lib/ecc/eventos-agenda";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { BotaoFormulario } from "@/components/botao-formulario";

/** Botão flutuante + formulário curto de criação rápida de compromisso —
 * pedido do Fabio pra não precisar navegar até um formulário maior só pra
 * marcar algo simples. Sem modal/overlay (o projeto não tem esse padrão
 * ainda) — o botão só expande um cartão inline logo acima da lista. */
export function FormularioEventoAgenda() {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Novo compromisso"
        className="fixed bottom-6 right-6 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-gaiamum-primary text-2xl font-semibold text-white shadow-lg transition hover:opacity-90"
      >
        +
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gaiamum-text-muted">Novo compromisso</h2>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-xs text-gaiamum-text-muted underline hover:text-gaiamum-text"
        >
          Fechar
        </button>
      </div>
      <form
        action={async (formData) => {
          setErro(null);
          try {
            await criarEventoAgendaManual(formData);
            setAberto(false);
            router.refresh();
          } catch (e) {
            setErro(mensagemDeErro(e, "Falha ao criar compromisso."));
          }
        }}
        className="mt-3 flex flex-col gap-3"
      >
        {/* Mesmo princípio de fuso já usado em criarEventoGoogleCalendar:
            nunca resolver no servidor, sempre repassar o fuso do navegador. */}
        <input type="hidden" name="fuso" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
        <input
          name="titulo"
          required
          placeholder="Título do compromisso"
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
            Quando
            <input
              type="datetime-local"
              name="inicio"
              required
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
            Avisar
            <select
              name="antecedencia_min"
              defaultValue=""
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
            >
              <option value="">Sem alarme</option>
              <option value="15">15 minutos antes</option>
              <option value="60">1 hora antes</option>
              <option value="180">3 horas antes</option>
              <option value="1440">1 dia antes</option>
              <option value="4320">3 dias antes</option>
            </select>
          </label>
        </div>
        <BotaoFormulario label="Criar compromisso" labelPendente="Criando..." className="self-start rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60" />
        {erro && <p className="text-sm text-gaiamum-danger">{erro}</p>}
      </form>
    </div>
  );
}
