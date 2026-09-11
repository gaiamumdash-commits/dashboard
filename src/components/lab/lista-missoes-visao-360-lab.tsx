import type { MissaoVisao360CafeMangue } from "@/lib/ecc/lab/conteudo-cafe-mangue";
import type { PassoLab } from "@/lib/ecc/lab/progresso";

/** Checklist das missões da Fase A2 (Decisões/Indicadores da Visão 360° do
 * Lab) — mesmo idioma visual de lista-missoes-lab.tsx (✓/○, line-through
 * quando concluído). Diferente daquele componente, o critério aqui não é
 * derivado do estado atual dos dados: é a presença do passo em
 * passosConcluidos (lab_passos), gravado pela própria Server Action no
 * sucesso da ação — ver decisoes-indicadores.ts. Puramente apresentacional. */
export function ListaMissoesVisao360Lab({
  missoes,
  passosConcluidos,
}: {
  missoes: MissaoVisao360CafeMangue[];
  passosConcluidos: Set<PassoLab>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">Missões desta etapa</h2>
      <ul className="flex flex-col gap-2.5">
        {missoes.map((missao) => {
          const feita = passosConcluidos.has(missao.id);
          return (
            <li key={missao.id} className="flex items-start gap-2 text-sm">
              <span className={feita ? "text-gaiamum-success" : "text-gaiamum-text-muted"}>{feita ? "✓" : "○"}</span>
              <span className={feita ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"}>
                {missao.texto}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
