import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { temAcessoCompleto } from "@/lib/ecc/equipe";

export default async function PaginaInicial() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  // Quem entrou convidado só pra um quadro não vê Metas SMART — cai direto
  // na visão de projetos, sem passar pelo onboarding do workspace inteiro.
  if (!(await temAcessoCompleto(membership.tenant_id))) {
    redirect("/projetos");
  }

  const { count } = await supabase
    .from("metas_smart")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", membership.tenant_id);

  redirect(count && count > 0 ? "/projetos" : "/onboarding");
}
