"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import type {
  AvatarCliente,
  AvatarItem,
  FormatoProdutoDigital,
  PerfilNegocio,
  ProdutoDigital,
  TipoItemAvatar,
} from "@/lib/ecc/tipos";

function campoObrigatorio(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`Campo obrigatório ausente: ${nome}`);
  }
  return valor.trim();
}

function campoOpcional(formData: FormData, nome: string): string | null {
  const valor = formData.get(nome);
  if (typeof valor !== "string" || valor.trim() === "") return null;
  return valor.trim();
}

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace mexe no Marketing.");
  }
}

// ---------------------------------------------------------------------------
// Perfil do negócio (1 por workspace)
// ---------------------------------------------------------------------------

export async function obterPerfilNegocio(tenantId: string): Promise<PerfilNegocio | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("perfis_negocio").select("*").eq("tenant_id", tenantId).maybeSingle();
  return data as PerfilNegocio | null;
}

export async function salvarPerfilNegocio(formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const nomeNegocio = campoObrigatorio(formData, "nome_negocio");
  const nicho = campoObrigatorio(formData, "nicho");
  const siteUrl = campoOpcional(formData, "site_url");
  const instagram = campoOpcional(formData, "instagram");
  const tomDeVoz = campoOpcional(formData, "tom_de_voz");

  const existente = await obterPerfilNegocio(tenantId);

  const { error } = existente
    ? await supabase
        .from("perfis_negocio")
        .update({
          nome_negocio: nomeNegocio,
          nicho,
          site_url: siteUrl,
          instagram,
          tom_de_voz: tomDeVoz,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", existente.id)
    : await supabase.from("perfis_negocio").insert({
        tenant_id: tenantId,
        nome_negocio: nomeNegocio,
        nicho,
        site_url: siteUrl,
        instagram,
        tom_de_voz: tomDeVoz,
      });

  if (error) {
    throw new Error(`Falha ao salvar perfil do negócio: ${error.message}`);
  }

  revalidatePath("/marketing");
  revalidatePath("/marketing/perfil");
}

// ---------------------------------------------------------------------------
// Produtos digitais
// ---------------------------------------------------------------------------

export async function listarProdutosDigitais(tenantId: string): Promise<ProdutoDigital[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("produtos_digitais")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false });
  return (data as ProdutoDigital[] | null) ?? [];
}

export async function obterProdutoDigital(produtoId: string): Promise<ProdutoDigital | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("produtos_digitais").select("*").eq("id", produtoId).maybeSingle();
  return data as ProdutoDigital | null;
}

export async function criarProdutoDigital(formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const nome = campoObrigatorio(formData, "nome");
  const formato = campoObrigatorio(formData, "formato") as FormatoProdutoDigital;
  const promessa = campoOpcional(formData, "promessa");
  const precoTexto = campoOpcional(formData, "preco");
  const preco = precoTexto ? Number(precoTexto) : null;

  if (preco !== null && (!Number.isFinite(preco) || preco < 0)) {
    throw new Error("Preço inválido.");
  }

  const { error } = await supabase.from("produtos_digitais").insert({
    tenant_id: tenantId,
    nome,
    formato,
    promessa,
    preco,
  });

  if (error) {
    throw new Error(`Falha ao criar produto digital: ${error.message}`);
  }

  revalidatePath("/marketing");
  revalidatePath("/marketing/produtos");
}

export async function atualizarProdutoDigital(produtoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const nome = campoObrigatorio(formData, "nome");
  const formato = campoObrigatorio(formData, "formato") as FormatoProdutoDigital;
  const promessa = campoOpcional(formData, "promessa");
  const precoTexto = campoOpcional(formData, "preco");
  const preco = precoTexto ? Number(precoTexto) : null;

  if (preco !== null && (!Number.isFinite(preco) || preco < 0)) {
    throw new Error("Preço inválido.");
  }

  const { error } = await supabase
    .from("produtos_digitais")
    .update({ nome, formato, promessa, preco })
    .eq("id", produtoId);

  if (error) {
    throw new Error(`Falha ao atualizar produto digital: ${error.message}`);
  }

  revalidatePath("/marketing");
  revalidatePath("/marketing/produtos");
  revalidatePath(`/marketing/produtos/${produtoId}`);
}

export async function arquivarProdutoDigital(produtoId: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase.from("produtos_digitais").update({ status: "pausado" }).eq("id", produtoId);

  if (error) {
    throw new Error(`Falha ao arquivar produto digital: ${error.message}`);
  }

  revalidatePath("/marketing/produtos");
}

// ---------------------------------------------------------------------------
// Avatar do Cliente Ideal (1:1 com produto digital)
// ---------------------------------------------------------------------------

export async function obterAvatarComItens(
  produtoId: string,
): Promise<{ avatar: AvatarCliente; itens: AvatarItem[] } | null> {
  const supabase = await createClient();
  const { data: avatar } = await supabase
    .from("avatares_cliente")
    .select("*")
    .eq("produto_digital_id", produtoId)
    .maybeSingle();

  if (!avatar) return null;

  const { data: itens } = await supabase
    .from("avatar_itens")
    .select("*")
    .eq("avatar_id", (avatar as AvatarCliente).id)
    .order("ordem", { ascending: true });

  return { avatar: avatar as AvatarCliente, itens: (itens as AvatarItem[] | null) ?? [] };
}

export async function salvarAvatarCliente(produtoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const dorUnificada = campoOpcional(formData, "dor_unificada");
  const gatilhoCompra = campoOpcional(formData, "gatilho_compra");

  const { data: existente } = await supabase
    .from("avatares_cliente")
    .select("id")
    .eq("produto_digital_id", produtoId)
    .maybeSingle();

  const avatarId = (existente as { id: string } | null)?.id;

  const { data: avatarSalvo, error: erroAvatar } = avatarId
    ? await supabase
        .from("avatares_cliente")
        .update({ dor_unificada: dorUnificada, gatilho_compra: gatilhoCompra })
        .eq("id", avatarId)
        .select("id")
        .single()
    : await supabase
        .from("avatares_cliente")
        .insert({ tenant_id: tenantId, produto_digital_id: produtoId, dor_unificada: dorUnificada, gatilho_compra: gatilhoCompra })
        .select("id")
        .single();

  if (erroAvatar || !avatarSalvo) {
    throw new Error(`Falha ao salvar avatar: ${erroAvatar?.message ?? "sem retorno"}`);
  }

  const idDoAvatar = (avatarSalvo as { id: string }).id;

  const itensNovos: { tenant_id: string; avatar_id: string; tipo: TipoItemAvatar; texto: string; ordem: number }[] = [];
  for (let i = 1; i <= 5; i++) {
    const dor = campoOpcional(formData, `dor_${i}`);
    if (dor) itensNovos.push({ tenant_id: tenantId, avatar_id: idDoAvatar, tipo: "dor", texto: dor, ordem: i });
    const desejo = campoOpcional(formData, `desejo_${i}`);
    if (desejo) itensNovos.push({ tenant_id: tenantId, avatar_id: idDoAvatar, tipo: "desejo", texto: desejo, ordem: i });
  }

  // Reconciliação simples: apaga os itens antigos e insere os novos —
  // coleção pequena (no máximo 10 itens), sem necessidade de diff.
  const { error: erroDelete } = await supabase.from("avatar_itens").delete().eq("avatar_id", idDoAvatar);
  if (erroDelete) {
    throw new Error(`Falha ao atualizar itens do avatar: ${erroDelete.message}`);
  }

  if (itensNovos.length > 0) {
    const { error: erroInsert } = await supabase.from("avatar_itens").insert(itensNovos);
    if (erroInsert) {
      throw new Error(`Falha ao salvar itens do avatar: ${erroInsert.message}`);
    }
  }

  revalidatePath(`/marketing/produtos/${produtoId}/avatar`);
  revalidatePath(`/marketing/produtos/${produtoId}`);
}
