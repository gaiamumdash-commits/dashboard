import type { Metadata } from "next";
import { carregarVisaoGeral, contextoPlanner } from "@/lib/ecc/planner/dados";
import { focoDoDia, habitosSemHorarioPendentes, itensDoDia, resumoDasAreas, semanaDoPlanner } from "@/lib/ecc/planner/painel";
import { consistenciaDaSemana, sugestaoDaSemana } from "@/lib/ecc/planner/regras";
import { primeiroNome, saudacaoPorHorario } from "@/lib/ecc/painel-geral";
import { FUSO_BRASIL } from "@/lib/ecc/kanban";
import { AREAS_PLANNER, type AreaPlanner } from "@/lib/ecc/planner/tipos";
import { EstruturaPlanner } from "@/components/planner/estrutura-planner";
import { HeroPlanner } from "@/components/planner/hero-planner";
import { CardSugestao } from "@/components/planner/card-sugestao";
import { CardArea } from "@/components/planner/card-area";
import { CardHoje } from "@/components/planner/card-hoje";
import { CardMeusHabitos } from "@/components/planner/card-meus-habitos";
import { CardEstaSemana } from "@/components/planner/card-esta-semana";
import { BoasVindasPlanner } from "@/components/planner/boas-vindas";
import { OpcaoResumoEmail } from "@/components/planner/opcao-resumo-email";

export const metadata: Metadata = { title: "Meu Planner · Gaiamum" };

/** "Meu Planner" — tela do mockup aprovado (2026-10-07). Ordem no celular
 * segue a prioridade do pedido: saudação/foco → hoje → hábitos → áreas →
 * semana → sugestão. No desktop, o grid reposiciona tudo como no mockup. */
export default async function PaginaMeuPlanner() {
  const ctx = await contextoPlanner();
  const dados = await carregarVisaoGeral(ctx.tenantId, { souOwner: ctx.souOwner, acessoCompleto: ctx.acessoCompleto });
  const { hoje, segunda } = dados.semana;

  const ativos = dados.habitos.filter((h) => h.ativo);
  const agendaItens = dados.agenda?.itens ?? [];
  const base = { habitos: ativos, registros: dados.registros, compromissos: dados.compromissosSemana, agenda: agendaItens };

  const itensHoje = itensDoDia({ ...base, data: hoje });
  const foco = focoDoDia(itensHoje, habitosSemHorarioPendentes(ativos, dados.registros, hoje));
  const semana = semanaDoPlanner({ ...base, segunda });
  const resumo = resumoDasAreas({
    segunda,
    hoje,
    habitos: dados.habitos,
    registros: dados.registros,
    compromissosSemana: dados.compromissosSemana,
    objetivosAtivos: dados.objetivosAtivos,
    leiturasEmAndamento: dados.leiturasEmAndamento,
    comprasPendentes: dados.comprasPendentes,
    diasCardapio: new Set(dados.diasCardapio.map((d) => d.dia_semana)).size,
    proximaConsulta: dados.proximaConsulta,
    lembretesSaude: dados.lembretesSaude,
  });
  const sugestao = sugestaoDaSemana(
    Object.fromEntries(AREAS_PLANNER.map((a) => [a, resumo[a].consistencia])),
    consistenciaDaSemana(ativos, dados.registros, segunda, hoje),
  );

  const semNadaNoPlanner = dados.habitos.length === 0 && dados.compromissosSemana.length === 0 && AREAS_PLANNER.every((a) => resumo[a].vazio);
  const primeiroAcesso = !dados.preferencias && semNadaNoPlanner;

  // Áreas escolhidas no primeiro acesso vêm primeiro; as outras continuam
  // visíveis (a escolha personaliza a ordem, não esconde nada).
  const escolhidas = dados.preferencias?.areas ?? [];
  const ordemAreas: AreaPlanner[] = [...escolhidas, ...AREAS_PLANNER.filter((a) => !escolhidas.includes(a))];

  // "Quarta-feira, 07 de out. de 2026" — só a 1ª letra maiúscula.
  const dataPorExtenso = new Date().toLocaleDateString("pt-BR", {
    timeZone: FUSO_BRASIL,
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const rotuloData = dataPorExtenso.charAt(0).toUpperCase() + dataPorExtenso.slice(1);

  return (
    <EstruturaPlanner area={null} temMetasSmart={ctx.temMetasSmart} acessoCompleto={ctx.acessoCompleto} souOwner={ctx.souOwner}>
      {primeiroAcesso && <BoasVindasPlanner />}

      {/* grid-cols-1 = minmax(0, 1fr): sem isso, a largura mínima da grade
          de hábitos esticava a coluna inteira no celular (overflow de 20px). */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="order-1 lg:col-span-2">
          <HeroPlanner saudacao={saudacaoPorHorario(new Date())} nome={primeiroNome(ctx.email)} hoje={hoje} foco={foco} />
        </div>
        <div className="order-6 lg:order-2">
          <CardSugestao texto={sugestao} />
        </div>

        <div className="order-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:order-3 lg:col-span-3 xl:grid-cols-4">
          {ordemAreas.map((area) => (
            <CardArea
              key={area}
              area={area}
              consistencia={resumo[area].consistencia.percentual}
              metricas={resumo[area].metricas}
              vazio={resumo[area].vazio}
            />
          ))}
        </div>

        <div className="order-2 lg:order-4">
          <CardHoje hoje={hoje} rotuloData={rotuloData} itens={itensHoje} agendaIndisponivel={!ctx.acessoCompleto} />
        </div>
        <div className="order-3 lg:order-5">
          <CardMeusHabitos habitos={ativos.filter((h) => h.tipo === "habito")} registros={dados.registros} segunda={segunda} hoje={hoje} />
        </div>
        <div className="order-5 lg:order-6">
          <CardEstaSemana dias={semana.dias} concluidos={semana.concluidos} total={semana.total} hoje={hoje} />
        </div>
      </div>

      {!primeiroAcesso && <OpcaoResumoEmail ligado={dados.preferencias?.resumo_diario ?? true} />}
    </EstruturaPlanner>
  );
}
