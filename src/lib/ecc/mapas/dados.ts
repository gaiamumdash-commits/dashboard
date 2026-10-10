import "server-only";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { contextoPlanner } from "@/lib/ecc/planner/dados";
import type { Mapa, NoMapa } from "@/lib/ecc/mapas/tipos";

// Leituras dos Mapas. A RLS (migration 0059) devolve os mapas da pessoa e
// os compartilhados com o workspace; aqui separamos os dois.

const COLUNAS_MAPA = "id, tenant_id, user_id, titulo, compartilhado, criado_em, atualizado_em";
const COLUNAS_NO = "id, mapa_id, pai_id, ordem, texto, nota, recolhido";

/** Mesmo contexto do Planner (menu lateral, papel, acesso) + quem sou eu. */
export async function contextoMapas() {
  const [ctx, usuario] = await Promise.all([contextoPlanner(), obterUsuarioAtual()]);
  return { ...ctx, userId: usuario?.id ?? "" };
}

export async function listarMapas(tenantId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mapas")
    .select(COLUNAS_MAPA)
    .eq("tenant_id", tenantId)
    .order("atualizado_em", { ascending: false })
    .limit(200);
  if (error) console.error("Mapas: listar", error);
  const todos = (data ?? []) as Mapa[];
  return {
    // Tabela ainda não criada em produção (migration 0059 pendente) ou
    // banco fora do ar: a tela avisa em vez de oferecer criar e falhar.
    indisponivel: Boolean(error),
    meus: todos.filter((m) => m.user_id === userId),
    compartilhados: todos.filter((m) => m.user_id !== userId),
  };
}

/** Mapa + ramos, ou null se não existe / não é visível pra esta pessoa. */
export async function carregarMapa(tenantId: string, mapaId: string): Promise<{ mapa: Mapa; nos: NoMapa[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(mapaId)) return null;
  const supabase = await createClient();
  const [{ data: mapa, error }, { data: nos, error: erroNos }] = await Promise.all([
    supabase.from("mapas").select(COLUNAS_MAPA).eq("id", mapaId).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("mapa_nos").select(COLUNAS_NO).eq("mapa_id", mapaId).eq("tenant_id", tenantId),
  ]);
  if (error || erroNos) console.error("Mapas: carregar", error ?? erroNos);
  if (!mapa) return null;
  return { mapa: mapa as Mapa, nos: (nos ?? []) as NoMapa[] };
}
