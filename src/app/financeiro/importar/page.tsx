import Link from "next/link";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import type { RegraCategoria } from "@/lib/ecc/tipos";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ImportarExtrato } from "@/components/financeiro/importar-extrato";
import { ListaRegrasCategoria } from "@/components/financeiro/lista-regras-categoria";

export default async function PaginaImportarExtrato() {
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const supabase = await createClient();

  const [{ data: regras }, { count: totalMetasSmart }] = await Promise.all([
    supabase
      .from("contas_categoria_regras")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: true }),
    supabase.from("metas_smart").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)} souOwner />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-12">
        <Link href="/financeiro" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Financeiro
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Importar extrato</h1>
        <p className="mt-1 text-gaiamum-text-muted">
          Sobe o CSV do banco, revisa a categoria sugerida de cada linha e confirma — vira lançamento avulso já
          pago.
        </p>

        <div className="mt-8">
          <ImportarExtrato regras={(regras as RegraCategoria[] | null) ?? []} />
        </div>

        <div className="mt-8">
          <ListaRegrasCategoria regras={(regras as RegraCategoria[] | null) ?? []} />
        </div>
      </main>
    </div>
  );
}
