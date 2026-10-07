import Link from "next/link";
import { AcoesCabecalhoPlanner } from "@/components/planner/acoes-cabecalho";
import { ROTULO_AREA } from "@/lib/ecc/planner/regras";
import { AREAS_PLANNER, type AreaPlanner } from "@/lib/ecc/planner/tipos";

/** Cabeçalho comum de todas as telas do Planner (mockup): breadcrumb,
 * título, ações e a navegação superior Visão geral / Pessoal / Estudos /
 * Casa / Saúde. No celular, as abas rolam na horizontal (sem estourar a
 * largura da página). */
export function CabecalhoPlanner({ area }: { area: AreaPlanner | null }) {
  const abas = [
    { href: "/planner", rotulo: "Visão geral", ativa: area === null },
    ...AREAS_PLANNER.map((a) => ({ href: `/planner/${a}`, rotulo: ROTULO_AREA[a], ativa: area === a })),
  ];

  return (
    <header className="flex flex-col gap-5">
      <nav aria-label="Você está em" className="text-sm text-gaiamum-text-muted">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/planner" className="hover:text-gaiamum-text">
              Planner
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li aria-current="page" className="font-medium text-gaiamum-text">
            {area ? ROTULO_AREA[area] : "Meu Planner"}
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gaiamum-primary/15 text-3xl"
          >
            🗓️
          </span>
          <div>
            <h1 className="text-3xl font-semibold text-gaiamum-text">{area ? ROTULO_AREA[area] : "Planner"}</h1>
            <p className="mt-1 text-gaiamum-text-muted">
              Organize sua rotina, cuide do que importa e mantenha sua vida em equilíbrio.
            </p>
          </div>
        </div>
        <AcoesCabecalhoPlanner area={area ?? "pessoal"} />
      </div>

      <nav aria-label="Áreas do Planner" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-1 border-b border-gaiamum-border">
          {abas.map((aba) => (
            <li key={aba.href}>
              <Link
                href={aba.href}
                aria-current={aba.ativa ? "page" : undefined}
                className={`-mb-px block border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                  aba.ativa
                    ? "border-gaiamum-primary text-gaiamum-primary"
                    : "border-transparent text-gaiamum-text-muted hover:text-gaiamum-text"
                }`}
              >
                {aba.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
