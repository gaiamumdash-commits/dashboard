import Link from "next/link";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { primeiroDiaDoMesAtual } from "@/lib/ecc/kanban";
import type { Anexo, ContaAPagar, ContaFixaModelo } from "@/lib/ecc/tipos";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ListaContas } from "@/components/financeiro/lista-contas";
import { FormularioContaFixa } from "@/components/financeiro/formulario-conta-fixa";
import { ListaContasFixasModelo } from "@/components/financeiro/lista-contas-fixas-modelo";

export default async function PaginaContasFixas() {
  const tenantId = await garantirWorkspace();

  // Financeiro é dado sensível — só o owner do workspace enxerga.
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const supabase = await createClient();
  const mesReferencia = primeiroDiaDoMesAtual();

  const [{ data: contasFixasDoMes }, { data: modelos }, totalMetasSmart] = await Promise.all([
    supabase
      .from("contas_a_pagar")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("mes_referencia", mesReferencia)
      .not("conta_fixa_id", "is", null)
      .order("data_vencimento", { ascending: true }),
    supabase
      .from("contas_fixas_modelo")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: true }),
    contarMetasSmart(tenantId),
  ]);

  const lista = (contasFixasDoMes as ContaAPagar[] | null) ?? [];

  const [{ data: anexosDoMes }, { data: alarmesDoMes }] =
    lista.length > 0
      ? await Promise.all([
          supabase
            .from("anexos")
            .select("*")
            .eq("entidade_tipo", "conta_a_pagar")
            .in(
              "entidade_id",
              lista.map((c) => c.id),
            ),
          supabase
            .from("alarmes")
            .select("entidade_id, antecedencia_min")
            .eq("entidade_tipo", "conta_a_pagar")
            .in(
              "entidade_id",
              lista.map((c) => c.id),
            ),
        ])
      : [{ data: [] as Anexo[] }, { data: [] as { entidade_id: string; antecedencia_min: number }[] }];

  const anexosPorConta: Record<string, Anexo[]> = {};
  for (const anexo of (anexosDoMes as Anexo[] | null) ?? []) {
    (anexosPorConta[anexo.entidade_id] ??= []).push(anexo);
  }

  const alarmePorConta: Record<string, number> = {};
  for (const alarme of alarmesDoMes ?? []) {
    alarmePorConta[alarme.entidade_id] = alarme.antecedencia_min;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)} souOwner />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12">
        <Link href="/financeiro" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Financeiro
        </Link>

        <h1 className="mt-4 text-3xl font-semibold text-gaiamum-text">Contas fixas</h1>
        <p className="mt-1 text-gaiamum-text-muted">Ordenadas por vencimento — {lista.length} conta(s) no mês.</p>

        <div className="mt-8">
          <ListaContas
            contas={lista}
            anexosPorConta={anexosPorConta}
            alarmePorConta={alarmePorConta}
            caminhoRevalidar="/financeiro/fixas"
            mensagemVazio="Nenhuma ainda — cadastre uma conta fixa abaixo, ela aparece aqui a partir do próximo dia 1."
          />
        </div>

        <div className="mt-8">
          <FormularioContaFixa />
        </div>

        <div className="mt-8">
          <ListaContasFixasModelo modelos={(modelos as ContaFixaModelo[] | null) ?? []} />
        </div>
      </main>
    </div>
  );
}
