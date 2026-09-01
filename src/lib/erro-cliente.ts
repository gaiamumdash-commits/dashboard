/** Next.js redige a mensagem real de erros lançados dentro de Server
 * Actions em build de produção (medida de segurança do React Server
 * Components — evita vazar detalhe interno sem querer, mesmo que o erro
 * tenha vindo de um `throw new Error("mensagem segura")` nosso). No lugar
 * da mensagem real, o cliente recebe esse texto fixo em inglês — troca
 * por um fallback em português em vez de mostrar isso cru pro usuário.
 *
 * Limitação conhecida: isso esconde a mensagem específica da Server Action
 * (ex: "Valor inválido.") atrás do fallback genérico em produção — só em
 * `next dev` a mensagem real aparece. Corrigir de verdade exigiria trocar
 * o padrão de `throw` por retorno de estado (`useActionState`) em cada
 * Server Action que hoje lança erro de validação — mudança de escopo maior,
 * não feita aqui. */
const PREFIXO_ERRO_REDIGIDO = "An error occurred in the Server Components render";

export function mensagemDeErro(erro: unknown, fallback: string): string {
  if (erro instanceof Error && erro.message && !erro.message.startsWith(PREFIXO_ERRO_REDIGIDO)) {
    return erro.message;
  }
  return fallback;
}
