import type { CorEtiqueta, Tarefa } from "@/lib/ecc/tipos";

/** Fonte única das 6 cores fixas — reaproveitada pro fallback de cor
 * automática de etiqueta (etiquetas.ts) e pro hash de cor de avatar
 * (corAvatarPorEmail, abaixo). */
export const CORES_ETIQUETA: CorEtiqueta[] = ["purple", "teal", "yellow", "blue", "coral", "lime"];

export const CLASSE_COR_ETIQUETA: Record<CorEtiqueta, string> = {
  purple: "border-gaiamum-tag-purple/40 bg-gaiamum-tag-purple/15 text-gaiamum-tag-purple",
  teal: "border-gaiamum-tag-teal/40 bg-gaiamum-tag-teal/15 text-gaiamum-tag-teal",
  yellow: "border-gaiamum-tag-yellow/40 bg-gaiamum-tag-yellow/15 text-gaiamum-tag-yellow",
  blue: "border-gaiamum-tag-blue/40 bg-gaiamum-tag-blue/15 text-gaiamum-tag-blue",
  coral: "border-gaiamum-tag-coral/40 bg-gaiamum-tag-coral/15 text-gaiamum-tag-coral",
  lime: "border-gaiamum-tag-lime/40 bg-gaiamum-tag-lime/15 text-gaiamum-tag-lime",
};

/** Versão sólida (sem opacidade) das mesmas 6 cores — pra faixa/banner do
 * quadro (cor de fundo do projeto), diferente do chip translúcido acima. */
export const CLASSE_FUNDO_QUADRO: Record<CorEtiqueta, string> = {
  purple: "bg-gaiamum-tag-purple",
  teal: "bg-gaiamum-tag-teal",
  yellow: "bg-gaiamum-tag-yellow",
  blue: "bg-gaiamum-tag-blue",
  coral: "bg-gaiamum-tag-coral",
  lime: "bg-gaiamum-tag-lime",
};

/** Cor de texto legível em cima do fundo sólido de CLASSE_FUNDO_QUADRO —
 * yellow/lime são claras demais pro texto branco padrão. Preto/branco fixos
 * (não os tokens de tema, que variam — `--gaiamum-bg` vira cinza-claro no
 * tema claro e daria contraste ruim em cima do amarelo/lima). */
export const TEXTO_SOBRE_FUNDO_QUADRO: Record<CorEtiqueta, string> = {
  purple: "text-white",
  teal: "text-white",
  yellow: "text-black",
  blue: "text-white",
  coral: "text-white",
  lime: "text-black",
};

/** Cor determinística por e-mail — pra bolinha de iniciais não ficar toda
 * da mesma cor quando reaproveitada em vários lugares (menção, dropdown,
 * membros do cartão). */
export function corAvatarPorEmail(email: string): CorEtiqueta {
  const soma = Array.from(email).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CORES_ETIQUETA[soma % CORES_ETIQUETA.length];
}

/** Toca quando um cartão entra na coluna "Concluído" — pedido do Fabio,
 * arquivo dele em public/sons/gaiamum-chegou.mp3. `.catch` porque alguns
 * navegadores bloqueiam áudio sem interação prévia do usuário; como isso
 * só dispara depois de um clique/arrasto real, na prática sempre toca. */
export function tocarSomConcluido() {
  if (typeof window === "undefined") return;
  new Audio("/sons/gaiamum-chegou.mp3").play().catch(() => {});
}

/** Converte um timestamp UTC (vindo do banco) pro formato que
 * `<input type="datetime-local">` espera, já na hora local do navegador —
 * sem isso, reabrir o campo mostraria a hora UTC crua em vez da hora que
 * a pessoa realmente digitou. */
export function paraDatetimeLocal(isoUtc: string): string {
  const data = new Date(isoUtc);
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export type UrgenciaPrazo = "atrasado" | "proximo" | "ok" | "sem_prazo";

export const CLASSE_PRAZO: Record<UrgenciaPrazo, string> = {
  atrasado: "border-gaiamum-danger text-gaiamum-danger",
  proximo: "border-gaiamum-warning text-gaiamum-warning",
  ok: "border-gaiamum-border text-gaiamum-text-muted",
  sem_prazo: "border-gaiamum-border text-gaiamum-text-muted",
};

const HORAS_PARA_ALERTA_AMARELO = 48;

/** Amarelo faltando até 48h de verdade (não "2 dias de calendário" — o
 * prazo agora tem hora, então é preciso), vermelho a partir do horário
 * exato do prazo. `colunaConcluida` vem da coluna atual da tarefa
 * (`ColunaKanban.concluido`), não de um status fixo — colunas são
 * configuráveis por projeto. */
export function urgenciaDoPrazo(
  tarefa: Pick<Tarefa, "data_limite">,
  colunaConcluida: boolean,
): UrgenciaPrazo {
  if (colunaConcluida || !tarefa.data_limite) {
    return tarefa.data_limite ? "ok" : "sem_prazo";
  }

  const horasRestantes = (new Date(tarefa.data_limite).getTime() - Date.now()) / (1000 * 60 * 60);

  if (horasRestantes <= 0) return "atrasado";
  if (horasRestantes <= HORAS_PARA_ALERTA_AMARELO) return "proximo";
  return "ok";
}
