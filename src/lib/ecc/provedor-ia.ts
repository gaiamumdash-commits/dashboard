/** Abstração fina de provedor de IA — troca de implementação concreta
 * (Gemini hoje, Anthropic no futuro) sem reescrever quem chama. */
export type ProvedorIA = {
  gerarTexto(prompt: string): Promise<string>;
};
