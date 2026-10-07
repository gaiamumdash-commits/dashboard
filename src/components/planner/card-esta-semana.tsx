import { AnelProgresso } from "@/components/planner/anel-progresso";
import { LinhaItemDia } from "@/components/planner/lista-itens-dia";
import { formatarDataCurta, SIGLA_DIA } from "@/lib/ecc/planner/regras";
import type { DiaDaSemana } from "@/lib/ecc/planner/painel";

/** Card "Esta semana" do mockup: os 7 dias com rotinas, compromissos e
 * itens da Agenda, e o placar "N/M concluídos" (só do que dá pra marcar
 * no Planner). Dias vazios ficam de fora pra não esticar o card. */
export function CardEstaSemana({
  dias,
  concluidos,
  total,
  hoje,
}: {
  dias: DiaDaSemana[];
  concluidos: number;
  total: number;
  hoje: string;
}) {
  const diasComItens = dias.filter((d) => d.itens.length > 0);
  const percentual = total === 0 ? null : Math.round((concluidos / total) * 100);
  const inicio = dias[0]?.data;
  const fim = dias[dias.length - 1]?.data;

  return (
    <section className="flex h-full flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-gaiamum-tag-purple/15 text-lg">
            🗓️
          </span>
          <div>
            <h2 className="font-semibold text-gaiamum-text">Esta semana</h2>
            {inicio && fim && (
              <p className="text-xs text-gaiamum-text-muted">
                {formatarDataCurta(inicio)} – {formatarDataCurta(fim)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AnelProgresso percentual={percentual} classeCor="text-gaiamum-success" tamanho={44} rotulo="Concluídos na semana" />
          <p className="text-xs text-gaiamum-text-muted">
            <span className="block font-semibold text-gaiamum-text">
              {concluidos}/{total}
            </span>
            concluídos
          </p>
        </div>
      </div>

      {diasComItens.length === 0 ? (
        <p className="py-6 text-center text-sm text-gaiamum-text-muted">
          Semana livre por enquanto. Rotinas com dia marcado e compromissos aparecem aqui.
        </p>
      ) : (
        <ol className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
          {diasComItens.map((dia) => {
            const ehHoje = dia.data === hoje;
            return (
              <li key={dia.data} className="flex gap-3 border-b border-gaiamum-border pb-2 last:border-0">
                <div
                  className={`flex w-12 shrink-0 flex-col items-center justify-center self-start rounded-lg py-1.5 text-center ${
                    ehHoje ? "bg-gaiamum-primary text-white" : "bg-gaiamum-primary/10 text-gaiamum-primary"
                  }`}
                >
                  <span className="text-[10px] font-semibold">{SIGLA_DIA[dia.diaIso - 1]}</span>
                  <span className="text-base font-semibold leading-tight">{dia.data.slice(8)}</span>
                  {ehHoje && <span className="sr-only">(hoje)</span>}
                </div>
                <ul className="min-w-0 flex-1">
                  {dia.itens.map((item) => (
                    <LinhaItemDia key={item.chave} item={item} data={dia.data} mostrarHorario={false} compacto />
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
