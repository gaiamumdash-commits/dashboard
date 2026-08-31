import Link from "next/link";
import { notFound } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { listarMembros, obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import type { Anexo, ChecklistItem, ColunaKanban, Projeto, Tarefa, TarefaEtiqueta, TarefaMembro } from "@/lib/ecc/tipos";
import { listarEtiquetasDoTenant } from "@/lib/ecc/etiquetas";
import { CLASSE_FUNDO_QUADRO } from "@/lib/ecc/kanban";
import { QuadroKanban } from "@/components/kanban/quadro-kanban";
import { MenuLateral } from "@/components/layout/menu-lateral";

export default async function PaginaTarefas({ params }: { params: Promise<{ id: string }> }) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: colunas },
    { data: tarefas },
    { count: totalMetasSmart },
    { data: tarefaMembros },
    { data: checklistItens },
    { data: tarefaEtiquetas },
    etiquetas,
    membros,
    papelAtual,
    acessoCompleto,
    { data: gestorDoProjeto },
  ] = await Promise.all([
    supabase
      .from("colunas_kanban")
      .select("*")
      .eq("projeto_id", projetoId)
      .order("concluido", { ascending: true })
      .order("ordem", { ascending: true }),
    supabase.from("tarefas").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: true }),
    supabase.from("metas_smart").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("tarefa_membros").select("*").eq("tenant_id", tenantId),
    supabase.from("tarefa_checklist_itens").select("*").eq("tenant_id", tenantId).order("ordem"),
    supabase.from("tarefa_etiquetas").select("*").eq("tenant_id", tenantId),
    listarEtiquetasDoTenant(tenantId),
    listarMembros(tenantId),
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

  const podeExcluirTarefa = papelAtual === "owner" || Boolean(gestorDoProjeto);
  const listaTarefas = (tarefas as Tarefa[]) ?? [];

  const { data: anexosDasTarefas } =
    listaTarefas.length > 0
      ? await supabase
          .from("anexos")
          .select("*")
          .eq("entidade_tipo", "tarefa")
          .in(
            "entidade_id",
            listaTarefas.map((t) => t.id),
          )
      : { data: [] as Anexo[] };

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral
        temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)}
        acessoCompleto={acessoCompleto}
        souOwner={papelAtual === "owner"}
      />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-10">
        <div className={`-mx-4 -mt-10 mb-8 h-2 sm:-mx-4 ${CLASSE_FUNDO_QUADRO[(projeto as Projeto).cor_fundo]}`} />

        <Link href="/projetos" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Projetos
        </Link>

        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gaiamum-text">{(projeto as Projeto).nome}</h1>
            {(projeto as Projeto).descricao && (
              <p className="mt-1 text-gaiamum-text-muted">{(projeto as Projeto).descricao}</p>
            )}
          </div>
          {podeExcluirTarefa && (
            <Link
              href={`/projetos/${projetoId}/configuracoes`}
              className="shrink-0 rounded-lg border border-gaiamum-border px-3 py-1.5 text-sm text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
            >
              ⚙ Configurações
            </Link>
          )}
        </div>

        <div className="mt-8">
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
            usuarioAtualId={user?.id ?? null}
            podeExcluirTarefa={podeExcluirTarefa}
          />
        </div>
      </main>
    </div>
  );
}
