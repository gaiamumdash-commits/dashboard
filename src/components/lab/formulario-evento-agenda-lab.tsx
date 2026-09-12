"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { criarEventoAgendaManualLab } from "@/lib/ecc/lab/agenda";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { BotaoFormulario } from "@/components/botao-formulario";
import { GravadorVozAgenda } from "@/components/agenda/gravador-voz-agenda";
import { interpretarFalaAgenda } from "@/lib/ecc/parser-fala-agenda";

/** Duplicata de FormularioEventoAgenda (components/agenda/formulario-evento-agenda.tsx)
 * sem o campo "Avisar"/antecedencia_min (achado #4 do plano — sem alarme no
 * Lab). Chama criarEventoAgendaManualLab e repassa tenantIdLab pro gravador
 * de voz, pra não poluir o consumo de IA do tenant real do usuário (achado #5). */
export function FormularioEventoAgendaLab({ tenantIdLab }: { tenantIdLab: string }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<"digitar" | "falar">("digitar");
  const [transcricaoBruta, setTranscricaoBruta] = useState("");
  const router = useRouter();
  const tituloRef = useRef<HTMLInputElement>(null);
  const inicioRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLInputElement>(null);

  function handleTranscricao(texto: string) {
    setTranscricaoBruta(texto);
    const resultado = interpretarFalaAgenda(texto);
    if (tituloRef.current) tituloRef.current.value = resultado.titulo;
    if (inicioRef.current) inicioRef.current.value = resultado.inicioLocal;
    if (fimRef.current) fimRef.current.value = resultado.fimLocal ?? "";
  }

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
      <div className="mt-3 flex gap-3 text-xs font-medium">
        <button
          type="button"
          onClick={() => setModo("digitar")}
          className={modo === "digitar" ? "text-gaiamum-primary" : "text-gaiamum-text-muted underline"}
        >
          Digitar
        </button>
        <button
          type="button"
          onClick={() => setModo("falar")}
          className={modo === "falar" ? "text-gaiamum-primary" : "text-gaiamum-text-muted underline"}
        >
          Falar por voz
        </button>
      </div>
      {modo === "falar" && (
        <div className="mt-3">
          <GravadorVozAgenda onTranscricaoFinal={handleTranscricao} tenantIdLab={tenantIdLab} />
        </div>
      )}
      <form
        action={async (formData) => {
          setErro(null);
          try {
            await criarEventoAgendaManualLab(formData);
            setAberto(false);
            router.refresh();
          } catch (e) {
            setErro(mensagemDeErro(e, "Falha ao criar compromisso."));
          }
        }}
        className="mt-3 flex flex-col gap-3"
      >
        <input type="hidden" name="fuso" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
        <input type="hidden" name="origem" value={modo === "falar" ? "voz" : "manual"} />
        <input type="hidden" name="transcricao_bruta" value={transcricaoBruta} />
        <input
          ref={tituloRef}
          name="titulo"
          required
          placeholder="Título do compromisso"
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
            Início
            <input
              ref={inicioRef}
              type="datetime-local"
              name="inicio"
              required
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
            Fim (opcional)
            <input
              ref={fimRef}
              type="datetime-local"
              name="fim"
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
            />
          </label>
        </div>
        <BotaoFormulario label="Criar compromisso" labelPendente="Criando..." className="self-start rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60" />
        {erro && <p className="text-sm text-gaiamum-danger">{erro}</p>}
      </form>
    </div>
  );
}
