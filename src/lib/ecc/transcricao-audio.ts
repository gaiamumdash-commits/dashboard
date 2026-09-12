"use server";

import "server-only";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { transcreverAudioComGemini, mensagemDeErroGemini, MODELO_GEMINI_PADRAO } from "@/lib/ecc/gemini";
import { registrarConsumoIA } from "@/lib/ecc/ia-consumo";

const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB — generoso pra ~25s de áudio de voz, bem abaixo do limite de payload de Server Actions (16MB, ver next.config.ts).

export type ResultadoTranscricaoAudio = { texto: string; erro: null } | { texto: null; erro: string };

/** Transcreve o áudio gravado no navegador (fluxo de voz da Agenda quando a
 * Web Speech API não está disponível, ex.: Safari/iOS) — devolve `{erro}`
 * em vez de lançar exceção, mesmo padrão de `gerarExplicacaoAlinhamento`
 * (Next.js redige a mensagem de erros lançados em Server Actions em
 * produção). Não persiste o áudio em lugar nenhum — processa em memória e
 * descarta; só o texto transcrito segue adiante. */
export async function transcreverAudioParaTexto(
  formData: FormData,
  tenantIdOverride?: string,
): Promise<ResultadoTranscricaoAudio> {
  try {
    const tenantId = tenantIdOverride ?? (await garantirWorkspace());
    const user = await obterUsuarioAtual();
    if (!user) {
      return { texto: null, erro: "Usuário não autenticado." };
    }

    const audio = formData.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return { texto: null, erro: "Nenhum áudio recebido." };
    }
    if (audio.size > TAMANHO_MAXIMO_BYTES) {
      return { texto: null, erro: "Áudio muito longo — grave uma frase mais curta." };
    }

    const bytes = new Uint8Array(await audio.arrayBuffer());
    const audioBase64 = Buffer.from(bytes).toString("base64");
    const mimeType = audio.type || "audio/webm";

    let resultado;
    try {
      resultado = await transcreverAudioComGemini(audioBase64, mimeType);
    } catch (erroIA) {
      try {
        await registrarConsumoIA({
          tenantId,
          userId: user.id,
          projetoId: null,
          provedor: "gemini",
          modelo: MODELO_GEMINI_PADRAO,
          sucesso: false,
          erro: mensagemDeErroGemini(erroIA),
        });
      } catch {
        // nunca quebra a transcrição em si por causa do log
      }
      return { texto: null, erro: mensagemDeErroGemini(erroIA) };
    }

    try {
      await registrarConsumoIA({
        tenantId,
        userId: user.id,
        projetoId: null,
        provedor: resultado.provedor,
        modelo: resultado.modelo,
        sucesso: true,
        promptTokens: resultado.uso?.promptTokens ?? null,
        candidatesTokens: resultado.uso?.candidatesTokens ?? null,
        totalTokens: resultado.uso?.totalTokens ?? null,
      });
    } catch {
      // nunca quebra a transcrição em si por causa do log
    }

    if (!resultado.texto.trim()) {
      return { texto: null, erro: "Não conseguimos entender o áudio. Tenta de novo ou digite manualmente." };
    }

    return { texto: resultado.texto, erro: null };
  } catch (erro) {
    return { texto: null, erro: mensagemDeErroGemini(erro) };
  }
}
