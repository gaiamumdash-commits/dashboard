import "server-only";
import { GoogleGenAI, ApiError, createPartFromBase64 } from "@google/genai";
import type { ProvedorIA, ResultadoGeracaoIA } from "@/lib/ecc/provedor-ia";

/** Modelo padrão do provedor Gemini — decisão explícita (2026-09-09): rápido
 * e econômico, adequado ao free tier usado nesta fase de validação (Etapa 3
 * do Contexto Vivo). Trocar aqui se a qualidade não bastar.
 * `gemini-2.5-flash` foi descontinuado pra chaves novas (confirmado ao vivo
 * durante o teste desta sessão, API devolvia 404 "no longer available to
 * new users") — trocado por `gemini-3.1-flash-lite`, testado e funcionando. */
export const MODELO_GEMINI_PADRAO = "gemini-3.1-flash-lite";

function obterClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("A chave de API do Gemini (GEMINI_API_KEY) não está configurada.");
  }
  return new GoogleGenAI({ apiKey });
}

/** Implementação concreta de `ProvedorIA` usando a API do Gemini. */
export const gerarTextoComGemini: ProvedorIA["gerarTexto"] = async (prompt: string) => {
  const ai = obterClient();
  const response = await ai.models.generateContent({
    model: MODELO_GEMINI_PADRAO,
    contents: prompt,
  });

  if (!response.text) {
    throw new Error("O Gemini não devolveu nenhum texto.");
  }

  return {
    texto: response.text,
    provedor: "gemini",
    modelo: MODELO_GEMINI_PADRAO,
    uso: {
      promptTokens: response.usageMetadata?.promptTokenCount,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount,
      totalTokens: response.usageMetadata?.totalTokenCount,
    },
  };
};

/** O Gemini documenta `audio/aac` como MIME type de áudio aceito, mas não
 * `audio/mp4` — que é o que o `MediaRecorder` do Safari/iOS produz (mesmo
 * dado bruto AAC, só o rótulo do contêiner muda). Sem isso, a chamada
 * arriscaria ser rejeitada só por causa do MIME declarado. */
function normalizarMimeTypeAudio(mimeType: string): string {
  return mimeType.startsWith("audio/mp4") ? "audio/aac" : mimeType;
}

/** Transcreve um áudio curto (gravado no navegador) pra texto puro em
 * português — usado pelo fluxo de voz da Agenda quando o navegador não
 * suporta a Web Speech API (Safari/iOS). O texto devolvido segue pro mesmo
 * parser determinístico (`interpretarFalaAgenda`) já usado pelo caminho de
 * Web Speech — só a origem do texto muda, o resto do pipeline é idêntico. */
export async function transcreverAudioComGemini(audioBase64: string, mimeType: string): Promise<ResultadoGeracaoIA> {
  const ai = obterClient();
  const parteAudio = createPartFromBase64(audioBase64, normalizarMimeTypeAudio(mimeType));
  const prompt =
    "Transcreva literalmente o que a pessoa fala neste áudio, em português. " +
    "Devolva só a transcrição, sem nenhum comentário, formatação ou explicação adicional.";

  const response = await ai.models.generateContent({
    model: MODELO_GEMINI_PADRAO,
    contents: [{ role: "user", parts: [{ text: prompt }, parteAudio] }],
  });

  if (!response.text) {
    throw new Error("O Gemini não devolveu nenhuma transcrição.");
  }

  return {
    texto: response.text.trim(),
    provedor: "gemini",
    modelo: MODELO_GEMINI_PADRAO,
    uso: {
      promptTokens: response.usageMetadata?.promptTokenCount,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount,
      totalTokens: response.usageMetadata?.totalTokenCount,
    },
  };
}

/** Mensagem amigável pro usuário a partir de uma exceção do SDK — cadeia
 * mais-específico-primeiro, mesmo espírito de `mensagemDeErroIA` em `ia.ts`. */
export function mensagemDeErroGemini(erro: unknown): string {
  if (erro instanceof ApiError) {
    if (erro.status === 401 || erro.status === 403) {
      return "A chave de API do Gemini não está configurada corretamente ou é inválida.";
    }
    if (erro.status === 429) {
      return "O limite gratuito do Gemini foi atingido por agora — tente de novo em alguns minutos.";
    }
    return `O Gemini não respondeu (${erro.status}) — tente de novo.`;
  }
  if (erro instanceof Error) {
    return erro.message;
  }
  return "Falha inesperada ao falar com a IA.";
}
