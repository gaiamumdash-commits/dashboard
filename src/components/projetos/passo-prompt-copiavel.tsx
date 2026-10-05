"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { SugestaoTarefaIA } from "@/lib/ecc/planejamento-ia";
import {
  construirPromptCopiavel,
  FRASE_REFAZER_BLOCO,
  interpretarRespostaColada,
  LINKS_IAS,
  TAMANHO_MAXIMO_OBJETIVO,
  TAMANHO_MAXIMO_RESPOSTA_COLADA,
} from "@/lib/ecc/planejamento-prompt";

const ESTILO_INPUT =
  "w-full rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary";
const ESTILO_BOTAO_PRIMARIO =
  "rounded-lg bg-gaiamum-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60";
const ESTILO_BOTAO_SECUNDARIO =
  "rounded-lg border border-gaiamum-border px-4 py-2 text-sm font-medium text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text";

type Rascunho = { objetivo: string; colado: string };

/** Rascunho local (por aparelho) — o caso mais comum, principalmente no
 * celular, é sair desta tela pra ir copiar a resposta na outra IA. */
function lerRascunho(chave: string): Rascunho | null {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as Rascunho) : null;
  } catch {
    return null;
  }
}

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function Numero({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gaiamum-primary text-xs font-semibold text-white">{n}</span>
  );
}

/**
 * "Planejar na sua IA" em 3 passos: ① descrever e copiar o prompt, ② conversar
 * na IA preferida, ③ colar a resposta final. Só passa adiante (`aoLerPlano`)
 * quando o texto colado vira uma prévia válida.
 */
export function PassoPromptCopiavel({
  nomeProjeto,
  objetivoInicial = "",
  chaveRascunho,
  aoLerPlano,
  rodape,
}: {
  nomeProjeto: string;
  objetivoInicial?: string;
  chaveRascunho: string;
  aoLerPlano: (sugestoes: SugestaoTarefaIA[], descartados: number) => void;
  /** Botões de Voltar/Pular de quem usa este passo. */
  rodape?: ReactNode;
}) {
  // Montado só no cliente (dentro do modal aberto por clique) — dá pra ler o
  // rascunho direto no estado inicial, sem risco de hidratação diferente.
  const [rascunho] = useState(() => lerRascunho(chaveRascunho));
  const [objetivo, setObjetivo] = useState(rascunho?.objetivo || objetivoInicial);
  const [colado, setColado] = useState(rascunho?.colado ?? "");
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; podeRefazerBloco: boolean } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(chaveRascunho, JSON.stringify({ objetivo, colado }));
    } catch {
      // sem storage (aba privada): só não guarda o rascunho
    }
  }, [chaveRascunho, objetivo, colado]);

  async function copiarPrompt() {
    if (await copiarTexto(construirPromptCopiavel(nomeProjeto, objetivo))) {
      setCopiado(true);
      toast.success("Prompt copiado! Agora cole na sua IA.");
      setTimeout(() => setCopiado(false), 3000);
    } else {
      toast.error("O navegador não deixou copiar. Selecione o texto do prompt e copie manualmente.");
    }
  }

  function lerResposta() {
    const resultado = interpretarRespostaColada(colado);
    if (resultado.status === "erro") {
      setErro({ mensagem: resultado.mensagem, podeRefazerBloco: resultado.podeRefazerBloco });
      return;
    }
    setErro(null);
    try {
      localStorage.removeItem(chaveRascunho);
    } catch {
      // idem
    }
    aoLerPlano(resultado.sugestoes, resultado.descartados);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-gaiamum-warning/40 bg-gaiamum-warning/10 px-3 py-2 text-xs text-gaiamum-text">
        🔒 Não cole dados sensíveis na IA externa (CPF, senhas, dados bancários, de saúde ou de clientes). Use papéis no lugar de
        nomes, se preferir. O prompt leva só o que você escrever aqui.
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Numero n={1} />
          <p className="text-sm font-medium text-gaiamum-text">Descreva o objetivo em 1 a 3 frases e copie o prompt</p>
        </div>
        <textarea
          rows={3}
          maxLength={TAMANHO_MAXIMO_OBJETIVO}
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          placeholder="Ex.: Quero lançar meu curso online de confeitaria em 3 meses, sozinho, com orçamento de R$ 2.000."
          className={ESTILO_INPUT}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copiarPrompt} className={ESTILO_BOTAO_PRIMARIO}>
            {copiado ? "✓ Copiado!" : "📋 Copiar prompt"}
          </button>
          <span className="text-xs text-gaiamum-text-muted">Abrir:</span>
          {LINKS_IAS.map((ia) => (
            <a
              key={ia.nome}
              href={ia.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-gaiamum-border px-3 py-1 text-xs text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text"
            >
              {ia.nome} ↗
            </a>
          ))}
        </div>
      </section>

      <section className="flex items-start gap-2">
        <Numero n={2} />
        <p className="text-sm text-gaiamum-text">
          Cole o prompt na IA, responda as perguntas dela e, quando o plano estiver bom, peça o bloco final.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Numero n={3} />
          <p className="text-sm font-medium text-gaiamum-text">Cole aqui a resposta final da IA</p>
        </div>
        <textarea
          rows={5}
          maxLength={TAMANHO_MAXIMO_RESPOSTA_COLADA}
          value={colado}
          onChange={(e) => {
            setColado(e.target.value);
            setErro(null);
          }}
          placeholder="Pode colar a resposta inteira — o Gaiamum acha o bloco do plano sozinho."
          className={ESTILO_INPUT}
        />
        {erro && (
          <div className="flex flex-col gap-2 rounded-lg border border-gaiamum-danger/40 bg-gaiamum-danger/10 px-3 py-2">
            <p className="text-sm text-gaiamum-danger">{erro.mensagem}</p>
            {erro.podeRefazerBloco && (
              <button
                type="button"
                onClick={async () => {
                  if (await copiarTexto(FRASE_REFAZER_BLOCO)) toast.success("Frase copiada — cole na sua IA.");
                }}
                className={`self-start ${ESTILO_BOTAO_SECUNDARIO}`}
              >
                Copiar o pedido pra IA refazer o bloco
              </button>
            )}
          </div>
        )}
        <button type="button" onClick={lerResposta} disabled={!colado.trim()} className={`self-end ${ESTILO_BOTAO_PRIMARIO}`}>
          Ver o plano
        </button>
      </section>

      {rodape}
    </div>
  );
}
