import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { listarMembrosComAcessoAoProjeto, obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import type { Anexo, ChecklistItem, ColunaKanban, Projeto, Tarefa, TarefaEtiqueta, TarefaMembro } from "@/lib/ecc/tipos";
import { listarEtiquetasDoTenant } from "@/lib/ecc/etiquetas";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { CLASSE_FUNDO_QUADRO, hojeISOBrasil } from "@/lib/ecc/kanban";
import { calcularSaudeProjeto } from "@/lib/ecc/painel-geral";
import { QuadroKanban } from "@/components/kanban/quadro-kanban";
import { ColunaCompromissosDoDia } from "@/components/kanban/coluna-compromissos-do-dia";
import { FaixaProximoCompromisso, FaixaProximoCompromissoCarregando } from "@/components/kanban/faixa-proximo-compromisso";
import { MenuAcoesProjeto } from "@/components/kanban/menu-acoes-projeto";
import { CLASSE_SAUDE, ROTULO_SAUDE } from "@/components/painel/projetos-em-foco";
import { MenuLateral } from "@/components/layout/menu-lateral";

/** Botão de ação do cabeçalho do projeto (Páginas, Visão 360°, Decisões,
 * Indicadores) — visual do mockup aprovado do Kanban (2026-10-05). */
function LinkAcaoProjeto({ href, icone, children }: { href: string; icone: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-gaiamum-border bg-gaiamum-surface px-2.5 text-[13px] font-medium text-gaiamum-text transition hover:border-gaiamum-primary sm:h-9 sm:px-3"
    >
      <span aria-hidden className="text-sm leading-none">
        {icone}
      </span>
      {children}
    </Link>
  );
}

export default async function PaginaTarefas({ params }: { params: Promise<{ id: string }> }) {
  const { id: projetoId } = await params;
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  const [
    { data: projeto },
    { data: colunas },
    { data: tarefas },
    totalMetasSmart,
    { data: tarefaMembros },
    { data: checklistItens },
    { data: tarefaEtiquetas },
    etiquetas,
    membros,
    papelAtual,
    acessoCompleto,
    { data: gestorDoProjeto },
  ] = await Promise.all([
    supabase.from("projetos").select("*").eq("id", projetoId).eq("tenant_id", tenantId).maybeSingle(),
    supabase
      .from("colunas_kanban")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("concluido", { ascending: true })
      .order("ordem", { ascending: true }),
    supabase.from("tarefas").select("*").eq("projeto_id", projetoId).order("ordem", { ascending: true }),
    contarMetasSmart(tenantId),
    supabase.from("tarefa_membros").select("*").eq("tenant_id", tenantId),
    supabase.from("tarefa_checklist_itens").select("*").eq("tenant_id", tenantId).order("ordem"),
    supabase.from("tarefa_etiquetas").select("*").eq("tenant_id", tenantId),
    listarEtiquetasDoTenant(tenantId),
    listarMembrosComAcessoAoProjeto(tenantId, projetoId),
    obterPapelAtual(tenantId),
    temAcessoCompleto(tenantId),
    user
      ? supabase
          .from("projeto_membros")
          .select("id")
          .eq("projeto_id", projetoId)
          .eq("user_id", user.id)
          .eq("papel", "gestor")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!projeto) {
    notFound();
  }

  const podeExcluirTarefa = papelAtual === "owner" || Boolean(gestorDoProjeto);
  const listaTarefas = (tarefas as Tarefa[]) ?? [];

  const [{ data: anexosDasTarefas }, { data: alarmesDasTarefas }, { data: contasGeradas }] =
    listaTarefas.length > 0
      ? await Promise.all([
          supabase
            .from("anexos")
            .select("*")
            .eq("entidade_tipo", "tarefa")
            .in(
              "entidade_id",
              listaTarefas.map((t) => t.id),
            ),
          supabase
            .from("alarmes")
            .select("entidade_id, antecedencia_min")
            .eq("entidade_tipo", "tarefa")
            .in(
              "entidade_id",
              listaTarefas.map((t) => t.id),
            ),
          // RLS de contas_a_pagar é owner-only — pra quem não é owner, isso
          // simplesmente volta vazio (sem erro), o que já é o comportamento
          // certo, já que só owner vê o botão/indicador de "gerar conta".
          supabase
            .from("contas_a_pagar")
            .select("tarefa_id")
            .not("tarefa_id", "is", null)
            .in(
              "tarefa_id",
              listaTarefas.map((t) => t.id),
            ),
        ])
      : [
          { data: [] as Anexo[] },
          { data: [] as { entidade_id: string; antecedencia_min: number }[] },
          { data: [] as { tarefa_id: string | null }[] },
        ];

  const alarmePorTarefa: Record<string, number> = {};
  for (const alarme of alarmesDasTarefas ?? []) {
    alarmePorTarefa[alarme.entidade_id] = alarme.antecedencia_min;
  }
  const tarefasComContaGerada = (contasGeradas ?? []).map((c) => c.tarefa_id as string);

  // Selo de saúde ("No caminho"/"Atenção") — regra que JÁ existe e já é
  // usada no Painel geral (`calcularSaudeProjeto`: "Atenção" com pelo menos
  // 1 tarefa aberta atrasada). Nenhuma regra nova pra este redesenho.
  const colunasConcluidoIds = new Set(((colunas as ColunaKanban[]) ?? []).filter((c) => c.concluido).map((c) => c.id));
  const saude = calcularSaudeProjeto(listaTarefas, colunasConcluidoIds);
  const hojeChave = hojeISOBrasil();
  // "Segunda, 5 de Outubro" — formato do mockup aprovado (dia da semana sem
  // "-feira", dia e mês com inicial maiúscula, "de" minúsculo).
  const partesHoje = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(new Date(`${hojeChave}T12:00:00Z`));
  const parteHoje = (tipo: Intl.DateTimeFormatPartTypes) => partesHoje.find((p) => p.type === tipo)?.value ?? "";
  const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
  const rotuloHoje = `${maiuscula(parteHoje("weekday").replace("-feira", ""))}, ${parteHoje("day")} de ${maiuscula(parteHoje("month"))}`;

  return (
    // `overflow-x-hidden` — rede de segurança contra rolagem horizontal da
    // PÁGINA INTEIRA (achado real de teste, Playwright 390px): mesmo com
    // `min-w-0` no <main>, um container flex-column cujo filho tem conteúdo
    // intrinsecamente largo (o quadro Kanban, com várias colunas lado a
    // lado) pode esticar além do pai em alguns casos de cálculo de
    // cross-axis do flexbox — isso faz a página toda ganhar uma 2ª barra de
    // rolagem horizontal, competindo com a do próprio quadro
    // (`overflow-x-auto`, que continua funcionando normalmente aqui dentro,
    // já que overflow aninhado funciona mesmo com o pai cortando o excesso).
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-gaiamum-bg sm:flex-row">
      <MenuLateral
        temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)}
        acessoCompleto={acessoCompleto}
        souOwner={papelAtual === "owner"}
      />
      {/* `min-w-0` — achado real de teste (Playwright, 390px), 2026-09-30:
          sem isso, este `<main>` (flex-1 dentro do flex-col/sm:flex-row
          acima) crescia pra caber o conteúdo largo do Kanban em vez de ser
          limitado pelo pai, e a PÁGINA INTEIRA ganhava rolagem horizontal —
          o quadro então tinha DOIS scrolls horizontais competindo (o da
          página e o do próprio `overflow-x-auto` do quadro). Provavelmente
          já acontecia antes desta rodada (as colunas de 256px fixas também
          somavam mais que 390px), só menos perceptível.
          SEM `max-w-*` de propósito (pedido do Fabio, 2026-10-04): "quero
          usar o cartão Kanban na tela inteira... fica uma parte da tela só
          usada e a experiência é ruim" — diferente de outras páginas do
          app (texto/formulário, onde um teto de largura ajuda a leitura), o
          quadro é feito pra usar toda a largura disponível: mais colunas
          visíveis ao mesmo tempo lado a lado em vez de sobrar espaço vazio
          nas bordas numa tela grande. */}
      <main className="mx-auto w-full min-w-0 flex-1 px-4 pb-8 pt-5 sm:px-6">
        {/* Cor de fundo escolhida nas Configurações do quadro — mantida como
            filete fino no topo (redesenho 2026-10-05: o mockup não tem a
            faixa grossa, mas a cor continua sendo o sinal visual do projeto). */}
        <div className={`-mx-4 -mt-5 mb-4 h-1 sm:-mx-6 ${CLASSE_FUNDO_QUADRO[(projeto as Projeto).cor_fundo]}`} />

        <Link href="/projetos" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Projetos
        </Link>

        {/* `lg:flex-nowrap`: ações na mesma linha do título, à direita, como
            no mockup — se o título for longo, é ele que quebra de linha. No
            celular as ações ficam compactas (h-8) logo abaixo do título. */}
        <div className="mt-1 flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="min-w-0 lg:flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-[1.375rem] font-bold leading-tight text-gaiamum-text sm:text-[1.625rem] 2xl:text-[2rem]">
                {(projeto as Projeto).nome}
              </h1>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:text-xs ${CLASSE_SAUDE[saude]}`}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                {ROTULO_SAUDE[saude]}
              </span>
            </div>
            {(projeto as Projeto).descricao && (
              <p className="mt-0.5 text-sm text-gaiamum-text-muted">{(projeto as Projeto).descricao}</p>
            )}
          </div>
          {/* Mesmas regras de exibição de antes: Páginas pra todos; Visão
              360°/Decisões/Indicadores só owner; Freeze/Configurações (agora
              no ⋯) só owner ou gestor do projeto. O servidor/RLS continua
              sendo a segurança real — isto só esconde botões. */}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 lg:mt-1.5 lg:flex-nowrap">
            <LinkAcaoProjeto href={`/projetos/${projetoId}/paginas`} icone="📄">
              Páginas
            </LinkAcaoProjeto>
            {papelAtual === "owner" && (
              <>
                <LinkAcaoProjeto href={`/projetos/${projetoId}/visao-360`} icone="🧭">
                  Visão 360°
                </LinkAcaoProjeto>
                <LinkAcaoProjeto href={`/projetos/${projetoId}/decisoes`} icone="📋">
                  Decisões
                </LinkAcaoProjeto>
                <LinkAcaoProjeto href={`/projetos/${projetoId}/indicadores`} icone="📊">
                  Indicadores
                </LinkAcaoProjeto>
              </>
            )}
            {podeExcluirTarefa && <MenuAcoesProjeto projetoId={projetoId} nomeProjeto={(projeto as Projeto).nome} />}
          </div>
        </div>

        <div className="mt-4">
          <QuadroKanban
            projetoId={projetoId}
            colunasIniciais={(colunas as ColunaKanban[]) ?? []}
            tarefasIniciais={listaTarefas}
            membrosDoTenant={membros}
            tarefaMembrosIniciais={(tarefaMembros as TarefaMembro[]) ?? []}
            checklistItensIniciais={(checklistItens as ChecklistItem[]) ?? []}
            etiquetasDoTenant={etiquetas}
            tarefaEtiquetasIniciais={(tarefaEtiquetas as TarefaEtiqueta[]) ?? []}
            anexosIniciais={(anexosDasTarefas as Anexo[] | null) ?? []}
            alarmePorTarefa={alarmePorTarefa}
            usuarioAtualId={user?.id ?? null}
            podeExcluirTarefa={podeExcluirTarefa}
            souOwner={papelAtual === "owner"}
            tarefasComContaGerada={tarefasComContaGerada}
            colunaCompromissos={
              acessoCompleto ? (
                <Suspense fallback={null}>
                  <ColunaCompromissosDoDia tenantId={tenantId} />
                </Suspense>
              ) : null
            }
            faixaCompromisso={
              acessoCompleto ? (
                <Suspense fallback={<FaixaProximoCompromissoCarregando />}>
                  <FaixaProximoCompromisso tenantId={tenantId} />
                </Suspense>
              ) : null
            }
            rotuloHoje={rotuloHoje}
            hojeChave={hojeChave}
          />
        </div>
      </main>
    </div>
  );
}
