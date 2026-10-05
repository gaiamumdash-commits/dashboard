import Image from "next/image";
import Link from "next/link";
import { IconeCircular, type CorIcone } from "@/components/painel/icone-circular";
import type { Alerta } from "@/lib/ecc/painel-geral";

const ICONE_POR_SEVERIDADE: Record<Alerta["severidade"], { cor: CorIcone; simbolo: string }> = {
  vermelho: { cor: "vermelho", simbolo: "!" },
  amarelo: { cor: "amarelo", simbolo: "!" },
  azul: { cor: "azul", simbolo: "i" },
};

/** Card "Estrategista Gaiamum" do print — o mascote + os alertas
 * prioritários do dia (já ordenados por severidade em
 * `montarAlertasPrioritarios`) + atalho pra Visão 360 do projeto mais
 * crítico. "Ver análise completa" reaproveita a página/IA que já existe
 * (`ExplicacaoAlinhamentoBloco`), não cria análise agregada nova. */
export function CardEstrategista({
  alertas,
  hrefAnaliseCompleta,
}: {
  alertas: Alerta[];
  hrefAnaliseCompleta: string | null;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-gaiamum-border bg-gradient-to-br from-gaiamum-surface via-gaiamum-surface to-gaiamum-primary/10 p-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        <Image
          src="/brand/crab-mark.png"
          alt=""
          width={64}
          height={64}
          className="shrink-0 rounded-xl bg-gaiamum-surface-raised p-2"
        />
        <div>
          <p className="flex items-center gap-1.5 text-base font-semibold text-gaiamum-text">
            Estrategista Gaiamum <span aria-hidden>✨</span>
          </p>
          <p className="mt-0.5 text-sm text-gaiamum-text-muted">
            Analisei seus projetos, metas, agenda e financeiro.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {alertas.length > 0 && (
          <ul className="flex flex-1 flex-col gap-2">
            {alertas.map((alerta, indice) => {
              const { cor, simbolo } = ICONE_POR_SEVERIDADE[alerta.severidade];
              return (
                <li key={indice} className="flex items-center gap-2.5 text-sm text-gaiamum-text">
                  <IconeCircular cor={cor} tamanho="sm">
                    {simbolo}
                  </IconeCircular>
                  {alerta.texto}
                </li>
              );
            })}
          </ul>
        )}

        {hrefAnaliseCompleta && (
          <Link
            href={hrefAnaliseCompleta}
            className="shrink-0 whitespace-nowrap rounded-full bg-gaiamum-primary px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark"
          >
            Ver análise completa →
          </Link>
        )}
      </div>
    </section>
  );
}
