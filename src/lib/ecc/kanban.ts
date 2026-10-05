import type { CorEtiqueta, MembroTenant, Tarefa } from "@/lib/ecc/tipos";

/** Id estável da coluna fixa "Compromissos do dia" (`ColunaCompromissosDoDia`,
 * Server Component) — compartilhado entre ela e `QuadroKanban` (cliente) pra
 * marcar o `data-coluna-card` da mesma forma nos dois lados. Achado real
 * (2026-10-04, Fabio não conseguia ver essa coluna no celular): faltava o
 * atributo `data-coluna-card` e a classe `snap-center` nela — ela é um
 * ReactNode solto, não faz parte do array `colunas` (que só tem
 * `ColunaKanban` de verdade), então o rastreamento de "qual coluna está em
 * foco durante a rolagem" (usado pelo seletor de coluna/setas do celular)
 * simplesmente não sabia que ela existia. Não é um UUID de verdade de
 * propósito — nunca é enviado ao banco, só usado como chave de DOM/estado
 * no cliente. */
export const ID_COLUNA_COMPROMISSOS = "compromissos-do-dia";

/** Id otimista pra uma tarefa/coluna ainda não confirmada pelo servidor —
 * gerado no cliente e enviado como a PK real da linha (`criarTarefa`
 * insere com esse `id` em vez de deixar o banco gerar um novo), pra manter
 * o estado otimista e o estado real como a MESMA linha — por isso precisa
 * ser um UUID válido de verdade, a coluna `id` é `uuid` no banco.
 * Achado real (2026-10-01, teste físico do Fabio no celular via rede
 * Wi-Fi local em HTTP puro, não HTTPS): `crypto.randomUUID()` só existe em
 * "contexto seguro" do navegador (HTTPS ou localhost) — em qualquer outro
 * endereço (um IP de rede local em HTTP, por exemplo) o navegador remove
 * a função do objeto `crypto`, e chamá-la estoura `TypeError: crypto.
 * randomUUID is not a function`, quebrando toda criação otimista. Em
 * produção (sempre HTTPS) isso nunca apareceria.
 * 2ª rodada do mesmo achado: a 1ª correção usava um fallback do tipo
 * `"temp-" + algo` — passa no navegador, mas falha no banco com "invalid
 * input syntax for type uuid", porque não tem o FORMATO de UUID. O
 * fallback abaixo monta um UUID v4 válido à mão (`Math.random()`, não
 * criptograficamente forte, mas suficiente pra um ID que é só local até o
 * servidor confirmar — nunca usado pra nada que exija imprevisibilidade
 * criptográfica). */
export function gerarIdCliente(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

/** Cor determinística por e-mail (ou outra string estável) — pra bolinha de
 * iniciais não ficar toda da mesma cor quando reaproveitada em vários
 * lugares (menção, dropdown, membros do cartão). */
export function corAvatarPorEmail(email: string): CorEtiqueta {
  const soma = Array.from(email).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CORES_ETIQUETA[soma % CORES_ETIQUETA.length];
}

/** Fonte única de verdade pra "qual string identifica este membro na
 * interface" — revisão de privacidade, 2026-10-01: `email` pode ser `null`
 * (convidado de projeto vendo o owner sem compartilhar projeto, migration
 * 0049), e `nome_exibicao` (parte local do e-mail, sempre presente) é o
 * fallback. Usada pra @menção, avatar e qualquer exibição/comparação que
 * hoje usaria `membro.email` direto — nunca ler `.email` cru fora daqui. */
export function identificacaoDoMembro(membro: MembroTenant): string {
  return membro.email ?? membro.nome_exibicao;
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

// O app não tem seleção de fuso por usuário — todo mundo é Brasil. Fixar
// "America/Sao_Paulo" aqui evita o bug de calcular "hoje"/formatar data em
// código que roda no servidor (Server Component, Server Action), que usa
// UTC por padrão (Vercel/Node) — sem isso, `new Date().getMonth()` ou
// `.toLocaleString()` sem `timeZone` ficam até 3h adiantados em relação ao
// horário real de quem está usando o app.
export const FUSO_BRASIL = "America/Sao_Paulo";

/** "YYYY-MM-01" do mês atual, sempre no fuso de Brasília — independe do
 * fuso em que o processo do servidor está rodando. */
export function primeiroDiaDoMesAtual(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BRASIL,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const ano = partes.find((p) => p.type === "year")!.value;
  const mes = partes.find((p) => p.type === "month")!.value;
  return `${ano}-${mes}-01`;
}

/** "YYYY-MM-DD" de hoje, sempre no fuso de Brasília — funciona tanto no
 * servidor (Vercel roda em UTC) quanto no navegador de quem estiver em
 * outro fuso. Usar sempre no lugar de `new Date().toISOString().slice(0, 10)`
 * pra "hoje": esse padrão usa UTC, e entre 21h e meia-noite de Brasília já é
 * "amanhã" em UTC — achado real (2026-09-29): fazia o Financeiro mostrar
 * "Vencido" numa conta que vence hoje, e gravar a data de pagamento errada,
 * durante essas ~3h todo dia. */
export function hojeISOBrasil(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BRASIL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const ano = partes.find((p) => p.type === "year")!.value;
  const mes = partes.find((p) => p.type === "month")!.value;
  const dia = partes.find((p) => p.type === "day")!.value;
  return `${ano}-${mes}-${dia}`;
}

/** `toLocaleString("pt-BR", ...)` fixado no fuso de Brasília — usar sempre
 * que a formatação rodar em código server-side (Server Action, lib de
 * e-mail), onde o fuso "local" do processo é UTC, não o do usuário. */
export function formatarDataHoraBrasil(
  data: Date,
  opcoes: Intl.DateTimeFormatOptions,
): string {
  return data.toLocaleString("pt-BR", { ...opcoes, timeZone: FUSO_BRASIL });
}

/** Converte uma string de `<input type="datetime-local">` ("AAAA-MM-DDTHH:mm")
 * mais o fuso IANA de quem preencheu (ex.: "America/Sao_Paulo") pro instante
 * UTC correto — sem isso, `new Date(valor)` num Server Action assumiria o
 * fuso do SERVIDOR (UTC na Vercel), não o de quem está preenchendo, mesma
 * classe de bug já corrigida na Agenda/Google Calendar (que evita isso
 * delegando a conversão pra API do Google — aqui persistimos direto no
 * nosso banco, então precisamos calcular). Sem biblioteca de fuso no
 * projeto: técnica padrão via Intl.DateTimeFormat, sem dependência nova. */
export function paraUtcDoFuso(dataHoraLocal: string, fuso: string): Date {
  const [data, hora] = dataHoraLocal.split("T");
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);

  // "Chute" inicial: trata os componentes como se já fossem UTC.
  const chuteUtc = Date.UTC(ano, mes - 1, dia, h, min);

  // Descobre que horas esse instante representa no fuso alvo — a diferença
  // entre o chute e essa leitura é exatamente o offset do fuso (cobre
  // qualquer offset, incluindo horário de verão de outros países).
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(chuteUtc));

  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  const comoNoFuso = Date.UTC(valor("year"), valor("month") - 1, valor("day"), valor("hour"), valor("minute"));

  return new Date(2 * chuteUtc - comoNoFuso);
}

/** Antecedência (minutos) do alarme automático de "véspera" criado pra toda
 * conta a pagar nova (avulsa ou gerada de conta fixa) — pedido do Fabio,
 * 2026-09-29. A referência do alarme é meia-noite do dia do vencimento
 * (ver `disparar-alarmes/route.ts`), então 360min (6h) faz o e-mail sair às
 * 18h do dia anterior — a "véspera" de verdade, não de madrugada. */
export const ANTECEDENCIA_MIN_VESPERA_CONTA_A_PAGAR = 360;

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

export type EstadoHiperfoco = "inativo" | "ativo" | "metade" | "esgotado";

export const CLASSE_HIPERFOCO: Record<EstadoHiperfoco, string> = {
  inativo: "",
  ativo: "",
  metade: "border-gaiamum-warning bg-gaiamum-warning/10",
  esgotado: "border-gaiamum-danger border-2",
};

/** Estado do temporizador de hiperfoco (migration 0052) a partir de 2
 * timestamps absolutos — nunca de um timer relativo guardado só em memória,
 * então sobrevive a reload/fechar aba sem perder a conta. "Metade do tempo"
 * (não um limiar fixo como `urgenciaDoPrazo` acima) é o pedido explícito do
 * Fabio: um alarme de foco de 15min e um de 2h têm que acender o amarelo em
 * momentos proporcionalmente diferentes. */
export function estadoHiperfoco(iniciadoEm: string | null, minutos: number | null): EstadoHiperfoco {
  if (!iniciadoEm || !minutos) return "inativo";

  const decorridoMs = Date.now() - new Date(iniciadoEm).getTime();
  const duracaoMs = minutos * 60_000;

  if (decorridoMs >= duracaoMs) return "esgotado";
  if (decorridoMs >= duracaoMs / 2) return "metade";
  return "ativo";
}

/** Minutos restantes do cronômetro de hiperfoco (0 se já esgotou) — função
 * separada de `estadoHiperfoco` acima só porque o linter (`react-hooks/purity`)
 * proíbe chamar `Date.now()` diretamente no corpo/JSX de um componente;
 * encapsular numa função utilitária evita o erro sem perder a pureza real
 * do componente (o valor muda só quando ele re-renderiza, nunca sozinho). */
export function minutosRestantesHiperfoco(iniciadoEm: string, minutos: number): number {
  const decorridoMs = Date.now() - new Date(iniciadoEm).getTime();
  const duracaoMs = minutos * 60_000;
  return Math.max(0, Math.ceil((duracaoMs - decorridoMs) / 60_000));
}

/** Bipe curto gerado via Web Audio API — evita depender de um arquivo de
 * áudio novo (diferente de `tocarSomConcluido` acima, que toca um .mp3 já
 * existente). Silenciosamente ignorado se o navegador bloquear áudio sem
 * interação prévia do usuário, mesmo padrão de `tocarSomConcluido`. */
export function tocarAlarmeHiperfoco() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const contexto = new AudioContextCtor();
    const tocarBipe = (inicioS: number) => {
      const oscilador = contexto.createOscillator();
      const ganho = contexto.createGain();
      oscilador.type = "sine";
      oscilador.frequency.value = 880;
      ganho.gain.setValueAtTime(0.0001, contexto.currentTime + inicioS);
      ganho.gain.exponentialRampToValueAtTime(0.2, contexto.currentTime + inicioS + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + inicioS + 0.3);
      oscilador.connect(ganho).connect(contexto.destination);
      oscilador.start(contexto.currentTime + inicioS);
      oscilador.stop(contexto.currentTime + inicioS + 0.3);
    };
    tocarBipe(0);
    tocarBipe(0.35);
    tocarBipe(0.7);
  } catch {
    // Silencioso de propósito — alarme é um reforço, nunca pode quebrar a tela.
  }
}

/**
 * Qual coluna está "em foco" durante a rolagem horizontal do quadro no
 * celular (uma coluna por vez, com scroll-snap) — a mais próxima do centro
 * do container visível. Função pura (recebe posições já medidas do DOM, não
 * mede nada sozinha) pra dar pra testar sem precisar montar um DOM de
 * verdade. `null` quando não há nenhuma coluna (quadro vazio).
 */
export function encontrarColunaEmFoco(
  colunas: Array<{ id: string; offsetLeft: number; largura: number }>,
  centroVisivel: number,
): string | null {
  if (colunas.length === 0) return null;
  let melhorId = colunas[0].id;
  let melhorDistancia = Infinity;
  for (const coluna of colunas) {
    const centroDaColuna = coluna.offsetLeft + coluna.largura / 2;
    const distancia = Math.abs(centroDaColuna - centroVisivel);
    if (distancia < melhorDistancia) {
      melhorDistancia = distancia;
      melhorId = coluna.id;
    }
  }
  return melhorId;
}

/**
 * Velocidade (px/frame) do auto-scroll durante um arrasto de cartão por
 * toque, quando o dedo está perto de uma borda (topo/fundo da tela pra
 * rolagem vertical, laterais pra trocar de coluna). `distanciaDaBorda`
 * negativa ou maior que `zonaAtivacao` = fora da zona, sem rolagem (0).
 * Quanto mais perto da borda (distância menor), mais rápido — rolagem
 * suave em vez de "liga/desliga" abrupto.
 */
export function calcularVelocidadeAutoScroll(
  distanciaDaBorda: number,
  zonaAtivacao: number,
  velocidadeMaxima: number,
): number {
  if (distanciaDaBorda < 0 || distanciaDaBorda >= zonaAtivacao || zonaAtivacao <= 0) return 0;
  const proporcao = (zonaAtivacao - distanciaDaBorda) / zonaAtivacao;
  return Math.ceil(proporcao * velocidadeMaxima);
}

/** Ordem fracionária do cartão solto entre `ordemAntes` e `ordemDepois`
 * (qualquer um pode faltar — extremo da coluna) — mesma técnica de posição
 * fracionária usada por Trello/Notion internamente: inserir um cartão vira
 * 1 update (a média dos vizinhos), sem reindexar a coluna inteira a cada
 * arrasto. */
export function calcularNovaOrdem(ordemAntes: number | null, ordemDepois: number | null): number {
  if (ordemAntes === null && ordemDepois === null) return 1000;
  if (ordemAntes === null) return ordemDepois! - 1000;
  if (ordemDepois === null) return ordemAntes + 1000;
  return (ordemAntes + ordemDepois) / 2;
}
