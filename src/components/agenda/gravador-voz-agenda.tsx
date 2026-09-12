"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { transcreverAudioParaTexto } from "@/lib/ecc/transcricao-audio";

/** Duração máxima de gravação de áudio (Safari/iOS) — mantém o áudio curto
 * o bastante pra não pesar na transcrição nem no custo do free tier do
 * Gemini; frases de compromisso são naturalmente curtas. */
const DURACAO_MAXIMA_GRAVACAO_MS = 25_000;

/** Tipos mínimos da Web Speech API — não existe em lib.dom.d.ts, cobre só
 * o subconjunto usado aqui (sem pacote novo, a API inteira é bem maior). */
type ResultadoReconhecimentoDeVoz = { transcript: string };

interface EventoReconhecimentoDeVoz extends Event {
  results: {
    [index: number]: { [index: number]: ResultadoReconhecimentoDeVoz; isFinal: boolean };
    length: number;
  };
}

interface MotorReconhecimentoDeVoz extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: EventoReconhecimentoDeVoz) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type ConstrutorReconhecimentoDeVoz = new () => MotorReconhecimentoDeVoz;

declare global {
  interface Window {
    SpeechRecognition?: ConstrutorReconhecimentoDeVoz;
    webkitSpeechRecognition?: ConstrutorReconhecimentoDeVoz;
  }
}

function mensagemDeErroReconhecimento(codigo: string): string {
  switch (codigo) {
    case "not-allowed":
    case "permission-denied":
      return "Permissão de microfone negada. Habilite o microfone nas configurações do navegador.";
    case "no-speech":
      return "Não conseguimos ouvir nada. Tenta falar de novo, mais perto do microfone.";
    case "network":
      return "Falha de rede no reconhecimento de voz. Verifica sua conexão e tenta de novo.";
    default:
      return "Não foi possível reconhecer a fala. Tenta de novo ou digite manualmente abaixo.";
  }
}

function suportaReconhecimentoDeVoz(): boolean {
  return typeof window !== "undefined" && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

/** Caminho pro Safari/iOS (e qualquer outro navegador sem Web Speech API,
 * mas com gravação de áudio): grava um Blob e manda pro servidor
 * transcrever via Gemini, em vez de reconhecer a fala no próprio cliente. */
function suportaGravacaoDeAudio(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder;
}

/** Sem subscrição real — o suporte do navegador não muda depois do mount,
 * só precisamos do valor certo sem divergir do HTML gerado no servidor
 * (que nunca tem `window`). Ver react-hooks/set-state-in-effect. */
function inscreverSuporteVoz(): () => void {
  return () => {};
}

function mensagemDeErroGravacaoAudio(erro: unknown): string {
  if (erro instanceof DOMException && (erro.name === "NotAllowedError" || erro.name === "SecurityError")) {
    return "Permissão de microfone negada. Habilite o microfone nas configurações do navegador.";
  }
  return "Não foi possível gravar áudio. Tenta de novo ou digite manualmente abaixo.";
}

/** Gravação e transcrição de voz pra criação rápida de compromisso —
 * entrega só o texto reconhecido pro pai via `onTranscricaoFinal`, quem
 * decide o que fazer com ele (rodar o parser e preencher o formulário)
 * é o componente que usa este. */
export function GravadorVozAgenda({
  onTranscricaoFinal,
  tenantIdLab,
}: {
  onTranscricaoFinal: (texto: string) => void;
  tenantIdLab?: string;
}) {
  const suportado = useSyncExternalStore(inscreverSuporteVoz, suportaReconhecimentoDeVoz, () => false);
  const suportaAudio = useSyncExternalStore(inscreverSuporteVoz, suportaGravacaoDeAudio, () => false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [textoManual, setTextoManual] = useState("");
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const motorRef = useRef<MotorReconhecimentoDeVoz | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const timeoutGravacaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      motorRef.current?.stop();
      gravadorRef.current?.stop();
      streamRef.current?.getTracks().forEach((faixa) => faixa.stop());
      if (timeoutGravacaoRef.current) clearTimeout(timeoutGravacaoRef.current);
    };
  }, []);

  async function iniciarGravacaoAudio() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const chunks: BlobPart[] = [];
      const gravador = new MediaRecorder(stream);
      gravador.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      gravador.onstop = async () => {
        streamRef.current?.getTracks().forEach((faixa) => faixa.stop());
        streamRef.current = null;
        setGravandoAudio(false);
        const blob = new Blob(chunks, { type: gravador.mimeType || "audio/webm" });
        setTranscrevendo(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "gravacao");
          const resultado = await transcreverAudioParaTexto(formData, tenantIdLab);
          if (resultado.erro !== null) {
            setErro(resultado.erro);
          } else {
            onTranscricaoFinal(resultado.texto);
          }
        } catch {
          setErro("Falha ao transcrever o áudio. Tenta de novo ou digite manualmente abaixo.");
        } finally {
          setTranscrevendo(false);
        }
      };
      gravadorRef.current = gravador;
      gravador.start();
      setGravandoAudio(true);
      timeoutGravacaoRef.current = setTimeout(() => pararGravacaoAudio(), DURACAO_MAXIMA_GRAVACAO_MS);
    } catch (erroPermissao) {
      setErro(mensagemDeErroGravacaoAudio(erroPermissao));
    }
  }

  function pararGravacaoAudio() {
    if (timeoutGravacaoRef.current) {
      clearTimeout(timeoutGravacaoRef.current);
      timeoutGravacaoRef.current = null;
    }
    gravadorRef.current?.stop();
  }

  function iniciarGravacao() {
    const Construtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Construtor) return;
    setErro(null);
    const motor = new Construtor();
    motor.lang = "pt-BR";
    motor.continuous = false;
    motor.interimResults = false;
    motor.onresult = (ev) => {
      const ultimoResultado = ev.results[ev.results.length - 1];
      const transcript = ultimoResultado?.[0]?.transcript ?? "";
      if (transcript.trim()) onTranscricaoFinal(transcript);
      setGravando(false);
    };
    motor.onerror = (ev) => {
      setErro(mensagemDeErroReconhecimento(ev.error));
      setGravando(false);
    };
    motor.onend = () => setGravando(false);
    motorRef.current = motor;
    motor.start();
    setGravando(true);
  }

  function pararGravacao() {
    motorRef.current?.stop();
    setGravando(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised p-3">
      <p className="text-xs text-gaiamum-text-muted">Dica: funciona melhor no Google Chrome.</p>
      {suportado && (
        <button
          type="button"
          onClick={gravando ? pararGravacao : iniciarGravacao}
          className={`self-start rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 ${
            gravando ? "bg-gaiamum-danger" : "bg-gaiamum-primary"
          }`}
        >
          {gravando ? "🔴 Gravando... toque pra parar" : "🎤 Falar"}
        </button>
      )}
      {suportado === false && suportaAudio && (
        <button
          type="button"
          onClick={gravandoAudio ? pararGravacaoAudio : iniciarGravacaoAudio}
          disabled={transcrevendo}
          className={`self-start rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 ${
            gravandoAudio ? "bg-gaiamum-danger" : "bg-gaiamum-primary"
          }`}
        >
          {transcrevendo ? "Transcrevendo..." : gravandoAudio ? "🔴 Gravando... toque pra parar" : "🎤 Gravar áudio"}
        </button>
      )}
      {suportado === false && !suportaAudio && (
        <p className="text-xs text-gaiamum-text-muted">
          Esse navegador não tem suporte a reconhecimento de voz nem a gravação de áudio — digite o texto abaixo.
        </p>
      )}
      {erro && <p className="text-sm text-gaiamum-danger">{erro}</p>}
      {(suportado === false || erro) && (
        <div className="flex flex-col gap-2">
          <textarea
            value={textoManual}
            onChange={(e) => setTextoManual(e.target.value)}
            placeholder="Ex: reunião com o dentista amanhã às 15h, me avisa 1 hora antes"
            rows={2}
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
          <button
            type="button"
            onClick={() => textoManual.trim() && onTranscricaoFinal(textoManual)}
            className="self-start rounded-lg border border-gaiamum-border px-3 py-1.5 text-xs font-medium text-gaiamum-text transition hover:border-gaiamum-primary"
          >
            Usar este texto
          </button>
        </div>
      )}
    </div>
  );
}
