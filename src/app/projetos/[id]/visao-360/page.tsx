import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import type { ColunaKanban, MetaSmart, Projeto, Tarefa } from "@/lib/ecc/tipos";
import { listarDecisoesDoProjeto } from "@/lib/ecc/decisoes";
import { listarIndicadoresDoProjeto } from "@/lib/ecc/indicadores";
import { alinhamentoTemDadosReais, calcularAlinhamentoGaiamum } from "@/lib/ecc/visao-360";
import { concederPatente } from "@/lib/ecc/lab/patentes";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import { AlinhamentoGaiamumBloco } from "@/components/projetos/alinhamento-gaiamum";
import { ExplicacaoAlinhamentoBloco } from "@/components/projetos/explicacao-alinhamento";

export default async function PaginaVisao360({ params }: { params: Promise<{ id: string }> }) {
  const { id: projetoId } = await params;
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const { data: projeto } = await supabase
    .from("projetos")
    .select("*")
    .eq("id", projetoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!projeto) {
    notFound();
  }

  const papelAtual = await obterPapelAtual(tenantId);
  const souOwner = papelAtual === "owner";

  if (!souOwner) {
    redirect(`/projetos/${projetoId}/tarefas`);
  }

  const projetoTipado = projeto as Projeto;

  const [{ data: colunas }, { data: tarefas }, decisoes, indicadores, { data: metaSmart }] = await Promise.all([
    supabase.from("colunas_kanban").select("*").eq("projeto_id", projetoId),
    supabase.from("tarefas").select("*").eq("projeto_id", projetoId),
    listarDecisoesDoProjeto(projetoId),
    listarIndicadoresDoProjeto(projetoId),
    projetoTipado.meta_smart_id
      ? supabase.from("metas_smart").select("*").eq("id", projetoTipado.meta_smart_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const listaColunas = (colunas as ColunaKanban[]) ?? [];
  const listaTarefas = (tarefas as Tarefa[]) ?? [];
  const colunasConcluidoIds = new Set(listaColunas.filter((c) => c.concluido).map((c) => c.id));
  const marcos = listaTarefas.filter((t) => t.is_marco);
  const totalTarefas = listaTarefas.length;
  const concluidas = listaTarefas.filter((t) => colunasConcluidoIds.has(t.coluna_id)).length;
  const progressoQuadro = totalTarefas === 0 ? null : Math.round((100 * concluidas) / totalTarefas);

  const alinhamento = calcularAlinhamentoGaiamum({
    metaSmartId: projetoTipado.meta_smart_id,
    tarefas: listaTarefas,
    colunasConcluidoIds,
    indicadores,
  });

  const decisoesRecentes = decisoes.slice(0, 5);

  // Patente Estrategista: primeira vez que o Alinhamento de um projeto REAL
  // do usuário deixa de estar vazio. Sem checagem extra "isso não é o
  // projeto do Café Mangue": `tenantId` acima vem de garantirWorkspace(),
  // que resolve sempre a membership mais antiga do usuário — o tenant do
  // Lab é garantidamente mais novo (garantirTenantLab() sempre chama
  // garantirWorkspace() antes de criar o tenant do Lab), então essa página
  // nunca renderiza dados do Café Mangue: um projetoId do Lab não bate com
  // `.eq("tenant_id", tenantId)` na busca acima, e cai em notFound() antes
  // de chegar aqui.
  if (alinhamentoTemDadosReais(alinhamento)) {
    const user = await obterUsuarioAtual();
    if (user) {
      try {
        await concederPatente(user.id, "estrategista", { projetoId });
      } catch {
        // nunca quebra o render da página por causa disso
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner={souOwner} />
      <main className="mx-auto flex max-w-4xl flex-1 flex-col gap-8 px-4 py-10">
        <div>
          <Link href={`/projetos/${projetoId}/tarefas`} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
            ← {projetoTipado.nome}
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Visão 360°</h1>
        </div>

        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">Resultado esperado</h2>
          {projetoTipado.resultado_esperado ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gaiamum-text">{projetoTipado.resultado_esperado}</p>
          ) : (
            <p className="mt-2 text-sm text-gaiamum-text-muted">
              Ainda não definido.{" "}
              <Link href={`/projetos/${projetoId}/configuracoes`} className="text-gaiamum-primary hover:underline">
                Definir agora →
              </Link>
            </p>
          )}
          {metaSmart && (
            <p className="mt-3 text-xs text-gaiamum-text-muted">
              Meta SMART vinculada: <span className="text-gaiamum-text">{(metaSmart as MetaSmart).specific}</span>
            </p>
          )}
        </section>

        <AlinhamentoGaiamumBloco alinhamento={alinhamento} />

        <ExplicacaoAlinhamentoBloco projetoId={projetoId} temDados={alinhamentoTemDadosReais(alinhamento)} />

        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">Progresso do quadro</h2>
          <div className="mt-3">
            {progressoQuadro === null ? (
              <p className="text-sm text-gaiamum-text-muted">Quadro sem tarefas ainda.</p>
            ) : (
              <BarraProgresso percentual={progressoQuadro} rotulo={`${concluidas} de ${totalTarefas} tarefa(s)`} />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">🚩 Marcos</h2>
          {marcos.length === 0 ? (
            <p className="mt-2 text-sm text-gaiamum-text-muted">Nenhuma tarefa marcada como marco ainda.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {marcos.map((marco) => (
                <li key={marco.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className={colunasConcluidoIds.has(marco.coluna_id) ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"}>
                    {marco.titulo}
                  </span>
                  {marco.data_limite && (
                    <span className="shrink-0 text-xs text-gaiamum-text-muted">
                      {new Date(marco.data_limite).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gaiamum-text">📊 Indicadores</h2>
            <Link href={`/projetos/${projetoId}/indicadores`} className="text-xs text-gaiamum-primary hover:underline">
              ver todos →
            </Link>
          </div>
          {indicadores.length === 0 ? (
            <p className="mt-2 text-sm text-gaiamum-text-muted">Nenhum indicador cadastrado ainda.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {indicadores.map((indicador) => (
                <BarraProgresso
                  key={indicador.id}
                  percentual={indicador.meta > 0 ? Math.round(Math.min(indicador.valor_atual / indicador.meta, 1) * 100) : 0}
                  rotulo={`${indicador.nome} (${indicador.valor_atual}/${indicador.meta} ${indicador.unidade})`}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gaiamum-text">📋 Decisões recentes</h2>
            <Link href={`/projetos/${projetoId}/decisoes`} className="text-xs text-gaiamum-primary hover:underline">
              ver todas →
            </Link>
          </div>
          {decisoesRecentes.length === 0 ? (
            <p className="mt-2 text-sm text-gaiamum-text-muted">Nenhuma decisão registrada ainda.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {decisoesRecentes.map((decisao) => (
                <li key={decisao.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-gaiamum-text">{decisao.titulo}</span>
                    <span className="shrink-0 text-xs text-gaiamum-text-muted">
                      {new Date(decisao.data).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gaiamum-text-muted">{decisao.decisao}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
