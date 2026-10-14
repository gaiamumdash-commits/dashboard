"use server";

import "server-only";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { lerMapaMentalComGemini, mensagemDeErroGemini, MODELO_GEMINI_VISAO } from "@/lib/ecc/gemini";
import { registrarConsumoIA } from "@/lib/ecc/ia-consumo";
import { verificarRateLimitIA } from "@/lib/ecc/ia-rate-limit";
import { TAMANHO_MAXIMO_LEITURA_IA, type RamoImportado } from "@/lib/ecc/mapas/importar";
import { mimePelaAssinatura, SCHEMA_MAPA_IA, validarMapaDaIA } from "@/lib/ecc/mapas/importar-ia-regras";

export type ResultadoLeituraMapa = { raiz: RamoImportado; incertos: number; erro: null } | { raiz: null; erro: string };

function falha(erro: string): ResultadoLeituraMapa {
  return { raiz: null, erro };
}

/** Foto/PDF de um mapa mental → árvore validada pra prévia (o navegador
 * mostra, a pessoa revisa e só então `importarMapa` grava). Mesmo padrão de
 * `transcreverAudioParaTexto`: devolve `{erro}` em vez de lançar, checa o
 * rate limit de IA ANTES de chamar o Gemini, não guarda nem registra o
 * arquivo em log. */
export async function lerMapaDeArquivoComIA(formData: FormData): Promise<ResultadoLeituraMapa> {
  try {
    const tenantId = await garantirWorkspace();
    const user = await obterUsuarioAtual();
    if (!user) return falha("Sua sessão expirou. Entre de novo.");

    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof Blob) || arquivo.size === 0) return falha("Nenhum arquivo recebido.");
    if (arquivo.size > TAMANHO_MAXIMO_LEITURA_IA) return falha("Arquivo grande demais — envie até 4 MB (ou só a página do mapa).");

    // O tipo vem dos bytes do arquivo, nunca do que o navegador declarou.
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const mimeType = mimePelaAssinatura(bytes);
    if (!mimeType) return falha("Esse arquivo não é uma imagem (PNG, JPG, WEBP, HEIC) nem um PDF válido.");

    const rateLimit = await verificarRateLimitIA({ userId: user.id, tenantId });
    if (!rateLimit.permitido) return falha(rateLimit.motivo);

    let resultado;
    try {
      resultado = await lerMapaMentalComGemini(Buffer.from(bytes).toString("base64"), mimeType, SCHEMA_MAPA_IA);
    } catch (erroIA) {
      const mensagem = mensagemDeErroGemini(erroIA);
      try {
        await registrarConsumoIA({
          tenantId,
          userId: user.id,
          projetoId: null,
          provedor: "gemini",
          modelo: MODELO_GEMINI_VISAO,
          sucesso: false,
          erro: mensagem,
        });
      } catch {
        // nunca quebra a importação por causa do log
      }
      return falha(mensagem);
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

    const validado = validarMapaDaIA(resultado.texto);
    if (!validado.ok) return falha(validado.erro);
    return { raiz: validado.raiz, incertos: validado.incertos, erro: null };
  } catch (erro) {
    return falha(mensagemDeErroGemini(erro));
  }
}
