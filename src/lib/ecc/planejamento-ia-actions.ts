"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { verificarRateLimitIA } from "@/lib/ecc/ia-rate-limit";
import { registrarConsumoIA } from "@/lib/ecc/ia-consumo";
import { gerarJsonComGemini, mensagemDeErroGemini, MODELO_GEMINI_PADRAO } from "@/lib/ecc/gemini";
import {
  ConfirmacaoPlanejamentoSchema,
  SCHEMA_RESPOSTA_PLANEJAMENTO_IA,
  TAMANHO_MAXIMO_CONTEXTO,
  construirPromptPlanejamento,
  interpretarRespostaBrutaIA,
  type ResultadoGeracaoSugestoesIA,
} from "@/lib/ecc/planejamento-ia";

/** Mesma regra de `criarProjeto` (actions.ts): só o dono do workspace cria
 * projetos — logo, só ele pode usar o assistente de IA pra planejar um.
 * Extraída aqui pra não duplicar a mensagem entre as duas Server Actions
 * deste arquivo. */
async function exigirOwner(tenantId: string): Promise<void> {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace pode criar projetos novos.");
  }
}

/**
 * Gera a prévia de sugestões de tarefas a partir do contexto descrito pela
 * pessoa (texto ou transcrição de voz já revisada) — NUNCA grava nada no
 * banco; só retorna a lista pra prévia ser revisada/selecionada no cliente.
 * Uma chamada real de IA por invocação explícita (botão "Gerar sugestões"
 * ou "Regenerar") — nunca disparada sozinha ao editar/selecionar/navegar.
 */
export async function gerarSugestoesProjetoIA(
  contexto: string,
  respostasEsclarecimento?: { pergunta: string; resposta: string }[],
): Promise<ResultadoGeracaoSugestoesIA> {
  const tenantId = await garantirWorkspace();
  const user = await obterUsuarioAtual();
  if (!user) {
    return { status: "erro", mensagem: "Usuário não autenticado." };
  }

  try {
    await exigirOwner(tenantId);
  } catch (erro) {
    return { status: "erro", mensagem: erro instanceof Error ? erro.message : "Sem permissão." };
  }

  const contextoLimpo = contexto.trim().slice(0, TAMANHO_MAXIMO_CONTEXTO);
  if (!contextoLimpo) {
    return { status: "erro", mensagem: "Conte um pouco sobre o que você quer realizar." };
  }

  // Rate limit (mesmo padrão de transcricao-audio.ts): checado DEPOIS de
  // validar sessão/permissão/payload, e SEMPRE antes de qualquer chamada
  // real ao Gemini — é isso que impede o gasto, não adianta checar depois.
  const rateLimit = await verificarRateLimitIA({ userId: user.id, tenantId });
  if (!rateLimit.permitido) {
    return { status: "erro", mensagem: rateLimit.motivo };
  }

  const prompt = construirPromptPlanejamento(contextoLimpo, respostasEsclarecimento);

  let jsonBruto: string;
  try {
    const resultado = await gerarJsonComGemini(prompt, SCHEMA_RESPOSTA_PLANEJAMENTO_IA);
    jsonBruto = resultado.texto;
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
      // nunca quebra o planejamento por causa do log de consumo
    }
  } catch (erroIA) {
    const mensagem = mensagemDeErroGemini(erroIA);
    try {
      await registrarConsumoIA({
        tenantId,
        userId: user.id,
        projetoId: null,
        provedor: "gemini",
        modelo: MODELO_GEMINI_PADRAO,
        sucesso: false,
        erro: mensagem,
      });
    } catch {
      // idem
    }
    return { status: "erro", mensagem };
  }

  // Interpretação/validação roda FORA do try acima: um erro de schema aqui
  // não é falha do provedor (já registrada), é resposta malformada — não
  // deve ser logada de novo como uma 2ª falha de chamada.
  return interpretarRespostaBrutaIA(jsonBruto);
}

export type ResultadoCriarProjetoComPlanejamento = { status: "ok"; projetoId: string } | { status: "erro"; mensagem: string };

/**
 * Confirma o planejamento: cria o projeto + colunas padrão + só os cartões
 * selecionados (com checklist) na coluna "Tarefas", tudo numa única operação
 * atômica e idempotente (RPC `criar_projeto_planejado_ia`, migration 0051).
 *
 * Revalida a prévia editada AQUI de novo (zod) — a prévia que chega já
 * passou pela validação da geração, mas a pessoa pode ter editado título/
 * descrição/checklist ou adicionado tarefas manuais depois; "o navegador
 * não é fonte de autorização".
 */
export async function criarProjetoComPlanejamentoIA(input: unknown): Promise<ResultadoCriarProjetoComPlanejamento> {
  const tenantId = await garantirWorkspace();
  const user = await obterUsuarioAtual();
  if (!user) {
    return { status: "erro", mensagem: "Usuário não autenticado." };
  }

  try {
    await exigirOwner(tenantId);
  } catch (erro) {
    return { status: "erro", mensagem: erro instanceof Error ? erro.message : "Sem permissão." };
  }

  const validado = ConfirmacaoPlanejamentoSchema.safeParse(input);
  if (!validado.success) {
    return { status: "erro", mensagem: "Os dados do planejamento ficaram num formato inesperado — recarregue e tente de novo." };
  }

  const { nome, descricao, idempotencyKey, tarefas } = validado.data;
  const supabase = await createClient();

  const { data: projetoId, error } = await supabase.rpc("criar_projeto_planejado_ia", {
    p_tenant_id: tenantId,
    p_nome: nome,
    p_descricao: descricao || null,
    p_idempotency_key: idempotencyKey,
    // Só título/descrição/checklist seguem pro banco — nenhum id de
    // tenant/usuário/coluna/responsável do "lado da IA" é aceito aqui
    // (a função no banco resolve tudo isso sozinha).
    p_tarefas: tarefas.map((t) => ({ titulo: t.titulo, descricao: t.descricao || null, checklist: t.checklist })),
  });

  if (error || !projetoId) {
    return { status: "erro", mensagem: `Falha ao criar o projeto: ${error?.message ?? "erro desconhecido"}. Sua prévia não foi perdida — tente confirmar de novo.` };
  }

  revalidatePath("/projetos");
  revalidatePath(`/projetos/${projetoId}/tarefas`);

  return { status: "ok", projetoId: projetoId as string };
}
