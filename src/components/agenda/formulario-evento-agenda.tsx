"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { criarEventoAgendaManual } from "@/lib/ecc/eventos-agenda";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { BotaoFormulario } from "@/components/botao-formulario";
import { GravadorVozAgenda } from "@/components/agenda/gravador-voz-agenda";
import { interpretarFalaAgenda } from "@/lib/ecc/parser-fala-agenda";

/** Opções fixas do <select> de antecedência — usado tanto pro valor
 * default quanto pra "encaixar" o resultado livre em minutos que o
 * parser de voz devolve na opção mais próxima existente. */
const OPCOES_ANTECEDENCIA_MIN = [15, 60, 180, 1440, 4320];

function snapAntecedencia(min: number): string {
  if (min <= 0) return "";
  let maisProxima = OPCOES_ANTECEDENCIA_MIN[0];
  let menorDiferenca = Math.abs(min - maisProxima);
  for (const opcao of OPCOES_ANTECEDENCIA_MIN.slice(1)) {
    const diferenca = Math.abs(min - opcao);
    if (diferenca < menorDiferenca) {
      menorDiferenca = diferenca;
      maisProxima = opcao;
    }
  }
  return String(maisProxima);
}

/** Botão flutuante + formulário curto de criação rápida de compromisso —
 * pedido do Fabio pra não precisar navegar até um formulário maior só pra
 * marcar algo simples. Sem modal/overlay (o projeto não tem esse padrão
 * ainda) — o botão só expande um cartão inline logo acima da lista. */
export function FormularioEventoAgenda() {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<"digitar" | "falar">("digitar");
  const [transcricaoBruta, setTranscricaoBruta] = useState("");
  const [mesmoDia, setMesmoDia] = useState(true);
  const router = useRouter();
  const tituloRef = useRef<HTMLInputElement>(null);
  const inicioRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLInputElement>(null);
  const fimHoraRef = useRef<HTMLInputElement>(null);
  const antecedenciaRef = useRef<HTMLSelectElement>(null);

  // "Mesmo dia" (padrão, evento pontual é o caso comum): a pessoa só digita
  // a hora de término, a data vem copiada do Início na hora de montar o
  // datetime-local completo pro campo escondido que o form realmente envia
  // — evita digitar a mesma data duas vezes.
  function fimCompleto(): string {
    if (!mesmoDia) return fimRef.current?.value ?? "";
    const dataInicio = inicioRef.current?.value.split("T")[0];
    const horaFim = fimHoraRef.current?.value;
    if (!dataInicio || !horaFim) return "";
    return `${dataInicio}T${horaFim}`;
  }

  function handleTranscricao(texto: string) {
    setTranscricaoBruta(texto);
    const resultado = interpretarFalaAgenda(texto);
    if (tituloRef.current) tituloRef.current.value = resultado.titulo;
    if (inicioRef.current) inicioRef.current.value = resultado.inicioLocal;
    if (fimRef.current) fimRef.current.value = resultado.fimLocal ?? "";
    if (antecedenciaRef.current) antecedenciaRef.current.value = snapAntecedencia(resultado.antecedenciaMin);

    // Se a fala trouxe um fim em dia diferente do início, "mesmo dia"
    // deixaria de fazer sentido (esconderia a data real do fim) — volta pro
    // campo completo nesse caso; senão, só copia a hora extraída.
    const dataInicio = resultado.inicioLocal.split("T")[0];
    const dataFim = resultado.fimLocal?.split("T")[0];
    const ehMesmoDia = !dataFim || dataFim === dataInicio;
    setMesmoDia(ehMesmoDia);
    if (ehMesmoDia && fimHoraRef.current) {
      fimHoraRef.current.value = resultado.fimLocal?.split("T")[1] ?? "";
    }
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
          <GravadorVozAgenda onTranscricaoFinal={handleTranscricao} />
        </div>
      )}
      <form
        action={async (formData) => {
          setErro(null);
          formData.set("fim", mesmoDia ? fimCompleto() : (fimRef.current?.value ?? ""));
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
            <span className="flex items-center justify-between gap-2">
              <span>Fim {mesmoDia ? "(hora)" : "(opcional)"}</span>
              <span className="flex items-center gap-1 text-[11px] font-normal normal-case text-gaiamum-text-muted">
                <input
                  type="checkbox"
                  checked={mesmoDia}
                  onChange={(e) => setMesmoDia(e.target.checked)}
                  className="h-3 w-3"
                />
                📆 Mesmo dia
              </span>
            </span>
            {/* Os dois inputs ficam sempre montados (só a visibilidade muda)
                pra handleTranscricao (voz) sempre ter uma ref válida pra
                preencher, independente de qual modo estava ativo antes. */}
            <input
              ref={fimHoraRef}
              type="time"
              hidden={!mesmoDia}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
            />
            <input
              ref={fimRef}
              type="datetime-local"
              hidden={mesmoDia}
              className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
          Avisar
          <select
            ref={antecedenciaRef}
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
        <BotaoFormulario label="Criar compromisso" labelPendente="Criando..." className="self-start rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60" />
        {erro && <p className="text-sm text-gaiamum-danger">{erro}</p>}
      </form>
    </div>
  );
}
