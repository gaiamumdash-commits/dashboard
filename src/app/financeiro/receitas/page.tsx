import Link from "next/link";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { primeiroDiaDoMesAtual } from "@/lib/ecc/kanban";
import type { Receita } from "@/lib/ecc/tipos";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ListaReceitas } from "@/components/financeiro/lista-receitas";
import { FormularioReceita } from "@/components/financeiro/formulario-receita";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PaginaReceitas() {
  const tenantId = await garantirWorkspace();

  // Financeiro é dado sensível — só o owner do workspace enxerga.
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const supabase = await createClient();
  const mesReferencia = primeiroDiaDoMesAtual();

  const [{ data: receitasDoMes }, { data: projetos }, totalMetasSmart] = await Promise.all([
    supabase
      .from("receitas")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("mes_referencia", mesReferencia)
      .order("data_prevista", { ascending: true }),
    supabase.from("projetos").select("id, nome, arquivado").eq("tenant_id", tenantId).order("nome", { ascending: true }),
    contarMetasSmart(tenantId),
  ]);

  const lista = (receitasDoMes as Receita[] | null) ?? [];
  const listaProjetos = (projetos as { id: string; nome: string; arquivado: boolean }[] | null) ?? [];
  // Nomes de TODOS os projetos (inclusive arquivados) pra etiqueta da lista;
  // só os ativos aparecem como opção no formulário.
  const nomesProjetos = Object.fromEntries(listaProjetos.map((p) => [p.id, p.nome]));
  const projetosAtivos = listaProjetos.filter((p) => !p.arquivado).map(({ id, nome }) => ({ id, nome }));

  const totalPrevisto = lista.reduce((soma, r) => soma + r.valor, 0);
  const totalRecebido = lista.filter((r) => r.recebida).reduce((soma, r) => soma + r.valor, 0);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)} souOwner />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12">
        <Link href="/financeiro" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Financeiro
        </Link>

        <h1 className="mt-4 text-3xl font-semibold text-gaiamum-text">Receitas</h1>
        <p className="mt-1 text-gaiamum-text-muted">
          {formatarMoeda(totalRecebido)} recebido de {formatarMoeda(totalPrevisto)} previsto no mês.
        </p>

        <div className="mt-8">
          <FormularioReceita projetos={projetosAtivos} />
        </div>

        <div className="mt-8">
          <ListaReceitas receitas={lista} nomesProjetos={nomesProjetos} />
        </div>
      </main>
    </div>
  );
}
