import "server-only";

/**
 * Observabilidade mínima (P0, 2026-09-30) — corrige o achado da auditoria
 * (handoff canônico, seções 20/21): o Gaiamum não tinha nenhum registro
 * estruturado de erro, só `console.error` solto e sem correlação em vários
 * pontos, cada um com um formato diferente. Isso não troca `console.error`
 * por um serviço externo (o P0 não cria conta/assinatura paga nova) — só
 * padroniza O FORMATO do log (JSON, com id de correlação, operação,
 * severidade e contexto técnico mínimo) pra dar pra localizar um erro
 * específico no log da Vercel a partir do id mostrado pro usuário.
 *
 * Regra dura, sem exceção: nunca registrar conteúdo do usuário (prompt de
 * IA, transcrição de áudio, texto de nota/página, comentário, token de
 * qualquer tipo). O `contexto` aceito por `registrarErro` é tipado só com
 * primitivos (string/number/boolean/null) de propósito — não aceita um
 * objeto arbitrário que poderia, por engano, carregar dado sensível junto.
 */

export type SeveridadeLog = "info" | "warn" | "error" | "critical";

export type ContextoLog = Record<string, string | number | boolean | null | undefined>;

/** Id curto que aparece tanto no log estruturado quanto (quando fizer
 * sentido) na mensagem mostrada ao usuário — permite achar o log exato de
 * um erro relatado, sem expor detalhe interno nenhum na mensagem em si. */
export function gerarIdCorrelacao(): string {
  return crypto.randomUUID();
}

/**
 * Registra uma falha em formato estruturado (uma linha JSON por evento,
 * grep-ável no log da Vercel por `idCorrelacao` ou por `operacao`).
 * Devolve o `idCorrelacao` usado (gerado automaticamente se não informado)
 * — quem chama normalmente repassa esse id na mensagem de erro pro
 * usuário ("não deu certo — código ABC123, tente de novo").
 *
 * Nunca lança exceção — logging não pode ser o motivo de uma operação
 * principal falhar (mesmo espírito já usado em vários pontos do código,
 * ex.: `registrarConsumoIA` sempre chamado dentro de try/catch por quem
 * usa).
 */
export function registrarErro(params: {
  operacao: string;
  severidade?: SeveridadeLog;
  idCorrelacao?: string;
  contexto?: ContextoLog;
  erro?: unknown;
}): string {
  const idCorrelacao = params.idCorrelacao ?? gerarIdCorrelacao();

  try {
    const registro = {
      timestamp: new Date().toISOString(),
      nivel: params.severidade ?? "error",
      operacao: params.operacao,
      idCorrelacao,
      contexto: params.contexto ?? {},
      mensagemErro:
        params.erro instanceof Error
          ? params.erro.message
          : params.erro !== undefined
            ? String(params.erro)
            : undefined,
    };
    console.error(JSON.stringify(registro));
  } catch {
    // Nunca deixa uma falha ao logar (ex.: erro não serializável) virar uma
    // exceção nova que interrompe o fluxo principal.
    console.error(`[observabilidade] falha ao registrar log estruturado (operacao=${params.operacao})`);
  }

  return idCorrelacao;
}

/** Mesma coisa, mas pra um evento informativo (não-erro) que ainda vale a
 * pena poder correlacionar depois — ex.: resumo de execução de um cron. */
export function registrarInfo(params: { operacao: string; contexto?: ContextoLog }): string {
  return registrarErro({ ...params, severidade: "info", erro: undefined });
}
