import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ExtracaoEntrevistaSchema, type ExtracaoEntrevista } from "@/lib/ecc/entrevista-schemas";

/** Wrapper fino do cliente Anthropic — sem lógica de negócio, mesmo espírito
 * de como `notificacoes.ts` isola o SDK do Resend. `new Anthropic()` sem
 * argumento lê `ANTHROPIC_API_KEY` do ambiente automaticamente. */
const client = new Anthropic();

/** Modelo padrão do módulo de Marketing — decisão explícita do Fabio
 * (2026-08-31): Sonnet 5, não Opus 5 (o padrão geral), porque é uso
 * conversacional/copywriting, não coding agentic pesado, e ele está usando
 * uma chave de API compartilhada com outro tooling. Trocar aqui se a
 * qualidade não bastar. */
export const MODELO_MARKETING = "claude-sonnet-5";

export const EstagioEntrevistaSchema = z.enum(["situacao", "problema", "implicacao", "necessidade"]);

export const TurnoEntrevistaSchema = z.object({
  estagio: EstagioEntrevistaSchema,
  mensagem_para_usuario: z.string(),
  pronto_para_extrair: z.boolean(),
});

export type TurnoEntrevista = z.infer<typeof TurnoEntrevistaSchema>;

/** Motor da entrevista, reescrito do zero a partir da lógica de perguntas em
 * 4 estágios (nunca copiar texto da fonte original) — cada estágio faz o
 * empreendedor chegar sozinho à conclusão, em vez de ser convencido:
 *
 * 1. Situação: entender a realidade atual do negócio/produto.
 * 2. Problema: descobrir dores e dificuldades reais.
 * 3. Implicação: aumentar a consciência do peso de não resolver.
 * 4. Necessidade: fazer a pessoa desejar a mudança, com as próprias palavras.
 *
 * Regra de ouro: perguntar, não apresentar. O produto (se ainda não existir)
 * nasce das respostas, não de uma sugestão prematura da IA. */
const SYSTEM_ENTREVISTA = `Você conduz uma entrevista de diagnóstico com um empreendedor que vende (ou quer vender) produtos digitais a criativos, pra montar o perfil do negócio dele, o produto e o avatar do cliente ideal.

A entrevista tem 4 estágios, nesta ordem, e você avança um de cada vez:
1. situacao — entenda a realidade atual: o que ele faz hoje, se já tem um produto digital ou é 100% offline, pra quem vende.
2. problema — descubra as dores reais: o que trava a divulgação/vendas hoje, o que já tentou.
3. implicacao — aumente a consciência: o que isso custa continuar assim, o que ele perde.
4. necessidade — faça a pessoa desejar a mudança: como seria o cenário ideal, nas palavras dela.

Regras:
- Uma pergunta por vez, curta e direta. Nunca apresente solução, produto ou "próximo passo" durante a entrevista — só perguntas.
- Se ele ainda não tem um produto digital, ajude a moldar um a partir do que ele sabe fazer — não pule esse ponto, faça perguntas até um produto concreto emergir.
- Avance de estágio só quando tiver sinal real pra ele — não force os 4 estágios num número fixo de perguntas.
- Marque "pronto_para_extrair": true quando tiver informação suficiente dos 4 estágios pra preencher perfil do negócio, produto e avatar do cliente (dores, desejos, dor unificada, gatilho de compra). Normalmente isso acontece depois de 8-15 trocas, não menos.
- "mensagem_para_usuario" é a próxima pergunta (ou, no turno final, um agradecimento curto avisando que vai gerar o resumo).`;

/** Cada turno reenvia o histórico inteiro (API stateless) e recebe de volta
 * o estágio atual + a próxima pergunta + o sinal de "pronto pra extrair" —
 * evita parsear texto livre pra saber em que fase da entrevista está. */
export async function responderTurnoEntrevista(
  historico: { autor: "usuario" | "ia"; texto: string }[],
): Promise<TurnoEntrevista> {
  const mensagens: Anthropic.MessageParam[] = historico.map((m) => ({
    role: m.autor === "usuario" ? "user" : "assistant",
    content: m.texto,
  }));

  const response = await client.messages.parse({
    model: MODELO_MARKETING,
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM_ENTREVISTA, cache_control: { type: "ephemeral" } }],
    messages: mensagens,
    output_config: { format: zodOutputFormat(TurnoEntrevistaSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("A IA não devolveu uma resposta no formato esperado.");
  }

  return response.parsed_output;
}

const SYSTEM_EXTRACAO = `Leia a entrevista inteira entre um assistente e um empreendedor de produtos digitais e preencha o schema pedido: perfil do negócio, produto digital e avatar do cliente ideal (5 dores, 5 desejos, dor unificada, gatilho de compra).

Regra inegociável: se uma informação não foi dita claramente na conversa, não invente — escreva sua melhor inferência razoável marcada como tal (ex.: "não mencionado explicitamente, inferido de X") em vez de fabricar um dado que pareça concreto sem ser.`;

export async function extrairPerfilEAvatarDaEntrevista(
  historico: { autor: "usuario" | "ia"; texto: string }[],
): Promise<ExtracaoEntrevista> {
  const mensagens: Anthropic.MessageParam[] = historico.map((m) => ({
    role: m.autor === "usuario" ? "user" : "assistant",
    content: m.texto,
  }));

  const response = await client.messages.parse({
    model: MODELO_MARKETING,
    max_tokens: 2048,
    system: SYSTEM_EXTRACAO,
    messages: mensagens,
    output_config: { format: zodOutputFormat(ExtracaoEntrevistaSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("A IA não devolveu a extração no formato esperado.");
  }

  return response.parsed_output;
}

/** Mensagem amigável pro chat a partir de uma exceção do SDK — cadeia
 * mais-específico-primeiro, como a doc recomenda. */
export function mensagemDeErroIA(erro: unknown): string {
  if (erro instanceof Anthropic.AuthenticationError) {
    return "A chave de API da IA não está configurada ou é inválida.";
  }
  if (erro instanceof Anthropic.RateLimitError) {
    return "A IA está sobrecarregada agora — tente de novo em alguns segundos.";
  }
  if (erro instanceof Anthropic.APIError) {
    return `A IA não respondeu (${erro.status ?? "erro"}) — tente de novo.`;
  }
  return "Falha inesperada ao falar com a IA.";
}
