"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { tagMetasSmart } from "@/lib/ecc/metas";
import { vincularUsuarioAoConvite } from "@/lib/ecc/equipe";
import { notificarEquipe } from "@/lib/ecc/notificacoes-equipe";
import { registrarAtividade } from "@/lib/ecc/atividade";
import { HORIZONTES } from "@/lib/ecc/smart";
import {
  eSouGestorDoProjeto,
  listarMembros,
  listarMembrosComAcessoAoProjeto,
  obterPapelAtual,
  resolverEmailsParaNotificacao,
} from "@/lib/ecc/equipe";
import { extrairIdsMencionados } from "@/lib/ecc/mencoes";
import { formatarDataHoraBrasil } from "@/lib/ecc/kanban";
import { exportarMetaSmartMarkdown } from "@/lib/ecc-export/metas";
import {
  enviarEmailConsolidacao,
  enviarEmailConvite,
  type ItemConsolidacao,
  type SecaoConsolidacao,
} from "@/lib/ecc/notificacoes";
import type {
  AtividadeTarefa,
  CorEtiqueta,
  Convite,
  Horizonte,
  MetaSmart,
  Papel,
  PapelProjeto,
  Prioridade,
  StatusProjeto,
  Tarefa,
  Turno,
} from "@/lib/ecc/tipos";

function campoObrigatorio(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`Campo obrigatório ausente: ${nome}`);
  }
  return valor.trim();
}

// ---------------------------------------------------------------------------
// Módulo 0 — Onboarding & Metas SMART
// ---------------------------------------------------------------------------

/**
 * Cria OU edita as metas SMART do workspace — corrige o achado da auditoria
 * de 2026-09-30 (handoff canônico, seções 11/16/21): antes disso, não
 * havia nenhuma forma de editar uma meta depois de criada, e o link
 * "Editar" do dashboard prometia uma ação que a tela de destino não
 * oferecia.
 *
 * Revisão de 2026-09-30 (validação do P0): a primeira versão usava
 * `.upsert(..., {onConflict: "tenant_id,horizonte"})` — funcionalmente
 * seguro (nunca duplica, nunca troca tenant, porque `tenant_id` sempre vem
 * de `garantirWorkspace()`), mas era exatamente o "upsert genérico" que o
 * prompt de consolidação pediu pra NÃO usar. Trocado por um UPDATE
 * explícito por `id` no caminho de edição — mais direto de auditar (o alvo
 * da mudança é o próprio id da meta, não uma inferência via índice) e mais
 * alinhado ao pedido original ("Criar update explícito autorizado").
 *
 * Fluxo, por horizonte:
 * 1. Busca o id já existente daquele horizonte pro tenant (se houver).
 * 2. Existe → UPDATE por `id` (+ `tenant_id` redundante, defesa em
 *    profundidade sobre a RLS) — nunca toca `id`/`criado_em`/`tenant_id`
 *    da linha, então `projetos.meta_smart_id`/`decisoes.meta_smart_id`
 *    continuam válidos depois de editar.
 * 3. Não existe → INSERT (primeira vez desse horizonte). Índice único
 *    `(tenant_id, horizonte)` (migration 0045) continua sendo o backstop
 *    de verdade contra corrida: se dois requests quase simultâneos (ex.:
 *    clique duplo) passarem pelo SELECT do passo 1 vendo "ainda não
 *    existe", só o primeiro INSERT vence — o segundo recebe erro 23505
 *    (violação do índice único) e cai no fallback abaixo, que vira um
 *    UPDATE de verdade na linha que o outro request acabou de criar (nunca
 *    perde a submissão do segundo clique, nunca duplica).
 */
export async function salvarMetasSmart(formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  // Fonte única com a UI (HORIZONTES, smart.ts) — evita os dois listarem
  // horizontes diferentes e o form quebrar por campo ausente.
  const horizontes: Horizonte[] = HORIZONTES.map((h) => h.valor);

  const { data: existentes, error: erroLeitura } = await supabase
    .from("metas_smart")
    .select("id, horizonte")
    .eq("tenant_id", tenantId);

  if (erroLeitura) {
    throw new Error(`Falha ao carregar metas existentes: ${erroLeitura.message}`);
  }

  const idPorHorizonte = new Map(
    ((existentes ?? []) as { id: string; horizonte: Horizonte }[]).map((m) => [m.horizonte, m.id]),
  );

  const metasSalvas: MetaSmart[] = [];

  for (const horizonte of horizontes) {
    const campos = {
      visao_macro: campoObrigatorio(formData, `${horizonte}_visao_macro`),
      specific: campoObrigatorio(formData, `${horizonte}_specific`),
      measurable: campoObrigatorio(formData, `${horizonte}_measurable`),
      attainable: campoObrigatorio(formData, `${horizonte}_attainable`),
      relevant: campoObrigatorio(formData, `${horizonte}_relevant`),
      time_bound: campoObrigatorio(formData, `${horizonte}_time_bound`),
    };

    const idExistente = idPorHorizonte.get(horizonte);

    if (idExistente) {
      // Caminho de EDIÇÃO — update explícito pelo id da meta.
      const { data, error } = await supabase
        .from("metas_smart")
        .update(campos)
        .eq("id", idExistente)
        .eq("tenant_id", tenantId)
        .select("*")
        .single();

      if (error) {
        throw new Error(`Falha ao atualizar meta (${horizonte}): ${error.message}`);
      }
      metasSalvas.push(data as MetaSmart);
      continue;
    }

    // Caminho de CRIAÇÃO — só quando este horizonte ainda não tem meta.
    const { data, error } = await supabase
      .from("metas_smart")
      .insert({ tenant_id: tenantId, horizonte, ...campos })
      .select("*")
      .single();

    if (!error) {
      metasSalvas.push(data as MetaSmart);
      continue;
    }

    if (error.code !== "23505") {
      throw new Error(`Falha ao criar meta (${horizonte}): ${error.message}`);
    }

    // Corrida real: outro request criou a linha entre o SELECT do início
    // da função e este INSERT — resolve como edição de verdade, não perde
    // a submissão nem duplica.
    const { data: criadaPeloOutro, error: erroBusca } = await supabase
      .from("metas_smart")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("horizonte", horizonte)
      .single();

    if (erroBusca || !criadaPeloOutro) {
      throw new Error(`Falha ao resolver corrida ao salvar meta (${horizonte}): ${erroBusca?.message}`);
    }

    const { data: atualizada, error: erroUpdate } = await supabase
      .from("metas_smart")
      .update(campos)
      .eq("id", criadaPeloOutro.id as string)
      .select("*")
      .single();

    if (erroUpdate) {
      throw new Error(`Falha ao salvar meta (${horizonte}) após corrida: ${erroUpdate.message}`);
    }
    metasSalvas.push(atualizada as MetaSmart);
  }

  updateTag(tagMetasSmart(tenantId));

  const { data: tenant } = await supabase.from("tenants").select("nome").eq("id", tenantId).single();
  const nomeWorkspace = tenant?.nome ?? "Gaiamum";

  for (const meta of metasSalvas) {
    await exportarMetaSmartMarkdown(meta, nomeWorkspace);
  }

  redirect("/projetos");
}

/**
 * Pular o onboarding agora GRAVA a decisão (`tenants.onboarding_metas_pulado_em`,
 * migration 0045) antes de sair — sem isso, o Painel geral (`/`) redirecionava
 * de volta pro onboarding em toda visita seguinte enquanto não houvesse
 * nenhuma meta salva, um loop de fato pra quem pula (achado do P0, handoff
 * canônico). Via service client de propósito: quem pula pode ser um member
 * com escopo completo, não só o owner, e a policy de UPDATE de `tenants`
 * (migration 0036) é só-owner — `tenantId` aqui nunca vem de input do
 * cliente (sempre de garantirWorkspace()), então é seguro escrever assim,
 * mesmo padrão já usado em vincularUsuarioAoConvite().
 */
export async function pularOnboarding() {
  const tenantId = await garantirWorkspace();
  const service = createServiceClient();

  const { error } = await service
    .from("tenants")
    .update({ onboarding_metas_pulado_em: new Date().toISOString() })
    .eq("id", tenantId)
    // Nunca sobrescreve uma decisão já registrada (idempotente) — só grava
    // na primeira vez que a pessoa pula.
    .is("onboarding_metas_pulado_em", null);

  if (error) {
    console.error("[pularOnboarding] falha ao registrar decisão de pular:", error);
    // Nunca bloqueia a navegação por causa disso — pior caso, a pessoa vê
    // o onboarding de novo na próxima visita, mesmo comportamento de antes
    // desta correção.
  }

  redirect("/projetos");
}

// ---------------------------------------------------------------------------
// Módulo 1 — Projetos
// ---------------------------------------------------------------------------

export async function criarProjeto(formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace pode criar projetos novos.");
  }

  const nome = campoObrigatorio(formData, "nome");
  const descricao = (formData.get("descricao") as string | null)?.trim() || null;

  const { data: projeto, error } = await supabase
    .from("projetos")
    .insert({ tenant_id: tenantId, nome, descricao })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Falha ao criar projeto: ${error.message}`);
  }

  // Quem cria o quadro vira o gestor dele — só o gestor pode apagar
  // cartão ou quadro depois.
  const { error: erroMembro } = await supabase
    .from("projeto_membros")
    .insert({ tenant_id: tenantId, projeto_id: projeto.id, user_id: user.id, papel: "gestor" });

  if (erroMembro) {
    throw new Error(`Projeto criado, mas falha ao definir gestor: ${erroMembro.message}`);
  }

  // Todo projeto novo nasce com as 4 colunas padrão — "Concluído" fixa, "Hoje"
  // já marcada como a coluna de sistema (migration 0048, só ela pode dividir
  // em turnos e é onde novas colunas nascem por padrão) — as abertas o
  // usuário pode renomear/apagar/criar outras livremente depois (pedido do
  // Fabio, 2026-10-01: "é só o padrão de fábrica, a pessoa edita como
  // quiser"), "Hoje" inclusive (perde só o nome, não a marcação de sistema).
  // Achado real (2026-10-01, reportado pelo Fabio em teste físico): o
  // INSERT em lote (array) do PostgREST monta as colunas pela UNIÃO das
  // chaves de todos os objetos do array — como só o 1º objeto tinha a
  // chave `hoje`, os outros recebiam `null` EXPLÍCITO pra essa coluna em
  // vez de cair no `default false` do banco, violando o `not null` da
  // migration 0048 e quebrando a criação de todo projeto novo. Todo objeto
  // do array precisa ter exatamente as mesmas chaves.
  const { error: erroColunas } = await supabase.from("colunas_kanban").insert([
    { tenant_id: tenantId, projeto_id: projeto.id, nome: "Hoje", ordem: 0, concluido: false, hoje: true },
    { tenant_id: tenantId, projeto_id: projeto.id, nome: "Tarefas", ordem: 1, concluido: false, hoje: false },
    { tenant_id: tenantId, projeto_id: projeto.id, nome: "Em Desenvolvimento", ordem: 2, concluido: false, hoje: false },
    { tenant_id: tenantId, projeto_id: projeto.id, nome: "Concluído", ordem: 0, concluido: true, hoje: false },
  ]);

  if (erroColunas) {
    throw new Error(`Projeto criado, mas falha ao criar colunas padrão: ${erroColunas.message}`);
  }

  revalidatePath("/projetos");
}

export async function atualizarStatusProjeto(projetoId: string, status: StatusProjeto) {
  const supabase = await createClient();
  const { error } = await supabase.from("projetos").update({ status }).eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao atualizar status do projeto: ${error.message}`);
  }

  revalidatePath("/projetos");
}

export async function deletarProjeto(projetoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projetos").delete().eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao excluir projeto: ${error.message}`);
  }

  revalidatePath("/projetos");
}

async function exigirGestorOuOwner(tenantId: string, projetoId: string) {
  const user = await obterUsuarioAtual();

  const souOwner = (await obterPapelAtual(tenantId)) === "owner";
  const souGestor = Boolean(user) && (await eSouGestorDoProjeto(projetoId, user!.id));

  if (!souOwner && !souGestor) {
    throw new Error("Só o gestor do projeto (ou o dono do workspace) mexe nas configurações do quadro.");
  }
}

export async function renomearProjeto(projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);
  const supabase = await createClient();
  const nome = campoObrigatorio(formData, "nome");

  const { error } = await supabase.from("projetos").update({ nome }).eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao renomear projeto: ${error.message}`);
  }

  revalidatePath("/projetos");
  revalidatePath(`/projetos/${projetoId}/tarefas`);
  revalidatePath(`/projetos/${projetoId}/configuracoes`);
}

export async function mudarCorProjeto(projetoId: string, cor: CorEtiqueta) {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);
  const supabase = await createClient();

  const { error } = await supabase.from("projetos").update({ cor_fundo: cor }).eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao mudar cor do quadro: ${error.message}`);
  }

  revalidatePath("/projetos");
  revalidatePath(`/projetos/${projetoId}/tarefas`);
  revalidatePath(`/projetos/${projetoId}/configuracoes`);
}

export async function atualizarResultadoEsperadoProjeto(projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);
  const supabase = await createClient();
  const resultadoEsperado = (formData.get("resultado_esperado") as string | null)?.trim() || null;

  const { error } = await supabase
    .from("projetos")
    .update({ resultado_esperado: resultadoEsperado })
    .eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao salvar resultado esperado: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
  revalidatePath(`/projetos/${projetoId}/configuracoes`);
}

export async function alternarArquivadoProjeto(projetoId: string, arquivado: boolean) {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);
  const supabase = await createClient();

  const { error } = await supabase.from("projetos").update({ arquivado }).eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao ${arquivado ? "arquivar" : "desarquivar"} projeto: ${error.message}`);
  }

  revalidatePath("/projetos");
}

/** Promove/despromove um membro a "coordenador" do quadro (papel 'gestor'
 * em `projeto_membros`) — pedido do Fabio: alguém que convida e gerencia
 * gente do próprio projeto (mesmo poder de apagar cartão/coluna do
 * gestor), mas sem Financeiro/Metas SMART/Equipe se foi convidado só pra
 * esse quadro (escopo já fica de fora disso, é orthogonal). Upsert porque
 * quem tem acesso via escopo completo do workspace pode nunca ter tido
 * linha em `projeto_membros`. */
export async function definirPapelDoMembroNoProjeto(
  projetoId: string,
  userId: string,
  papel: PapelProjeto,
) {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);

  const user = await obterUsuarioAtual();
  if (user?.id === userId) {
    throw new Error("Peça pra outro gestor/coordenador mudar o seu próprio papel no quadro.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projeto_membros")
    .upsert(
      { tenant_id: tenantId, projeto_id: projetoId, user_id: userId, papel },
      { onConflict: "projeto_id,user_id" },
    );

  if (error) {
    throw new Error(`Falha ao definir papel no quadro: ${error.message}`);
  }

  after(async () => {
    const { data: projeto } = await supabase.from("projetos").select("nome").eq("id", projetoId).maybeSingle();
    const nomeProjeto = projeto?.nome ?? "um quadro";
    await notificarEquipe({
      tenantId,
      userId,
      titulo:
        papel === "gestor"
          ? `Você virou coordenador do quadro "${nomeProjeto}"`
          : `Você deixou de ser coordenador do quadro "${nomeProjeto}"`,
      link: `/projetos/${projetoId}/tarefas`,
    });
  });

  revalidatePath(`/projetos/${projetoId}/configuracoes`);
}

/** Tira alguém do quadro (não do workspace inteiro — quem quer remover a
 * conta de vez continua fazendo isso em /equipe, só o owner). */
export async function removerMembroDoProjeto(projetoId: string, userId: string) {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);

  const user = await obterUsuarioAtual();
  if (user?.id === userId) {
    throw new Error("Peça pra outro gestor/coordenador te remover do quadro.");
  }

  const supabase = await createClient();
  const { data: projeto } = await supabase.from("projetos").select("nome").eq("id", projetoId).maybeSingle();
  const { error } = await supabase
    .from("projeto_membros")
    .delete()
    .eq("projeto_id", projetoId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Falha ao remover do quadro: ${error.message}`);
  }

  after(async () => {
    await notificarEquipe({
      tenantId,
      userId,
      titulo: `Você foi removido do quadro "${projeto?.nome ?? "um quadro"}"`,
      link: "/projetos",
    });
  });

  revalidatePath(`/projetos/${projetoId}/configuracoes`);
}

/** Convite direto pro quadro, sem passar por /equipe — necessário pro
 * coordenador convidar gente, já que ele não enxerga a Equipe do workspace
 * inteiro (só quem tem acesso completo chega lá). RLS de `convites` já
 * libera gestor de projeto pra isso (migration 0003). */
export async function convidarParaProjeto(projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const email = campoObrigatorio(formData, "email").toLowerCase();

  const { data: convite, error } = await supabase
    .from("convites")
    .insert({
      tenant_id: tenantId,
      email,
      papel: "member",
      convidado_por: user.id,
      projeto_id: projetoId,
    })
    .select("token")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um convite pendente para esse e-mail.");
    }
    throw new Error(`Falha ao convidar: ${error.message}`);
  }

  after(async () => {
    const { data: projeto } = await supabase.from("projetos").select("nome").eq("id", projetoId).maybeSingle();
    await enviarEmailConvite({
      destinatario: email,
      emailConvidante: user.email ?? "Alguém do Gaiamum",
      nomeProjeto: projeto?.nome ?? null,
      token: convite.token as string,
    });
  });

  revalidatePath(`/projetos/${projetoId}/configuracoes`);
}

// ---------------------------------------------------------------------------
// Módulo 2 — Tarefas (Kanban)
// ---------------------------------------------------------------------------

// `ids` (opcional) vem do cliente quando ele já inseriu a tarefa
// otimisticamente na tela (mesmo id aqui e lá, sem precisar reconciliar
// depois) — mesma ordem de `titulos`. Sem `ids`, o Postgres gera sozinho
// (default gen_random_uuid()).
export async function criarTarefa(
  projetoId: string,
  colunaId: string,
  formData: FormData,
  ids?: string[],
  turno?: Turno | null,
) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  // "Concluído" só recebe cartão por movimentação (arrasto/"Mover
  // para..."), nunca por criação direta nela (pedido do Fabio, 2026-10-01).
  // Checagem aqui dá um erro em português cedo; o trigger da migration 0050
  // é quem garante isso de verdade mesmo contornando esta Server Action.
  const { data: colunaDestino } = await supabase.from("colunas_kanban").select("concluido").eq("id", colunaId).single();
  if (colunaDestino?.concluido) {
    throw new Error('A coluna "Concluído" só recebe cartões movidos de outra coluna — crie o cartão em outra coluna e transporte pra cá.');
  }

  // Cada linha do texto vira uma tarefa: cola uma lista pronta, sai um
  // cartão por item, sem precisar criar um por um.
  const titulos = campoObrigatorio(formData, "titulo")
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);

  if (titulos.length === 0) {
    throw new Error("Informe ao menos um título de tarefa.");
  }

  // Ordem nova sempre vai pro fim da coluna (ou do turno dela, se a coluna
  // estiver dividida em turnos — cada turno tem sua própria fila) — pega a
  // maior ordem já usada ali e empilha a partir dela (1000 em 1000, mesmo
  // espaçamento do backfill da migration 0042, dá espaço de sobra pra
  // reordenar por arrasto depois sem precisar reindexar).
  let query = supabase.from("tarefas").select("ordem").eq("coluna_id", colunaId);
  query = turno ? query.eq("turno", turno) : query.is("turno", null);
  const { data: ultimaOrdem } = await query.order("ordem", { ascending: false }).limit(1).maybeSingle();
  const ordemBase = ultimaOrdem?.ordem ?? 0;

  // Criação rápida: só o título agora, o resto (prioridade, tag, datas) o
  // usuário preenche depois abrindo o cartão.
  const linhas = titulos.map((titulo, indice) => ({
    ...(ids?.[indice] ? { id: ids[indice] } : {}),
    tenant_id: tenantId,
    projeto_id: projetoId,
    coluna_id: colunaId,
    titulo,
    prioridade: "P3" as Prioridade,
    ordem: ordemBase + (indice + 1) * 1000,
    turno: turno ?? null,
  }));

  const { error } = await supabase.from("tarefas").insert(linhas);

  if (error) {
    throw new Error(`Falha ao criar tarefa: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function atualizarDescricaoTarefa(tarefaId: string, projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const descricao = (formData.get("descricao") as string | null)?.trim() || null;

  const { error } = await supabase.from("tarefas").update({ descricao }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao salvar descrição: ${error.message}`);
  }

  const membros = await listarMembrosComAcessoAoProjeto(tenantId, projetoId);
  const mencionados = descricao ? extrairIdsMencionados(descricao, membros) : [];

  await registrarAtividade({
    tenantId,
    projetoId,
    tarefaId,
    tipo: "descricao_editada",
    notificarTambem: mencionados,
  });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function atualizarDatasTarefa(tarefaId: string, projetoId: string, formData: FormData) {
  await garantirWorkspace();
  const supabase = await createClient();
  const dataInicio = (formData.get("data_inicio") as string | null) || null;
  const dataLimite = (formData.get("data_limite") as string | null) || null;

  const { error } = await supabase
    .from("tarefas")
    .update({ data_inicio: dataInicio, data_limite: dataLimite })
    .eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao salvar datas: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function atualizarPrioridadeTarefa(tarefaId: string, projetoId: string, prioridade: Prioridade) {
  await garantirWorkspace();
  const supabase = await createClient();

  const { error } = await supabase.from("tarefas").update({ prioridade }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao salvar prioridade: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function atualizarAguardandoDeTarefa(tarefaId: string, projetoId: string, aguardandoDe: string) {
  await garantirWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tarefas")
    .update({ aguardando_de: aguardandoDe.trim() || null })
    .eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao atualizar "aguardando": ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function atualizarValorEstimadoTarefa(tarefaId: string, projetoId: string, valor: number | null) {
  await garantirWorkspace();
  const supabase = await createClient();

  const { error } = await supabase.from("tarefas").update({ valor_estimado: valor }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao atualizar valor estimado: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function alternarMarcoTarefa(tarefaId: string, projetoId: string, isMarco: boolean) {
  await garantirWorkspace();
  const supabase = await createClient();

  const { error } = await supabase.from("tarefas").update({ is_marco: isMarco }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao marcar/desmarcar marco: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function atualizarTituloTarefa(tarefaId: string, projetoId: string, titulo: string) {
  await garantirWorkspace();
  const supabase = await createClient();
  const tituloLimpo = titulo.trim();

  if (!tituloLimpo) {
    throw new Error("O título não pode ficar vazio.");
  }

  const { error } = await supabase.from("tarefas").update({ titulo: tituloLimpo }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao renomear cartão: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function alternarMembroTarefa(tarefaId: string, userId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("tarefa_membros")
    .select("id")
    .eq("tarefa_id", tarefaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase.from("tarefa_membros").delete().eq("id", existente.id);
    if (error) throw new Error(`Falha ao remover membro da tarefa: ${error.message}`);
    await registrarAtividade({
      tenantId,
      projetoId,
      tarefaId,
      tipo: "membro_removido",
      notificarTambem: [userId],
    });
  } else {
    const { error } = await supabase
      .from("tarefa_membros")
      .insert({ tenant_id: tenantId, tarefa_id: tarefaId, user_id: userId });
    if (error) throw new Error(`Falha ao adicionar membro à tarefa: ${error.message}`);
    await registrarAtividade({ tenantId, projetoId, tarefaId, tipo: "membro_adicionado" });
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function adicionarChecklistItem(tarefaId: string, projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const texto = campoObrigatorio(formData, "texto");

  const { count } = await supabase
    .from("tarefa_checklist_itens")
    .select("id", { count: "exact", head: true })
    .eq("tarefa_id", tarefaId);

  const { error } = await supabase.from("tarefa_checklist_itens").insert({
    tenant_id: tenantId,
    tarefa_id: tarefaId,
    texto,
    ordem: count ?? 0,
  });

  if (error) {
    throw new Error(`Falha ao adicionar item do checklist: ${error.message}`);
  }

  const membros = await listarMembrosComAcessoAoProjeto(tenantId, projetoId);
  const mencionados = extrairIdsMencionados(texto, membros);

  await registrarAtividade({
    tenantId,
    projetoId,
    tarefaId,
    tipo: "checklist_item_adicionado",
    detalhe: { texto },
    notificarTambem: mencionados,
  });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function alternarChecklistItem(
  itemId: string,
  tarefaId: string,
  concluido: boolean,
  projetoId: string,
) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("tarefa_checklist_itens")
    .update({ concluido })
    .eq("id", itemId)
    .select("texto")
    .single();

  if (error) {
    throw new Error(`Falha ao atualizar item do checklist: ${error.message}`);
  }

  await registrarAtividade({
    tenantId,
    projetoId,
    tarefaId,
    tipo: concluido ? "checklist_item_concluido" : "checklist_item_reaberto",
    detalhe: { texto: item.texto },
  });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function removerChecklistItem(itemId: string, tarefaId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("tarefa_checklist_itens")
    .delete()
    .eq("id", itemId)
    .select("texto")
    .single();

  if (error) {
    throw new Error(`Falha ao remover item do checklist: ${error.message}`);
  }

  await registrarAtividade({
    tenantId,
    projetoId,
    tarefaId,
    tipo: "checklist_item_removido",
    detalhe: { texto: item.texto },
  });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

/** `novaOrdem` (opcional) posiciona o cartão dentro da coluna de destino —
 * calculada no cliente como a média dos vizinhos onde foi solto (ou um
 * extremo ±1000, se solto no topo/fim), ver `calcularNovaOrdem` em
 * kanban.ts. Sem `novaOrdem` (troca de coluna pelo <select> do modal, por
 * exemplo, que não tem noção de posição), o cartão vai pro fim da coluna
 * nova — mesma regra de `criarTarefa`. */
export async function moverTarefa(
  tarefaId: string,
  projetoId: string,
  novaColunaId: string,
  novaOrdem?: number,
  novoTurno?: Turno | null,
) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const { data: tarefaAtual } = await supabase
    .from("tarefas")
    .select("coluna_id")
    .eq("id", tarefaId)
    .maybeSingle();

  const idsColunas = [tarefaAtual?.coluna_id, novaColunaId].filter((id): id is string => Boolean(id));
  const { data: colunas } = await supabase.from("colunas_kanban").select("id, nome").in("id", idsColunas);
  const nomeDe = colunas?.find((c) => c.id === tarefaAtual?.coluna_id)?.nome ?? "?";
  const nomePara = colunas?.find((c) => c.id === novaColunaId)?.nome ?? "?";

  let ordem = novaOrdem;
  if (ordem === undefined) {
    let query = supabase.from("tarefas").select("ordem").eq("coluna_id", novaColunaId);
    query = novoTurno ? query.eq("turno", novoTurno) : query.is("turno", null);
    const { data: ultimaOrdem } = await query.order("ordem", { ascending: false }).limit(1).maybeSingle();
    ordem = (ultimaOrdem?.ordem ?? 0) + 1000;
  }

  const { error } = await supabase
    .from("tarefas")
    .update({ coluna_id: novaColunaId, ordem, turno: novoTurno ?? null })
    .eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao mover tarefa: ${error.message}`);
  }

  await registrarAtividade({
    tenantId,
    projetoId,
    tarefaId,
    tipo: "movida",
    detalhe: { de: nomeDe, para: nomePara },
  });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

// ---------------------------------------------------------------------------
// Colunas do kanban (configuráveis por projeto — só "Concluído" é fixa)
// ---------------------------------------------------------------------------

/** Nova coluna nasce logo DEPOIS da coluna "Hoje" (regra definitiva pedida
 * pelo Fabio, 2026-10-01) — nunca no fim do quadro. `ordem` é inteiro, não
 * fracionário como em `tarefas.ordem`, então "inserir no meio" exige abrir
 * espaço de verdade: lê a lista de colunas abertas (já ordenadas, mesmo
 * campo que `reordenarColunas` usa), insere o novo id na posição alvo e
 * regrava `ordem` 0..N pra todas — reaproveita a mesma persistência de
 * ordem existente, não cria mecanismo novo.
 * Fallback documentado: se o projeto ainda não tem nenhuma coluna marcada
 * como "Hoje" (projetos antigos, antes da migration 0048, até alguém usar
 * `definirColunaHoje`), a nova coluna nasce na 1ª posição — nunca no fim. */
export async function criarColuna(projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const nome = campoObrigatorio(formData, "nome");

  const { data: colunasAbertas } = await supabase
    .from("colunas_kanban")
    .select("id, hoje")
    .eq("projeto_id", projetoId)
    .eq("concluido", false)
    .order("ordem", { ascending: true });

  const lista = colunasAbertas ?? [];
  const indiceHoje = lista.findIndex((c) => c.hoje);
  const posicaoAlvo = indiceHoje === -1 ? 0 : indiceHoje + 1;

  const { data: novaColuna, error: erroInsert } = await supabase
    .from("colunas_kanban")
    .insert({ tenant_id: tenantId, projeto_id: projetoId, nome, ordem: lista.length })
    .select("id")
    .single();

  if (erroInsert || !novaColuna) {
    throw new Error(`Falha ao criar coluna: ${erroInsert?.message}`);
  }

  const idsNaOrdemFinal = lista.map((c) => c.id);
  idsNaOrdemFinal.splice(posicaoAlvo, 0, novaColuna.id);

  const reindexacoes = idsNaOrdemFinal.map((id, indice) =>
    supabase.from("colunas_kanban").update({ ordem: indice }).eq("id", id),
  );
  const resultados = await Promise.all(reindexacoes);
  const erroReindex = resultados.find((r) => r.error)?.error;
  if (erroReindex) {
    throw new Error(`Coluna criada, mas falha ao posicioná-la depois de "Hoje": ${erroReindex.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function renomearColuna(colunaId: string, projetoId: string, formData: FormData) {
  const supabase = await createClient();
  const nome = campoObrigatorio(formData, "nome");

  const { data: coluna } = await supabase
    .from("colunas_kanban")
    .select("concluido")
    .eq("id", colunaId)
    .maybeSingle();

  if (coluna?.concluido) {
    throw new Error('A coluna "Concluído" é fixa e não pode ser renomeada.');
  }

  const { error } = await supabase.from("colunas_kanban").update({ nome }).eq("id", colunaId);

  if (error) {
    throw new Error(`Falha ao renomear coluna: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

/** Liga/desliga a divisão de uma coluna em 3 turnos (Manhã/Tarde/Noite) —
 * pedido do Fabio, 2026-09-29, pra organizar o dia dentro de uma coluna
 * qualquer sem precisar criar 3 colunas novas. Ao desligar, os cartões
 * voltam todos pra coluna normal (decisão já tomada com o Fabio): só perdem
 * a marcação de turno, nada se perde e é reversível a qualquer momento. */
export async function alternarDivisaoEmTurnos(colunaId: string, projetoId: string, dividida: boolean) {
  const supabase = await createClient();

  const { data: coluna } = await supabase
    .from("colunas_kanban")
    .select("concluido, hoje")
    .eq("id", colunaId)
    .maybeSingle();

  if (coluna?.concluido) {
    throw new Error('A coluna "Concluído" é fixa e não pode ser dividida em turnos.');
  }

  // Regra definitiva (2026-10-01): só a coluna "Hoje" pode dividir em
  // turnos. Checagem no SERVIDOR, não só escondendo o botão na interface —
  // e o CHECK constraint da migration 0048 é a 2ª camada de defesa (RLS/SQL
  // direto nunca contorna isso, mesmo chamando a tabela sem passar por
  // aqui).
  if (dividida && !coluna?.hoje) {
    throw new Error('Só a coluna "Hoje" pode ser dividida em Manhã/Tarde/Noite.');
  }

  const { error } = await supabase.from("colunas_kanban").update({ dividida_em_turnos: dividida }).eq("id", colunaId);

  if (error) {
    throw new Error(`Falha ao atualizar a divisão em turnos: ${error.message}`);
  }

  if (!dividida) {
    const { error: erroLimpeza } = await supabase.from("tarefas").update({ turno: null }).eq("coluna_id", colunaId);
    if (erroLimpeza) {
      throw new Error(`Falha ao desfazer a divisão em turnos: ${erroLimpeza.message}`);
    }
  } else {
    // Achado real (2026-10-01): cartões já existentes na coluna, sem turno
    // definido, não sumiam de verdade — ficavam com `turno = null`, que
    // nenhum dos 3 sub-blocos (filtro `turno === valor`) exibe. Em vez de um
    // 4º bloco "sem turno" (ideia descartada pelo Fabio), a correção pedida
    // é: ao dividir, todo cartão sem turno entra direto em "Manhã" — visível
    // de cara, sem perder nada — e a pessoa reorganiza manualmente depois
    // pra Tarde/Noite se fizer sentido.
    const { error: erroDefault } = await supabase
      .from("tarefas")
      .update({ turno: "manha" })
      .eq("coluna_id", colunaId)
      .is("turno", null);
    if (erroDefault) {
      throw new Error(`Falha ao mover os cartões existentes para "Manhã": ${erroDefault.message}`);
    }
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

/** Marca uma coluna como "a coluna Hoje" do projeto — identidade de sistema
 * (migration 0048) que não depende do nome/título dela. No máximo 1 por
 * projeto (índice único no banco): marcar uma nova desmarca a anterior
 * automaticamente. Existe principalmente pro fallback de projetos sem
 * nenhuma "Hoje" ainda (criados antes desta mudança) e pra permitir trocar
 * depois, se o usuário quiser. Não transfere a divisão em turnos da coluna
 * anterior — se ela estava dividida, perde essa divisão (o próprio CHECK
 * constraint do banco exigiria isso); os cartões e o `turno` de cada um
 * continuam intactos, só a divisão visual é que não se aplica mais ali. */
export async function definirColunaHoje(colunaId: string, projetoId: string) {
  const supabase = await createClient();

  const { data: coluna } = await supabase
    .from("colunas_kanban")
    .select("concluido")
    .eq("id", colunaId)
    .maybeSingle();

  if (coluna?.concluido) {
    throw new Error('A coluna "Concluído" é fixa e não pode virar a coluna Hoje.');
  }

  // Desmarca a Hoje atual do projeto (se houver) e desliga a divisão em
  // turnos dela — nessa ordem, antes de marcar a nova, porque o índice
  // único (1 "Hoje" por projeto) e o CHECK constraint (turnos só na Hoje)
  // rejeitariam qualquer estado intermediário com os dois ao mesmo tempo.
  const { error: erroDesligarTurnos } = await supabase
    .from("colunas_kanban")
    .update({ dividida_em_turnos: false })
    .eq("projeto_id", projetoId)
    .eq("hoje", true);
  if (erroDesligarTurnos) {
    throw new Error(`Falha ao trocar a coluna Hoje: ${erroDesligarTurnos.message}`);
  }

  const { error: erroDesmarcar } = await supabase
    .from("colunas_kanban")
    .update({ hoje: false })
    .eq("projeto_id", projetoId)
    .eq("hoje", true);
  if (erroDesmarcar) {
    throw new Error(`Falha ao trocar a coluna Hoje: ${erroDesmarcar.message}`);
  }

  const { error } = await supabase.from("colunas_kanban").update({ hoje: true }).eq("id", colunaId);
  if (error) {
    throw new Error(`Falha ao definir a coluna Hoje: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function excluirColuna(colunaId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  const souOwner = (await obterPapelAtual(tenantId)) === "owner";
  const souGestor = Boolean(user) && (await eSouGestorDoProjeto(projetoId, user!.id));

  if (!souOwner && !souGestor) {
    throw new Error("Só o gestor do projeto (ou o dono do workspace) pode apagar uma coluna.");
  }

  const { data: coluna } = await supabase
    .from("colunas_kanban")
    .select("concluido")
    .eq("id", colunaId)
    .maybeSingle();

  if (coluna?.concluido) {
    throw new Error('A coluna "Concluído" é fixa e não pode ser apagada.');
  }

  const { count } = await supabase
    .from("tarefas")
    .select("id", { count: "exact", head: true })
    .eq("coluna_id", colunaId);

  if ((count ?? 0) > 0) {
    throw new Error("Mova ou apague os cartões desta coluna antes de excluí-la.");
  }

  const { error } = await supabase.from("colunas_kanban").delete().eq("id", colunaId);

  if (error) {
    throw new Error(`Falha ao excluir coluna: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

/** Reordena as colunas abertas (não mexe na "Concluído", que é sempre a
 * última) — pedido do Fabio: poder arrastar as colunas pra reorganizar o
 * quadro, não só os cartões. Recebe a lista inteira de ids já na nova
 * ordem e regrava `ordem` de cada uma. */
export async function reordenarColunas(projetoId: string, idsEmOrdem: string[]) {
  await garantirWorkspace();
  const supabase = await createClient();

  const atualizacoes = idsEmOrdem.map((colunaId, indice) =>
    supabase.from("colunas_kanban").update({ ordem: indice }).eq("id", colunaId).eq("projeto_id", projetoId),
  );

  const resultados = await Promise.all(atualizacoes);
  const erro = resultados.find((r) => r.error)?.error;

  if (erro) {
    throw new Error(`Falha ao reordenar colunas: ${erro.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function deletarTarefa(tarefaId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  const souOwner = (await obterPapelAtual(tenantId)) === "owner";
  const souGestor = Boolean(user) && (await eSouGestorDoProjeto(projetoId, user!.id));

  if (!souOwner && !souGestor) {
    throw new Error("Só o gestor do projeto (ou o dono do workspace) pode apagar um cartão.");
  }

  // Registra a exclusão (e avisa os responsáveis por e-mail) antes de
  // apagar de fato — o registro fica no histórico mesmo depois que o
  // cartão some (tarefa_id vira null, mas a atividade permanece).
  await registrarAtividade({ tenantId, projetoId, tarefaId, tipo: "excluida" });

  const { error } = await supabase.from("tarefas").delete().eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao excluir tarefa: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function listarAtividadesDaTarefa(tarefaId: string): Promise<AtividadeTarefa[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefa_atividades")
    .select("*")
    .eq("tarefa_id", tarefaId)
    .order("criado_em", { ascending: false });

  return (data as AtividadeTarefa[] | null) ?? [];
}

export async function comentarNaTarefa(tarefaId: string, projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const texto = campoObrigatorio(formData, "texto");

  const membros = await listarMembrosComAcessoAoProjeto(tenantId, projetoId);
  const mencionados = extrairIdsMencionados(texto, membros);

  await registrarAtividade({
    tenantId,
    projetoId,
    tarefaId,
    tipo: "comentario",
    detalhe: { texto },
    notificarTambem: mencionados,
  });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

// ---------------------------------------------------------------------------
// Freeze — ponto de situação do quadro, por e-mail pra todo mundo com acesso
// ---------------------------------------------------------------------------

function diasEntre(dataA: Date, dataB: Date): number {
  const umDia = 1000 * 60 * 60 * 24;
  const a = new Date(dataA.getFullYear(), dataA.getMonth(), dataA.getDate());
  const b = new Date(dataB.getFullYear(), dataB.getMonth(), dataB.getDate());
  return Math.round((b.getTime() - a.getTime()) / umDia);
}

export async function enviarConsolidacaoProjeto(projetoId: string): Promise<{ enviados: number }> {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);
  const supabase = await createClient();

  const [{ data: projeto }, { data: tarefas }, { data: colunas }, { data: tarefaMembros }, membrosComAcesso] =
    await Promise.all([
      supabase.from("projetos").select("nome").eq("id", projetoId).maybeSingle(),
      supabase.from("tarefas").select("*").eq("projeto_id", projetoId),
      supabase.from("colunas_kanban").select("id, concluido").eq("projeto_id", projetoId),
      supabase.from("tarefa_membros").select("tarefa_id, user_id").eq("tenant_id", tenantId),
      listarMembrosComAcessoAoProjeto(tenantId, projetoId),
    ]);

  const listaTarefas = (tarefas ?? []) as Tarefa[];
  const listaColunas = (colunas ?? []) as { id: string; concluido: boolean }[];
  const hoje = new Date();

  const itensPorTarefa = new Map<string, ItemConsolidacao>();
  for (const tarefa of listaTarefas) {
    const coluna = listaColunas.find((c) => c.id === tarefa.coluna_id);
    const concluido = coluna?.concluido ?? false;
    const diasParaPrazo = tarefa.data_limite ? diasEntre(hoje, new Date(tarefa.data_limite)) : null;

    itensPorTarefa.set(tarefa.id, {
      titulo: tarefa.titulo,
      status: concluido ? "concluido" : diasParaPrazo !== null && diasParaPrazo < 0 ? "atrasado" : "aberto",
      diasEmAberto: Math.max(0, diasEntre(new Date(tarefa.criado_em), hoje)),
      prazoFormatado: tarefa.data_limite
        ? formatarDataHoraBrasil(new Date(tarefa.data_limite), { dateStyle: "short", timeStyle: "short" })
        : null,
      diasParaPrazo,
    });
  }

  const itensPorResponsavel = new Map<string, ItemConsolidacao[]>();
  const idsComResponsavel = new Set<string>();

  for (const tm of (tarefaMembros ?? []) as { tarefa_id: string; user_id: string }[]) {
    const item = itensPorTarefa.get(tm.tarefa_id);
    if (!item) continue;
    idsComResponsavel.add(tm.tarefa_id);
    const membro = membrosComAcesso.find((m) => m.user_id === tm.user_id);
    const chave = membro?.email ?? "Responsável fora do quadro";
    if (!itensPorResponsavel.has(chave)) itensPorResponsavel.set(chave, []);
    itensPorResponsavel.get(chave)!.push(item);
  }

  const semResponsavel = listaTarefas
    .filter((t) => !idsComResponsavel.has(t.id))
    .map((t) => itensPorTarefa.get(t.id))
    .filter((item): item is ItemConsolidacao => Boolean(item));

  const secoes: SecaoConsolidacao[] = [...itensPorResponsavel.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nomeResponsavel, itens]) => ({ nomeResponsavel, itens }));

  if (semResponsavel.length > 0) {
    secoes.push({ nomeResponsavel: "Sem responsável", itens: semResponsavel });
  }

  // Resolução PRIVILEGIADA — ver comentário em `resolverEmailsParaNotificacao`:
  // quem dispara o Freeze pode ser um gestor de projeto sem acesso completo
  // (escopo='projeto'), e `membrosComAcesso` sempre inclui o(s) owner(s) do
  // tenant mesmo sem projeto compartilhado com ele — não dependa do e-mail
  // deles estar visível na interface pra esse gestor pra ainda assim
  // conseguir notificá-los.
  const destinatarios = await resolverEmailsParaNotificacao(
    tenantId,
    membrosComAcesso.map((m) => m.user_id),
  );

  await enviarEmailConsolidacao({
    destinatarios,
    nomeProjeto: (projeto?.nome as string | undefined) ?? "Gaiamum",
    secoes,
    projetoId,
  });

  return { enviados: destinatarios.length };
}

// ---------------------------------------------------------------------------
// Colaboração em equipe — convites, membros, permissões
// ---------------------------------------------------------------------------

const LIMITE_CONVITES_POR_HORA = 20;

/** Convite pode ser de workspace (só owner) ou de um projeto específico
 * (gestor daquele projeto também mexe) — usado por `cancelarConvite` e
 * `reenviarConvite`, que recebem só o id do convite, não o contexto de quem
 * está chamando. Defesa em profundidade: a RLS já bloqueia isso, mas até
 * agora essas duas funções dependiam só dela. */
async function exigirDonoDoConvite(tenantId: string, conviteId: string) {
  const supabase = await createClient();
  const { data: convite } = await supabase
    .from("convites")
    .select("projeto_id")
    .eq("id", conviteId)
    .maybeSingle();

  if (!convite) {
    throw new Error("Convite não encontrado.");
  }

  const user = await obterUsuarioAtual();
  const souOwner = (await obterPapelAtual(tenantId)) === "owner";
  const souGestor =
    Boolean(convite.projeto_id) && Boolean(user) && (await eSouGestorDoProjeto(convite.projeto_id, user!.id));

  if (!souOwner && !souGestor) {
    throw new Error("Só o dono do workspace (ou o gestor do quadro, se o convite for de um projeto) mexe nesse convite.");
  }
}

export async function convidarMembro(formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace convida membros por aqui.");
  }

  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("convites")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("criado_em", umaHoraAtras);

  if ((count ?? 0) >= LIMITE_CONVITES_POR_HORA) {
    throw new Error("Muitos convites enviados na última hora — espere um pouco antes de convidar mais gente.");
  }

  const email = campoObrigatorio(formData, "email").toLowerCase();
  const papel = (formData.get("papel") as Papel | null) ?? "member";
  const projetoId = (formData.get("projeto_id") as string | null) || null;

  const { data: convite, error } = await supabase
    .from("convites")
    .insert({
      tenant_id: tenantId,
      email,
      papel,
      convidado_por: user.id,
      projeto_id: projetoId,
    })
    .select("token")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um convite pendente para esse e-mail.");
    }
    throw new Error(`Falha ao convidar: ${error.message}`);
  }

  after(async () => {
    const nomeProjeto = projetoId
      ? (await supabase.from("projetos").select("nome").eq("id", projetoId).maybeSingle()).data?.nome ?? null
      : null;
    await enviarEmailConvite({
      destinatario: email,
      emailConvidante: user.email ?? "Alguém do Gaiamum",
      nomeProjeto,
      token: convite.token as string,
    });
  });

  revalidatePath("/equipe");
}

export async function cancelarConvite(conviteId: string) {
  const tenantId = await garantirWorkspace();
  await exigirDonoDoConvite(tenantId, conviteId);
  const supabase = await createClient();
  const { error } = await supabase.from("convites").update({ status: "cancelado" }).eq("id", conviteId);

  if (error) {
    throw new Error(`Falha ao cancelar convite: ${error.message}`);
  }

  revalidatePath("/equipe");
}

/** Renova o prazo (mais 7 dias) e reenvia o e-mail — mesma policy de UPDATE
 * de `cancelarConvite` (owner do workspace, ou gestor do projeto quando o
 * convite é de um quadro específico) já cobre quem pode chamar isso; o guard
 * de código abaixo é defesa em profundidade, não muda quem já podia chamar. */
export async function reenviarConvite(conviteId: string) {
  const tenantId = await garantirWorkspace();
  await exigirDonoDoConvite(tenantId, conviteId);
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const novaExpiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: convite, error } = await supabase
    .from("convites")
    .update({ expira_em: novaExpiracao })
    .eq("id", conviteId)
    .eq("status", "pendente")
    .select("email, token, projeto_id")
    .single();

  if (error || !convite) {
    throw new Error("Falha ao reenviar convite — talvez ele já tenha sido aceito ou cancelado.");
  }

  after(async () => {
    const nomeProjeto = convite.projeto_id
      ? ((await supabase.from("projetos").select("nome").eq("id", convite.projeto_id).maybeSingle()).data?.nome ??
        null)
      : null;
    await enviarEmailConvite({
      destinatario: convite.email,
      emailConvidante: user.email ?? "Alguém do Gaiamum",
      nomeProjeto,
      token: convite.token as string,
    });
  });

  revalidatePath("/equipe");
  if (convite.projeto_id) {
    revalidatePath(`/projetos/${convite.projeto_id}/configuracoes`);
  }
}

export async function removerMembro(userId: string) {
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace remove membros.");
  }

  const membros = await listarMembros(tenantId);
  const membroAlvo = membros.find((m) => m.user_id === userId);

  if (membroAlvo?.papel === "owner") {
    const totalOwners = membros.filter((m) => m.papel === "owner").length;
    if (totalOwners <= 1) {
      throw new Error("Não é possível remover o único dono do workspace.");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Falha ao remover membro: ${error.message}`);
  }

  after(async () => {
    await notificarEquipe({
      tenantId,
      userId,
      titulo: "Você foi removido de um workspace no Gaiamum",
      link: null,
    });
  });

  revalidatePath("/equipe");
}

export async function aceitarConvite(token: string) {
  const user = await obterUsuarioAtual();

  if (!user) {
    throw new Error("Você precisa estar logado para aceitar o convite.");
  }

  // Precisa do service client: quem está aceitando ainda não é membro do
  // tenant, então current_tenant_ids() (usado no RLS normal) não alcança
  // esse convite ainda.
  const service = createServiceClient();

  const { data: convite, error: erroConvite } = await service
    .from("convites")
    .select("*")
    .eq("token", token)
    .eq("status", "pendente")
    .maybeSingle();

  // Mensagem única pros 3 casos (inexistente/já usado, expirado, e-mail
  // errado) — evita que alguém com um token específico consiga diferenciar
  // essas causas por fora (oráculo fraco de enumeração, já que o token é
  // um uuid v4, mas sem custo nenhum fechar mesmo assim).
  const conviteValido =
    convite &&
    !erroConvite &&
    new Date(convite.expira_em) >= new Date() &&
    convite.email.toLowerCase() === (user.email ?? "").toLowerCase();

  if (!conviteValido) {
    throw new Error("Convite inválido ou expirado.");
  }

  await vincularUsuarioAoConvite(convite as Convite, user.id);

  redirect("/projetos");
}
