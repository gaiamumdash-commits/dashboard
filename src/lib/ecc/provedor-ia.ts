/** Abstração fina de provedor de IA — troca de implementação concreta
 * (Gemini hoje, Anthropic no futuro) sem reescrever quem chama. */
export type ResultadoGeracaoIA = {
  texto: string;
  provedor: string;
  modelo: string;
  /** Ausente quando o provedor não expõe consumo (ex.: futura implementação
   * Anthropic) — quem loga consumo trata como "sem dado", não como erro. */
  uso?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
};

export type ProvedorIA = {
  gerarTexto(prompt: string): Promise<ResultadoGeracaoIA>;
};
