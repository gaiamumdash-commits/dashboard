import { urgenciaDoPrazo } from "@/lib/ecc/kanban";
import type { Tarefa, Indicador } from "@/lib/ecc/tipos";

export type ChaveFatorAlinhamento = "atraso" | "progresso" | "indicadores" | "meta_smart";

export type FatorAlinhamento = {
  chave: ChaveFatorAlinhamento;
  rotulo: string;
  pesoBase: number;
  /** Peso realmente usado no cálculo (0-100), após redistribuir o peso dos fatores sem dado. `null` quando o próprio fator não tem dado. */
  pesoEfetivo: number | null;
  valor: number | null;
  descricao: string;
};

export type AlinhamentoGaiamum = {
  score: number | null;
  fatores: FatorAlinhamento[];
};

type EntradaAlinhamento = {
  metaSmartId: string | null;
  tarefas: Pick<Tarefa, "data_limite" | "coluna_id">[];
  colunasConcluidoIds: Set<string>;
  indicadores: Pick<Indicador, "valor_atual" | "meta">[];
};

export function calcularAlinhamentoGaiamum({
  metaSmartId,
  tarefas,
  colunasConcluidoIds,
  indicadores,
}: EntradaAlinhamento): AlinhamentoGaiamum {
  const fatorMetaSmart: FatorAlinhamento = {
    chave: "meta_smart",
    rotulo: "Vinculado a uma meta SMART",
    pesoBase: 20,
    pesoEfetivo: null,
    valor: metaSmartId ? 100 : 0,
    descricao: metaSmartId ? "Projeto vinculado a uma meta SMART." : "Projeto sem meta SMART vinculada.",
  };

  const tarefasComPrazo = tarefas.filter((t) => t.data_limite);
  const atrasadas = tarefasComPrazo.filter(
    (t) => urgenciaDoPrazo(t, colunasConcluidoIds.has(t.coluna_id)) === "atrasado",
  );
  const fatorAtraso: FatorAlinhamento = {
    chave: "atraso",
    rotulo: "Tarefas em dia (sem atraso)",
    pesoBase: 30,
    pesoEfetivo: null,
    valor: tarefasComPrazo.length === 0 ? null : Math.round(100 * (1 - atrasadas.length / tarefasComPrazo.length)),
    descricao:
      tarefasComPrazo.length === 0
        ? "Nenhuma tarefa com prazo definido — fator não considerado."
        : `${atrasadas.length} de ${tarefasComPrazo.length} tarefa(s) com prazo estão atrasadas.`,
  };

  const totalTarefas = tarefas.length;
  const concluidas = tarefas.filter((t) => colunasConcluidoIds.has(t.coluna_id)).length;
  const fatorProgresso: FatorAlinhamento = {
    chave: "progresso",
    rotulo: "Progresso do quadro",
    pesoBase: 25,
    pesoEfetivo: null,
    valor: totalTarefas === 0 ? null : Math.round((100 * concluidas) / totalTarefas),
    descricao: totalTarefas === 0 ? "Quadro sem tarefas — fator não considerado." : `${concluidas} de ${totalTarefas} tarefa(s) concluídas.`,
  };

  const indicadoresValidos = indicadores.filter((i) => i.meta > 0);
  const fatorIndicadores: FatorAlinhamento = {
    chave: "indicadores",
    rotulo: "Indicadores em dia",
    pesoBase: 25,
    pesoEfetivo: null,
    valor:
      indicadoresValidos.length === 0
        ? null
        : Math.round(
            indicadoresValidos.reduce((soma, i) => soma + Math.min(i.valor_atual / i.meta, 1) * 100, 0) /
              indicadoresValidos.length,
          ),
    descricao:
      indicadoresValidos.length === 0
        ? "Sem indicadores cadastrados — fator não considerado."
        : `Média de ${indicadoresValidos.length} indicador(es) em relação à meta.`,
  };

  const fatoresBrutos = [fatorAtraso, fatorProgresso, fatorIndicadores, fatorMetaSmart];
  const comDado = fatoresBrutos.filter((f) => f.valor !== null);
  const pesoTotalComDado = comDado.reduce((soma, f) => soma + f.pesoBase, 0);
  const score =
    pesoTotalComDado === 0
      ? null
      : Math.round(comDado.reduce((soma, f) => soma + f.valor! * f.pesoBase, 0) / pesoTotalComDado);

  const fatores = fatoresBrutos.map((f) => ({
    ...f,
    pesoEfetivo: f.valor === null || pesoTotalComDado === 0 ? null : Math.round((f.pesoBase / pesoTotalComDado) * 100),
  }));

  return { score, fatores };
}

/** Verdadeiro se algum fator além da meta SMART tiver dado, ou se houver
 * meta SMART vinculada — a meta SMART sozinha é sempre computável (0 ou
 * 100), então o score nunca é `null` de fato, mesmo num projeto vazio.
 * Decide quando vale a pena gastar uma chamada de IA pra interpretar o
 * score (achado real de teste manual, 2026-09-09). */
export function alinhamentoTemDadosReais(alinhamento: AlinhamentoGaiamum): boolean {
  return alinhamento.fatores.some((f) => (f.chave === "meta_smart" ? f.valor === 100 : f.valor !== null));
}
