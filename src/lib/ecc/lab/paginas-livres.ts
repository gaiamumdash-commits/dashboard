"use server";

import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { marcarPassoConcluido, MODULO_PAGINAS_LIVRES } from "@/lib/ecc/lab/progresso";
import type { PaginaLivre } from "@/lib/ecc/tipos";
import type { PartialBlock } from "@blocknote/core";

/** Espelha src/lib/ecc/paginas-livres.ts função a função, trocando
 * garantirWorkspace() por garantirTenantLab() — mesmo cuidado das outras
 * Server Actions Lab-aware (financeiro.ts, agenda.ts): usar as reais aqui
 * gravaria a página fictícia no tenant REAL do usuário sobre um projeto que
 * pertence ao tenant do Lab, quebrando `tem_acesso_ao_projeto`. Todas as
 * escritas levam .eq("tenant_id", tenantIdLab) como defesa em profundidade,
 * além da RLS já herdada (sem policy nova — ver achado #3 do plano). Sem
 * checagem de papel em excluir: o tenant do Lab é sempre solo-owner, mesmo
 * padrão de excluirContaLab/excluirEventoAgendaLab.
 *
 * TEMPLATE_INICIAL_PAGINA_LIVRE duplicado (não importado) de propósito: o
 * arquivo real é "use server", e Next.js só permite exportar funções async
 * de um arquivo de Server Actions — exportar essa constante de lá quebra o
 * build (`A "use server" file can only export async functions, found
 * object.`), erro real encontrado ao rodar `npm run build` nesta sessão. */
const TEMPLATE_INICIAL_PAGINA_LIVRE: PartialBlock[] = [
  {
    type: "heading",
    props: { level: 2 },
    content: "Material de referência",
  },
  {
    type: "paragraph",
    content: "",
  },
  {
    type: "heading",
    props: { level: 2 },
    content: "Ideias / algum dia",
  },
  {
    type: "bulletListItem",
    content: "",
  },
];

async function exigirUsuario() {
  const user = await obterUsuarioAtual();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }
  return user;
}

export async function criarPaginaLivreLab(projetoId: string, titulo: string): Promise<PaginaLivre> {
  const user = await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("paginas_livres")
    .insert({
      tenant_id: tenantIdLab,
      projeto_id: projetoId,
      titulo: titulo.trim() || "Sem título",
      conteudo: TEMPLATE_INICIAL_PAGINA_LIVRE,
      criado_por: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar página do Lab: ${error?.message}`);
  }

  await marcarPassoConcluido(user.id, "criar_pagina_livre", MODULO_PAGINAS_LIVRES);
  revalidatePath("/lab/paginas");
  return data as PaginaLivre;
}

export async function renomearPaginaLivreLab(paginaId: string, projetoId: string, titulo: string): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const { error } = await supabase
    .from("paginas_livres")
    .update({ titulo: titulo.trim() || "Sem título", atualizado_em: new Date().toISOString() })
    .eq("id", paginaId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao renomear página do Lab: ${error.message}`);
  }

  revalidatePath("/lab/paginas");
  revalidatePath(`/lab/paginas/${paginaId}`);
}

export async function atualizarConteudoPaginaLivreLab(
  paginaId: string,
  projetoId: string,
  conteudo: PartialBlock[],
  atualizadoEmConhecido?: string,
): Promise<{ atualizado_em: string } | { conflito: true }> {
  const user = await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  if (atualizadoEmConhecido) {
    const { data: atual } = await supabase
      .from("paginas_livres")
      .select("atualizado_em")
      .eq("id", paginaId)
      .eq("tenant_id", tenantIdLab)
      .maybeSingle();

    if (atual && atual.atualizado_em !== atualizadoEmConhecido) {
      return { conflito: true };
    }
  }

  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("paginas_livres")
    .update({ conteudo, atualizado_em: agora })
    .eq("id", paginaId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao salvar conteúdo do Lab: ${error.message}`);
  }

  await marcarPassoConcluido(user.id, "editar_pagina_livre", MODULO_PAGINAS_LIVRES);
  revalidatePath("/lab/paginas");
  return { atualizado_em: agora };
}

export async function excluirPaginaLivreLab(paginaId: string, projetoId: string): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const { error } = await supabase
    .from("paginas_livres")
    .delete()
    .eq("id", paginaId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao excluir página do Lab: ${error.message}`);
  }

  revalidatePath("/lab/paginas");
}
