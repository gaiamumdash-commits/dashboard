import Link from "next/link";
import { detectarData, rotuloData } from "@/lib/ecc/mapas/datas";
import type { EstadoVinculo, VinculoRamo } from "@/lib/ecc/mapas/tipos";

// Selos pequenos do ramo (lista e mapa): a data citada no texto e o estado
// da tarefa/compromisso ligado. Sem estado próprio — só mostram.

const ESTILO_VINCULO: Record<EstadoVinculo, { icone: string; classe: string }> = {
  concluido: { icone: "✓", classe: "border-gaiamum-success/60 bg-gaiamum-success/15 text-gaiamum-success" },
  atrasado: { icone: "⚠", classe: "border-gaiamum-danger/60 bg-gaiamum-danger/15 text-gaiamum-danger" },
  proximo: { icone: "⏰", classe: "border-gaiamum-warning/60 bg-gaiamum-warning/15 text-gaiamum-warning" },
  ok: { icone: "▶", classe: "border-gaiamum-primary/50 bg-gaiamum-primary/10 text-gaiamum-primary" },
  sem_prazo: { icone: "▶", classe: "border-gaiamum-border bg-gaiamum-surface-raised text-gaiamum-text-muted" },
  indisponivel: { icone: "–", classe: "border-gaiamum-border bg-gaiamum-surface-raised text-gaiamum-text-muted" },
};

export function SeloData({ texto, hoje }: { texto: string; hoje: string }) {
  const d = detectarData(texto, hoje);
  if (!d) return null;
  const passou = d.data < hoje;
  return (
    <span
      title={passou ? "Data que já passou" : "Data citada no ramo"}
      className={`inline-flex items-center gap-1 rounded-full bg-gaiamum-surface-raised px-1.5 py-0.5 text-[11px] font-medium ${
        passou ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"
      }`}
    >
      <span aria-hidden>📅</span>
      {rotuloData(d, hoje)}
    </span>
  );
}

export function SeloVinculo({ vinculo }: { vinculo: VinculoRamo }) {
  const e = ESTILO_VINCULO[vinculo.estado];
  const conteudo = (
    <>
      <span aria-hidden>{vinculo.focoAtivo ? "🎯" : e.icone}</span>
      <span className="max-w-[11rem] truncate">{vinculo.focoAtivo ? "Em foco agora" : vinculo.rotulo}</span>
    </>
  );
  const classe = `inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${e.classe}`;
  return vinculo.href ? (
    <Link href={vinculo.href} data-sem-gesto onClick={(ev) => ev.stopPropagation()} title={`${vinculo.rotulo} — abrir`} className={`${classe} hover:underline`}>
      {conteudo}
    </Link>
  ) : (
    <span title={vinculo.rotulo} className={classe}>
      {conteudo}
    </span>
  );
}
