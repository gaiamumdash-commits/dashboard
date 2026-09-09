import type { AlinhamentoGaiamum } from "@/lib/ecc/visao-360";
import { BarraProgresso } from "@/components/ui/barra-progresso";

export function AlinhamentoGaiamumBloco({ alinhamento }: { alinhamento: AlinhamentoGaiamum }) {
  const { score, fatores } = alinhamento;

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-gaiamum-text">Alinhamento Gaiamum</h2>
        <span className="text-3xl font-bold text-gaiamum-primary">{score === null ? "—" : `${score}%`}</span>
      </div>
      <p className="mt-1 text-xs text-gaiamum-text-muted">
        Score calculado a partir dos dados do projeto — sem IA. Cada fator abaixo mostra o peso realmente usado no
        cálculo (fatores sem dado são excluídos e seu peso é redistribuído entre os demais).
      </p>

      <div className="mt-5 flex flex-col gap-4">
        {fatores.map((fator) => (
          <div key={fator.chave}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gaiamum-text">{fator.rotulo}</span>
              <span className="text-xs text-gaiamum-text-muted">
                {fator.pesoEfetivo === null ? "não considerado" : `peso ${fator.pesoEfetivo}%`}
              </span>
            </div>
            {fator.valor === null ? (
              <p className="mt-1 text-xs text-gaiamum-text-muted">{fator.descricao}</p>
            ) : (
              <>
                <BarraProgresso percentual={fator.valor} rotulo="" />
                <p className="mt-1 text-xs text-gaiamum-text-muted">{fator.descricao}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
