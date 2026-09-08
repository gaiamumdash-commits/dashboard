import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Tag usada tanto na leitura cacheada (contarMetasSmart) quanto na
 * invalidação (revalidateTag em criarMetasSmart, src/lib/ecc/actions.ts) —
 * a mesma string dos dois lados evita divergência por digitação.
 */
export function tagMetasSmart(tenantId: string): string {
  return `metas-smart:${tenantId}`;
}

/**
 * Contagem de metas_smart por tenant, cacheada com unstable_cache — não
 * "use cache" (o app não liga cacheComponents). Serve só pra decidir se o
 * CTA "criar suas metas" aparece no menu lateral (UI, não é dado sensível).
 *
 * Usa o service client (bypassa RLS) porque createClient() lê cookies()
 * internamente, e o Next lança erro se cookies()/headers() forem chamados
 * de dentro do escopo de um unstable_cache. É seguro porque: filtramos
 * explicitamente por tenant_id = tenantId; tenantId aqui nunca vem de
 * input do cliente — chega já resolvido por garantirWorkspace() (mesmo
 * padrão de confiança documentado em src/lib/ecc/workspace.ts); e o único
 * dado que sai do banco é um número (head: true), nunca linhas.
 *
 * O tenantId dentro de keyParts é o que garante isolamento por tenant na
 * chave de cache — não é a closure nem o fato de recriar o wrapper a cada
 * chamada. A tag também precisa ser dinâmica (por tenant) pra
 * revalidateTag invalidar só o tenant certo.
 *
 * revalidate: 3600 é rede de segurança, mas o revalidateTag em
 * criarMetasSmart não é opcional: sem ele, a contagem "0" que o
 * onboarding lê ANTES do usuário preencher o formulário fica presa em
 * cache por até 1h mesmo depois do INSERT — isso é o caminho principal
 * do dia 1 de uso de qualquer tenant novo, não um edge case.
 */
export async function contarMetasSmart(tenantId: string): Promise<number> {
  const buscar = unstable_cache(
    async () => {
      const service = createServiceClient();
      const { count } = await service
        .from("metas_smart")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      return count ?? 0;
    },
    ["metas-smart-count", tenantId],
    { tags: [tagMetasSmart(tenantId)], revalidate: 3600 },
  );

  return buscar();
}
