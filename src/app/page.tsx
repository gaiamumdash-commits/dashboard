import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const { count } = await supabase
    .from("metas_smart")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", membership.tenant_id);

  redirect(count && count > 0 ? "/projetos" : "/onboarding");
}
