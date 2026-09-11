import type { MissaoLab } from "@/lib/ecc/lab/conteudo-cafe-mangue";
import type { PassoLab } from "@/lib/ecc/lab/progresso";

/** Checklist de missões de uma etapa do Lab (Visão 360°, Financeiro, ...) —
 * mesmo idioma visual do checklist do quadro (lista-missoes-lab.tsx: ✓/○,
 * line-through quando concluído), mas critério de conclusão diferente: aqui
 * não deriva do estado atual dos dados, é a presença do passo em
 * passosConcluidos (lab_passos), gravado pela própria Server Action
 * Lab-aware no sucesso da ação. Generalizado na Sub-entrega 1 da integração
 * cross-módulo (antes só ListaMissoesVisao360Lab, restrito à Fase A2) porque
 * o componente é puramente apresentacional — reaproveitado agora em
 * /lab/visao-360 e /lab/financeiro. Nome deliberadamente diferente de
 * ListaMissoesLab (quadro) pra não colidir com o componente já existente. */
export function ListaMissoesEtapaLab({
  missoes,
  passosConcluidos,
}: {
  missoes: MissaoLab[];
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
