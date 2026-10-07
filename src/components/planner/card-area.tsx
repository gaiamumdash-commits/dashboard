import Link from "next/link";
import { AnelProgresso } from "@/components/planner/anel-progresso";
import { COR_AREA } from "@/components/planner/cores-area";
import { hrefArea, ICONE_AREA, ROTULO_AREA, SUBTITULO_AREA } from "@/lib/ecc/planner/regras";
import type { AreaPlanner } from "@/lib/ecc/planner/tipos";

export type MetricaArea = { valor: string; rotulo: string };

/** Card de área (Pessoal/Estudos/Casa/Saúde) do mockup: ícone, título,
 * anel de consistência e 3 indicadores. Clicável inteiro (vai pra área).
 * Sem dado nenhum, mostra um convite em vez de números zerados. */
export function CardArea({
  area,
  consistencia,
  metricas,
  vazio,
}: {
  area: AreaPlanner;
  consistencia: number | null;
  metricas: MetricaArea[];
  vazio: boolean;
}) {
  const cor = COR_AREA[area];
  return (
    <Link
      href={hrefArea(area)}
      className={`group flex flex-col gap-4 rounded-2xl border border-gaiamum-border p-5 transition ${cor.fundoCard} ${cor.borda} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gaiamum-primary`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${cor.fundoIcone}`}>
          {ICONE_AREA[area]}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gaiamum-text">{ROTULO_AREA[area]}</h3>
          <p className="text-xs text-gaiamum-text-muted">{SUBTITULO_AREA[area]}</p>
        </div>
        <span aria-hidden className="text-gaiamum-text-muted transition group-hover:translate-x-0.5">
          ›
        </span>
      </div>

      {vazio ? (
        <p className="text-sm text-gaiamum-text-muted">Nada aqui ainda. Toque pra organizar {ROTULO_AREA[area].toLowerCase()}.</p>
      ) : (
        <div className="flex items-center gap-4">
          <AnelProgresso percentual={consistencia} classeCor={cor.texto} rotulo={`Consistência em ${ROTULO_AREA[area]}`} />
          <ul className="min-w-0 flex-1 space-y-1 text-sm">
            {metricas.map((m) => (
              <li key={m.rotulo} className="leading-snug text-gaiamum-text-muted">
                <span className="mr-1.5 font-semibold text-gaiamum-text">{m.valor}</span>
                {m.rotulo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Link>
  );
}
