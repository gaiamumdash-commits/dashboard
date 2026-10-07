import Link from "next/link";
import { CaixaMarcar } from "@/components/planner/caixa-marcar";
import type { ItemDia } from "@/lib/ecc/planner/painel";

/** Uma linha de item do dia (card "Hoje", "Foco de hoje", "Esta semana").
 * Item do Planner tem checkbox; item de outro módulo (Agenda, Kanban,
 * Financeiro) tem só o link pro lugar de origem — o Planner nunca marca
 * tarefa/conta de outro módulo por conta própria. */
export function LinhaItemDia({
  item,
  data,
  mostrarHorario = true,
  compacto = false,
}: {
  item: ItemDia;
  data: string;
  mostrarHorario?: boolean;
  compacto?: boolean;
}) {
  const externo = item.href?.startsWith("http");
  const riscado = item.feito === true;

  return (
    <li className={`flex items-center gap-3 ${compacto ? "py-1" : "py-2.5"}`}>
      {mostrarHorario && (
        <span className="w-11 shrink-0 text-xs tabular-nums text-gaiamum-text-muted">{item.horario ?? "—"}</span>
      )}
      {item.feito === null ? (
        <span
          aria-hidden
          title={item.detalhe ?? undefined}
          className={`flex shrink-0 items-center justify-center rounded-md border-2 border-dashed border-gaiamum-border text-[10px] text-gaiamum-text-muted ${compacto ? "h-4 w-4" : "h-5 w-5"}`}
        >
          ↗
        </span>
      ) : (
        <CaixaMarcar
          origem={item.origem as "rotina" | "habito" | "compromisso"}
          id={item.id}
          data={data}
          feito={item.feito}
          rotulo={item.titulo}
          tamanho={compacto ? "sm" : "md"}
        />
      )}
      <div className="min-w-0 flex-1">
        {item.href ? (
          <Link
            href={item.href}
            target={externo ? "_blank" : undefined}
            rel={externo ? "noreferrer" : undefined}
            className={`block truncate text-sm hover:underline ${riscado ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"}`}
          >
            {item.titulo}
          </Link>
        ) : (
          <span className={`block truncate text-sm ${riscado ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"}`}>
            {item.titulo}
          </span>
        )}
        {!compacto && item.detalhe && <span className="block truncate text-xs text-gaiamum-text-muted">{item.detalhe}</span>}
      </div>
    </li>
  );
}
