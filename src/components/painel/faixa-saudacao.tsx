import Image from "next/image";
import Link from "next/link";
import type { Alerta } from "@/lib/ecc/painel-geral";

const CLASSE_BOLINHA: Record<Alerta["severidade"], string> = {
  vermelho: "bg-gaiamum-danger",
  amarelo: "bg-gaiamum-warning",
  azul: "bg-gaiamum-tag-blue",
};

/** Topo do Painel geral: saudação com o mascote + alertas prioritários do
 * dia (no máximo 3, já vindos ordenados por severidade de
 * `montarAlertasPrioritarios`) + atalho pra Visão 360 do projeto mais
 * crítico (ver `src/app/page.tsx` — reaproveita a página/IA que já existe,
 * não cria análise agregada nova). */
export function FaixaSaudacao({
  saudacao,
  nome,
  alertas,
  hrefAnaliseCompleta,
}: {
  saudacao: string;
  nome: string;
  alertas: Alerta[];
  hrefAnaliseCompleta: string | null;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <Image
          src="/brand/crab-mark.png"
          alt=""
          width={48}
          height={48}
          className="shrink-0 rounded-xl bg-gaiamum-surface-raised p-1.5"
        />
        <div>
          <h1 className="text-xl font-semibold text-gaiamum-text sm:text-2xl">
            {saudacao}, {nome}.
          </h1>
          <p className="mt-0.5 text-sm text-gaiamum-text-muted">Aqui está o que merece sua atenção hoje.</p>

          {alertas.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {alertas.map((alerta, indice) => (
                <li key={indice} className="flex items-center gap-2 text-sm text-gaiamum-text">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${CLASSE_BOLINHA[alerta.severidade]}`} />
                  {alerta.texto}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {hrefAnaliseCompleta && (
        <Link
          href={hrefAnaliseCompleta}
          className="shrink-0 self-start rounded-full bg-gaiamum-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark sm:self-center"
        >
          Ver análise completa
        </Link>
      )}
    </section>
  );
}
