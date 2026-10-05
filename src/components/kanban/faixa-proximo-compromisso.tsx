import Link from "next/link";
import { listarCompromissosDoDiaNaRequisicao } from "@/lib/ecc/agenda-requisicao";
import { horarioDeInicio, proximoCompromisso } from "@/lib/ecc/kanban-cabecalho";
import { chaveDiaAtual } from "@/lib/ecc/semana";
import { ItemFaixaDoDia } from "@/components/kanban/item-faixa-do-dia";
import { IconeCalendario } from "@/components/kanban/icones-kanban";

/** "Próximo compromisso" da faixa do dia — Server Component em `<Suspense>`
 * (a chamada ao Google não segura o quadro). Mesma fonte da coluna
 * "Compromissos do dia" (`listarCompromissosDoDia`, deduplicada na
 * requisição): nenhum dado novo, só o primeiro compromisso que ainda vai
 * começar hoje. Sem agenda conectada / sem compromisso: estado vazio, nunca
 * um valor inventado. */
export async function FaixaProximoCompromisso({ tenantId }: { tenantId: string }) {
  const resultado = await listarCompromissosDoDiaNaRequisicao(tenantId, chaveDiaAtual());

  if (resultado.status === "oculto") {
    return (
      <ItemFaixaDoDia icone={<IconeCalendario />} tomIcone="neutro" rotulo="Próximo compromisso:">
        <Link href="/agenda" className="text-gaiamum-text-muted underline-offset-2 hover:text-gaiamum-text hover:underline">
          Conectar agenda
        </Link>
      </ItemFaixaDoDia>
    );
  }

  if (resultado.status === "problema") {
    return (
      <ItemFaixaDoDia icone={<IconeCalendario />} tomIcone="neutro" rotulo="Próximo compromisso:">
        <span className="text-gaiamum-text-muted">Agenda indisponível</span>
      </ItemFaixaDoDia>
    );
  }

  const proximo = proximoCompromisso(resultado.compromissos);
  return (
    <ItemFaixaDoDia icone={<IconeCalendario />} rotulo="Próximo compromisso:">
      {proximo ? (
        <span className="font-semibold" title={`${proximo.horario} · ${proximo.titulo}`}>
          {horarioDeInicio(proximo.horario)} {proximo.titulo}
        </span>
      ) : (
        <span className="text-gaiamum-text-muted">Nenhum outro hoje</span>
      )}
    </ItemFaixaDoDia>
  );
}

export function FaixaProximoCompromissoCarregando() {
  return (
    <ItemFaixaDoDia icone={<IconeCalendario />} tomIcone="neutro" rotulo="Próximo compromisso:">
      <span className="inline-block h-3.5 w-24 animate-pulse rounded bg-gaiamum-surface-raised align-middle" />
    </ItemFaixaDoDia>
  );
}
