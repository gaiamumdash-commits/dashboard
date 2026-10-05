import { listarCompromissosDoDia } from "@/lib/ecc/agenda";
import { listarContasDoDia } from "@/lib/ecc/financeiro";
import { ID_COLUNA_COMPROMISSOS } from "@/lib/ecc/kanban";
import { chaveDiaAtual } from "@/lib/ecc/semana";
import { ColunaCompromissosDoDiaCliente } from "@/components/kanban/coluna-compromissos-do-dia-cliente";

/** Coluna fixa à esquerda do quadro Kanban com os compromissos de hoje de
 * quem está logado (Google Calendar) e as contas a pagar que vencem hoje —
 * pra planejar os cartões sabendo quanto do dia já está ocupado/pendente.
 * Server Component, montado dentro de `<Suspense>` na página: a chamada ao
 * Google não segura o resto do quadro. Sem Google conectado e sem conta
 * vencendo hoje, não renderiza nada (o dia seguinte, acessível pela
 * barrinha "Amanhã" no rodapé do wrapper cliente, pode ter algo mesmo
 * assim — por isso o rodapé de navegação só é omitido quando não há como
 * alcançar o Google de jeito nenhum, não quando hoje especificamente está
 * vazio; ver `ColunaCompromissosDoDiaCliente`).
 *
 * Achado real (2026-10-04, Fabio não conseguia ver/alcançar esta coluna no
 * celular): faltava `data-coluna-card` (usado pelo rastreamento de "qual
 * coluna está em foco" durante a rolagem, em `quadro-kanban.tsx`) e
 * `snap-center` (sem isso o scroll-snap do celular não "trava" nela —
 * ela existe no DOM mas o toque desliza direto, não para de verdade) —
 * ela é um ReactNode solto, nunca fez parte do array `colunas`, então
 * nunca tinha esses dois detalhes que toda outra coluna já carrega. */
export async function ColunaCompromissosDoDia({ tenantId }: { tenantId: string }) {
  const chaveHoje = chaveDiaAtual();
  const [resultado, contasDoDia] = await Promise.all([
    listarCompromissosDoDia(tenantId, chaveHoje),
    listarContasDoDia(tenantId, chaveHoje),
  ]);

  if (resultado.status === "oculto" && contasDoDia.length === 0) return null;

  const rotuloData = new Date(`${chaveHoje}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    // `max-h` + `overflow-y-auto` (não `min-h`) — mesma altura máxima e
    // mesma lógica de nivelamento das demais colunas (quadro-kanban.tsx):
    // sem isso, esta coluna fixa não participava do nivelamento por
    // conteúdo real e carregava um "chão" artificial mesmo vazia.
    // `snap-center` + `data-coluna-card` — ver achado no comentário acima.
    <div
      data-coluna-card={ID_COLUNA_COMPROMISSOS}
      className="flex w-[85vw] max-w-sm shrink-0 snap-center flex-col gap-2.5 overflow-y-auto rounded-xl border border-gaiamum-primary/40 bg-gaiamum-surface p-3 sm:w-64 sm:snap-align-none"
      style={{ maxHeight: "var(--altura-maxima-coluna-kanban)" }}
    >
      <ColunaCompromissosDoDiaCliente
        chaveInicial={chaveHoje}
        rotuloDataInicial={rotuloData}
        resultadoInicial={resultado}
        contasInicial={contasDoDia}
      />
    </div>
  );
}
