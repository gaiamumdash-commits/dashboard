"use server";

import "server-only";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { lerMapaMentalComGemini, mensagemDeErroGemini, MODELO_GEMINI_PADRAO } from "@/lib/ecc/gemini";
import { registrarConsumoIA } from "@/lib/ecc/ia-consumo";
import { verificarRateLimitIA } from "@/lib/ecc/ia-rate-limit";
import { TAMANHO_MAXIMO_LEITURA_IA } from "@/lib/ecc/mapas/importar";

const TAMANHO_MAXIMO_BYTES = TAMANHO_MAXIMO_LEITURA_IA;
const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];

export type ResultadoLeituraMapa = { markdown: string; erro: null } | { markdown: null; erro: string };

/** Foto/PDF de um mapa mental → Markdown com a hierarquia (o navegador
 * converte em mapa com `lerMarkdown` e grava com `importarMapa`). Mesmo
 * padrão de `transcreverAudioParaTexto`: devolve `{erro}` em vez de lançar,
 * checa o rate limit de IA ANTES de chamar o Gemini e não guarda o arquivo. */
export async function lerMapaDeArquivoComIA(formData: FormData): Promise<ResultadoLeituraMapa> {
  try {
    const tenantId = await garantirWorkspace();
    const user = await obterUsuarioAtual();
    if (!user) return { markdown: null, erro: "Usuário não autenticado." };

    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof Blob) || arquivo.size === 0) return { markdown: null, erro: "Nenhum arquivo recebido." };
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) return { markdown: null, erro: "Arquivo grande demais — envie até 4 MB." };
    const mimeType = arquivo.type;
    if (!TIPOS_ACEITOS.includes(mimeType)) return { markdown: null, erro: "Envie uma foto (PNG, JPG, WEBP, HEIC) ou um PDF." };

    const rateLimit = await verificarRateLimitIA({ userId: user.id, tenantId });
    if (!rateLimit.permitido) return { markdown: null, erro: rateLimit.motivo };

    const base64 = Buffer.from(new Uint8Array(await arquivo.arrayBuffer())).toString("base64");

    let resultado;
    try {
      resultado = await lerMapaMentalComGemini(base64, mimeType);
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
        // nunca quebra a importação por causa do log
      }
      return { markdown: null, erro: mensagemDeErroGemini(erroIA) };
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
      // nunca quebra a importação por causa do log
    }

    // O modelo às vezes embrulha a resposta num bloco ```markdown.
    const markdown = resultado.texto.replace(/^```[a-z]*\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
    if (!markdown || markdown.includes("SEM_MAPA")) {
      return { markdown: null, erro: "Não encontrei um mapa mental nesse arquivo. Tente uma foto mais nítida e de frente." };
    }
    return { markdown, erro: null };
  } catch (erro) {
    return { markdown: null, erro: mensagemDeErroGemini(erro) };
  }
}
