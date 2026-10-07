/** Anel de progresso dos cards do Planner (mockup: 78%, 65%...). `null` =
 * sem dado ainda — mostra "—" com o anel vazio, nunca um 0% inventado.
 * `classeCor` é uma classe `text-*` dos tokens: o traço usa `currentColor`. */
export function AnelProgresso({
  percentual,
  classeCor,
  tamanho = 72,
  rotulo,
}: {
  percentual: number | null;
  classeCor: string;
  tamanho?: number;
  rotulo: string;
}) {
  const espessura = Math.max(6, Math.round(tamanho / 10));
  const raio = (tamanho - espessura) / 2;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = percentual === null ? 0 : Math.min(Math.max(percentual, 0), 100);

  return (
    <div
      role="img"
      aria-label={percentual === null ? `${rotulo}: sem dados ainda` : `${rotulo}: ${percentual}%`}
      className="relative shrink-0"
      style={{ width: tamanho, height: tamanho }}
    >
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="-rotate-90">
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          strokeWidth={espessura}
          className="stroke-gaiamum-surface-raised"
        />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          strokeWidth={espessura}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - preenchido / 100)}
          className={`transition-[stroke-dashoffset] duration-500 ${classeCor}`}
        />
      </svg>
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gaiamum-text"
      >
        {percentual === null ? "—" : `${percentual}%`}
      </span>
    </div>
  );
}
