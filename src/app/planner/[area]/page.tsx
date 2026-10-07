import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { carregarArea, contextoPlanner } from "@/lib/ecc/planner/dados";
import { resumoDasAreas } from "@/lib/ecc/planner/painel";
import { ehAreaPlanner, ROTULO_AREA } from "@/lib/ecc/planner/regras";
import { EstruturaPlanner } from "@/components/planner/estrutura-planner";
import { AbasArea, abaValida } from "@/components/planner/abas-area";
import { VisaoGeralArea } from "@/components/planner/visao-geral-area";
import { SecaoCompromissos, SecaoNotas, SecaoObjetivos, SecaoRecorrentes } from "@/components/planner/secoes-comuns";
import { SecaoCursos, SecaoLeituras } from "@/components/planner/secoes-estudos";
import { SecaoCardapio, SecaoCompras, SecaoManutencoes, SecaoPets } from "@/components/planner/secoes-casa";

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }): Promise<Metadata> {
  const { area } = await params;
  return { title: ehAreaPlanner(area) ? `${ROTULO_AREA[area]} · Planner · Gaiamum` : "Planner · Gaiamum" };
}

/** Uma área do Planner (/planner/pessoal, /estudos, /casa, /saude). Não
 * existe /planner/financeiro de propósito: o Financeiro do Gaiamum é a
 * única fonte de verdade financeira. */
export default async function PaginaAreaPlanner({
  params,
  searchParams,
}: {
  params: Promise<{ area: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const [{ area }, { aba: abaBruta }] = await Promise.all([params, searchParams]);
  if (!ehAreaPlanner(area)) notFound();

  const ctx = await contextoPlanner();
  const dados = await carregarArea(ctx.tenantId, area, { acessoCompleto: ctx.acessoCompleto });
  const aba = abaValida(area, abaBruta);
  const { hoje, segunda } = dados.semana;
  const agora = new Date().toISOString();

  const comum = { area, habitos: dados.habitos, registros: dados.registros, segunda, hoje };
  const pets = dados.pets.map(({ id, nome }) => ({ id, nome }));

  const conteudo = (() => {
    if (aba === "visao") {
      const resumo = resumoDasAreas({
        segunda,
        hoje,
        habitos: dados.habitos,
        registros: dados.registros,
        compromissosSemana: dados.compromissos.filter(
          (c) => c.inicio.slice(0, 10) >= segunda && c.inicio.slice(0, 10) < dados.semana.fimExclusivo,
        ),
        objetivosAtivos: dados.objetivos.filter((o) => o.status === "em_andamento"),
        leiturasEmAndamento: dados.leituras.filter((l) => l.status === "lendo").length,
        comprasPendentes: dados.compras.filter((c) => !c.comprado).length,
        diasCardapio: new Set(dados.cardapio.map((c) => c.dia_semana)).size,
        proximaConsulta: dados.compromissos.find((c) => c.tipo === "consulta" && !c.concluido && c.inicio >= agora) ?? null,
        lembretesSaude: dados.compromissos.filter((c) => !c.concluido && c.inicio >= agora).length,
      })[area];
      return <VisaoGeralArea area={area} resumo={resumo} dados={dados} agora={agora} />;
    }

    switch (`${area}:${aba}`) {
      case "pessoal:rotina":
        return (
          <SecaoRecorrentes
            {...comum}
            tipo="rotina"
            titulo="Rotina"
            descricao="O que se repete no seu dia, com horário: aparece no card “Hoje” na hora certa."
            textoVazio="Ex.: Planejamento do dia às 08:00, de segunda a sexta."
          />
        );
      case "pessoal:habitos":
      case "saude:habitos":
        return (
          <SecaoRecorrentes
            {...comum}
            tipo="habito"
            titulo="Hábitos"
            descricao="Acompanhe a consistência da semana. Pra parar sem perder o histórico, arquive."
            textoVazio={area === "saude" ? "Ex.: Beber água, dormir antes das 23h, caminhar." : "Ex.: Ler 10 minutos, meditar, escrever um diário."}
          />
        );
      case "pessoal:objetivos":
        return <SecaoObjetivos area="pessoal" objetivos={dados.objetivos} metasSmart={dados.metasSmart} hoje={hoje} />;
      case "pessoal:notas":
        return <SecaoNotas area="pessoal" notas={dados.notas} />;

      case "estudos:metas":
        return <SecaoObjetivos area="estudos" titulo="Metas de estudo" objetivos={dados.objetivos} metasSmart={dados.metasSmart} hoje={hoje} />;
      case "estudos:rotina":
        return (
          <div className="flex flex-col gap-5">
            <SecaoRecorrentes
              {...comum}
              tipo="rotina"
              titulo="Rotina de estudos"
              descricao="Sessões com dia e horário. Com duração preenchida, o tempo entra em “estudados na semana”."
              textoVazio="Ex.: Estudar inglês, 30 min, seg/qua/sex às 07:00."
            />
            <SecaoRecorrentes
              {...comum}
              tipo="habito"
              titulo="Hábitos de estudo"
              descricao="Sem horário fixo — só a constância."
              textoVazio="Ex.: Ler 20 páginas por dia."
            />
          </div>
        );
      case "estudos:leituras":
        return <SecaoLeituras leituras={dados.leituras} />;
      case "estudos:cursos":
        return <SecaoCursos tipo="curso" cursos={dados.cursos} />;
      case "estudos:idiomas":
        return <SecaoCursos tipo="idioma" cursos={dados.cursos} />;

      case "casa:rotinas":
        return (
          <SecaoRecorrentes
            {...comum}
            tipo="rotina"
            titulo="Rotinas da casa"
            descricao="Tarefas domésticas que se repetem. Ficam aqui, não no Kanban de projetos."
            textoVazio="Ex.: Lavar roupa sábado às 09:00, regar plantas seg/qui."
          />
        );
      case "casa:compras":
        return <SecaoCompras compras={dados.compras} />;
      case "casa:cardapio":
        return <SecaoCardapio semana={segunda} cardapio={dados.cardapio} hoje={hoje} />;
      case "casa:pets":
        return (
          <div className="flex flex-col gap-5">
            <SecaoPets pets={dados.pets} />
            <SecaoCompromissos
              area="casa"
              tipo="pet"
              titulo="Compromissos do pet"
              descricao="Vacina, banho, veterinário."
              compromissos={dados.compromissos}
              pets={pets}
              hoje={hoje}
              agora={agora}
            />
          </div>
        );
      case "casa:manutencoes":
        return <SecaoManutencoes manutencoes={dados.manutencoes} hoje={hoje} />;

      case "saude:rotina":
        return (
          <SecaoRecorrentes
            {...comum}
            tipo="rotina"
            titulo="Rotina de bem-estar"
            descricao="Atividade física, sono, pausas — com dia e horário."
            textoVazio="Ex.: Caminhada seg/qua/sex às 07:00."
          />
        );
      case "saude:consultas":
        return (
          <SecaoCompromissos
            area="saude"
            tipo="consulta"
            titulo="Consultas"
            descricao="Só o agendamento (quando e onde). O Gaiamum não guarda dado clínico."
            compromissos={dados.compromissos}
            hoje={hoje}
            agora={agora}
          />
        );
      case "saude:bem-estar":
        return (
          <div className="flex flex-col gap-5">
            <SecaoObjetivos area="saude" titulo="Objetivos de bem-estar" objetivos={dados.objetivos} metasSmart={[]} hoje={hoje} />
            <SecaoNotas area="saude" titulo="Anotações de bem-estar" notas={dados.notas} />
          </div>
        );
      default:
        notFound();
    }
  })();

  return (
    <EstruturaPlanner area={area} temMetasSmart={ctx.temMetasSmart} acessoCompleto={ctx.acessoCompleto} souOwner={ctx.souOwner}>
      <AbasArea area={area} ativa={aba} />
      {conteudo}
    </EstruturaPlanner>
  );
}
