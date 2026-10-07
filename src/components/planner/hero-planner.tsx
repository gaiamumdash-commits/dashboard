import Image from "next/image";
import { LinhaItemDia } from "@/components/planner/lista-itens-dia";
import type { ItemDia } from "@/lib/ecc/planner/painel";

/** Hero do mockup: saudação + frase curta à esquerda, "Foco de hoje" à
 * direita. Sem foto (o mockup usa um pôr do sol de banco de imagem): fundo
 * em gradiente dos tokens + o caranguejo da marca, que acompanha os 3 temas. */
export function HeroPlanner({
  saudacao,
  nome,
  hoje,
  foco,
}: {
  saudacao: string;
  nome: string;
  hoje: string;
  foco: ItemDia[];
}) {
  return (
    <section className="grid overflow-hidden rounded-2xl border border-gaiamum-border bg-gradient-to-br from-gaiamum-primary/25 via-gaiamum-surface to-gaiamum-accent/15 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="relative flex flex-col justify-center gap-2 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-gaiamum-text sm:text-3xl">
          {saudacao}, {nome}!
        </h2>
        <p className="max-w-md text-gaiamum-text-muted">“Pequenos passos bem planejados constroem grandes resultados.”</p>
        <Image
          src="/brand/crab-mark.png"
          alt=""
          width={72}
          height={72}
          className="pointer-events-none absolute bottom-3 right-4 hidden opacity-30 sm:block"
        />
      </div>

      <div className="m-3 rounded-xl border border-gaiamum-border bg-gaiamum-surface p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gaiamum-text">
          <span aria-hidden>🎯</span> Foco de hoje
        </h3>
        {foco.length === 0 ? (
          <p className="mt-3 text-sm text-gaiamum-text-muted">
            Nada pendente pra hoje. Crie uma rotina ou um compromisso pelo “Adicionar”.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-gaiamum-border">
            {foco.map((item) => (
              <LinhaItemDia key={item.chave} item={item} data={hoje} mostrarHorario={false} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
