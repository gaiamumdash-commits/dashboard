import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { FormularioSmart } from "@/components/onboarding/formulario-smart";

export default async function PaginaOnboarding() {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const { count } = await supabase
    .from("metas_smart")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (count && count > 0) {
    redirect("/projetos");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-gaiamum-text">Vamos montar sua visão</h1>
      <p className="mt-2 text-gaiamum-text-muted">
        Antes de criar projetos e tarefas, defina onde seu negócio precisa chegar. Cada meta vira uma
        meta SMART: Específica, Mensurável, Atingível, Relevante e Temporal.
      </p>

      <FormularioSmart />
    </main>
  );
}
