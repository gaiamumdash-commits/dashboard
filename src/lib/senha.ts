/**
 * Regra de senha (auditoria de segurança de 2026-10-06): o Supabase de
 * produção passou a exigir no mínimo 8 caracteres pra senha NOVA (cadastro
 * e redefinição). O login continua aceitando 6+, senão quem já tinha senha
 * de 6 ou 7 caracteres não conseguiria mais entrar.
 */
export const TAMANHO_MINIMO_SENHA_NOVA = 8;
export const TAMANHO_MINIMO_SENHA_LOGIN = 6;

export const MENSAGEM_SENHA_CURTA = `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA_NOVA} caracteres.`;

/** O Supabase responde em inglês ("Password should be at least N
 * characters") — traduz pro mesmo texto que a tela mostra. */
export function ehErroDeSenhaCurta(mensagem: string): boolean {
  return /password should be at least/i.test(mensagem);
}
