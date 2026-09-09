/** Bloco "explicação de IA" do Lab — mesma cara do bloco real
 * (`ExplicacaoAlinhamentoBloco`/`ExplicacaoAlinhamentoBloco`), mas com texto
 * FIXO (nunca chama o Gemini dentro do Lab — mentoria 100% pré-escrita).
 * Sem aviso de "isso é simulado" aqui: esse aviso já foi dado uma única vez
 * na entrada do Lab (app/lab/page.tsx) — repetir a cada bloco quebraria o
 * clima de jogo. */
export function ExplicacaoSimulada({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <h2 className="text-lg font-semibold text-gaiamum-text">✨ Explicação da IA</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm text-gaiamum-text">{texto}</p>
    </div>
  );
}
