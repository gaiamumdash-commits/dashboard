/** Bloco pedagógico sobre o PRODUTO REAL (não o case fictício) — pedido do
 * Fabio: quem nunca usou Notion/OKR não entende de cara o valor de um
 * registro de decisão, um indicador acompanhado ao longo do tempo, ou por
 * que uma tarefa vira um lançamento financeiro sozinha. Diferente de
 * ExplicacaoSimulada (comenta o case "Café do Mangue") e de
 * EstatisticaFicticia (incentivo do jogo), este bloco explica o "porquê" de
 * negócio da funcionalidade e como ela se encaixa no resto do Gaiamum —
 * aparece perto de onde a funcionalidade em questão vive na tela. */
export function PorQueIssoExiste({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface-raised p-4">
      <h3 className="text-sm font-semibold text-gaiamum-text">🧭 Por que isso existe no Gaiamum</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm text-gaiamum-text-muted">{texto}</p>
    </div>
  );
}
