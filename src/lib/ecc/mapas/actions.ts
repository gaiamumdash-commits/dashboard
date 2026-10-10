"use server";

import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { ehAreaPlanner, ehChaveData, textoObrigatorio, textoOpcional } from "@/lib/ecc/planner/regras";
import { lerCompromisso } from "@/lib/ecc/planner/validacao";
import { atualizarDatasTarefa, criarTarefa, iniciarHiperfoco } from "@/lib/ecc/actions";
import { FUSO_BRASIL, hojeISOBrasil, paraUtcDoFuso } from "@/lib/ecc/kanban";
import { enviarEmailResumoMapa } from "@/lib/ecc/notificacoes";
import { montarResumoMapa } from "@/lib/ecc/mapas/resumo-email";
import { lerListaIndentada, ordemParaNovo, planoMovimento } from "@/lib/ecc/mapas/arvore";
import { camposDoCompartilhamento, ehCompartilhamento, type Compartilhamento } from "@/lib/ecc/mapas/compartilhamento";
import { CORES_RAMO, MAX_NOS_POR_MAPA, MAX_NOTA_NO, MAX_TEXTO_NO, type CorRamo, type FormaRamo, type MovimentoNo } from "@/lib/ecc/mapas/tipos";

/**
 * Server Actions dos Mapas (migration 0059). Mesmas garantias do Planner:
 * `tenantId` sai de `garantirWorkspace()` (sessão), `user_id` nunca é
 * enviado (o banco preenche com `auth.uid()`), e a RLS só deixa o DONO
 * escrever — mapa compartilhado é só leitura pra equipe. O `.eq("tenant_id")`
 * é defesa em profundidade.
 *
 * Devolvem `ResultadoMapa` em vez de lançar: a mensagem em português chega
 * intacta na tela também em produção.
 */

export type ResultadoMapa = { ok: true; id?: string } | { ok: false; erro: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function contexto(): Promise<{ tenantId: string; supabase: Supabase }> {
  const tenantId = await garantirWorkspace();
  return { tenantId, supabase: await createClient() };
}

function falha(erro: string): ResultadoMapa {
  return { ok: false, erro };
}

function resultado(error: { message: string } | null, mensagem: string, id?: string): ResultadoMapa {
  if (error) {
    console.error(`Mapas: ${mensagem}`, error);
    return falha(`${mensagem} Tente de novo.`);
  }
  revalidatePath("/mapas", "layout");
  return id ? { ok: true, id } : { ok: true };
}

function lerId(valor: unknown): string | null {
  return typeof valor === "string" && /^[0-9a-f-]{36}$/i.test(valor) ? valor : null;
}

const MOVIMENTOS: MovimentoNo[] = ["cima", "baixo", "dentro", "fora"];

/** Ramos do mapa (só id/pai/ordem) — base pra calcular onde um ramo entra. */
async function estruturaDoMapa(supabase: Supabase, tenantId: string, mapaId: string) {
  const { data, error } = await supabase
    .from("mapa_nos")
    .select("id, pai_id, ordem")
    .eq("mapa_id", mapaId)
    .eq("tenant_id", tenantId);
  return { nos: (data ?? []) as { id: string; pai_id: string | null; ordem: number }[], error };
}

/** Mapa mais recente sobe na lista. Falha aqui não desfaz a edição. */
async function tocarMapa(supabase: Supabase, tenantId: string, mapaId: string) {
  await supabase.from("mapas").update({ atualizado_em: new Date().toISOString() }).eq("id", mapaId).eq("tenant_id", tenantId);
}

/** Insere uma lista colada debaixo de `paiId`, mantendo a hierarquia. Ids
 * gerados aqui pra um insert só (o pai sempre vem antes do filho). */
async function inserirLista(
  supabase: Supabase,
  tenantId: string,
  mapaId: string,
  paiId: string,
  texto: string,
  ordemInicial: number,
  vagas: number,
) {
  const { itens, cortados } = lerListaIndentada(texto, vagas);
  const ids = itens.map(() => crypto.randomUUID());
  const linhas = itens.map((item, i) => ({
    id: ids[i],
    tenant_id: tenantId,
    mapa_id: mapaId,
    pai_id: item.pai === -1 ? paiId : ids[item.pai],
    ordem: item.pai === -1 ? ordemInicial + i : i,
    texto: item.texto,
  }));
  if (linhas.length === 0) return { error: null, inseridos: 0, cortados };
  const { error } = await supabase.from("mapa_nos").insert(linhas);
  return { error, inseridos: linhas.length, cortados };
}

// --------------------------------------------------------------------------
// Mapas
// --------------------------------------------------------------------------

/** Cria o mapa com a ideia central; `lista` (opcional) vira os ramos. */
export async function criarMapa(formData: FormData): Promise<ResultadoMapa> {
  const titulo = textoObrigatorio(formData.get("titulo"), MAX_TEXTO_NO, "Ideia central");
  if (!titulo.ok) return falha(titulo.erro);
  const lista = typeof formData.get("lista") === "string" ? String(formData.get("lista")) : "";
  if (lista.length > 50000) return falha("Lista grande demais — cole até 50 mil caracteres.");

  const { tenantId, supabase } = await contexto();
  const { data: mapa, error } = await supabase.from("mapas").insert({ tenant_id: tenantId, titulo: titulo.valor }).select("id").single();
  if (error || !mapa) return resultado(error ?? { message: "sem id" }, "Não foi possível criar o mapa.");

  const raizId = crypto.randomUUID();
  const { error: erroRaiz } = await supabase
    .from("mapa_nos")
    .insert({ id: raizId, tenant_id: tenantId, mapa_id: mapa.id, pai_id: null, ordem: 0, texto: titulo.valor });
  if (erroRaiz) {
    await supabase.from("mapas").delete().eq("id", mapa.id).eq("tenant_id", tenantId);
    return resultado(erroRaiz, "Não foi possível criar o mapa.");
  }

  if (lista.trim()) {
    const { error: erroLista } = await inserirLista(supabase, tenantId, mapa.id, raizId, lista, 1, MAX_NOS_POR_MAPA - 1);
    if (erroLista) {
      console.error("Mapas: lista colada na criação", erroLista);
      revalidatePath("/mapas", "layout");
      return falha("O mapa foi criado, mas a lista colada não entrou. Abra o mapa e cole de novo.");
    }
  }
  return resultado(null, "", mapa.id);
}

export async function excluirMapa(mapaId: string): Promise<ResultadoMapa> {
  const id = lerId(mapaId);
  if (!id) return falha("Mapa inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("mapas").delete().eq("id", id).eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível excluir o mapa.");
}

const AVISO_COMPARTILHAR_PENDENTE =
  "Ainda não dá pra compartilhar: falta uma atualização do banco (migration 0063). O mapa continua como estava.";

/** "Só eu" | "Equipe" | "Equipe e convidados" — só o dono muda (a RLS da
 * 0059 só deixa o dono escrever; o `.eq("user_id")` deixa a resposta clara
 * pra quem não é). Grava sempre as duas colunas: sem a 0063, falha em vez
 * de compartilhar com a regra antiga, que incluía convidados. */
export async function definirCompartilhamento(mapaId: string, escolha: Compartilhamento): Promise<ResultadoMapa> {
  const id = lerId(mapaId);
  if (!id) return falha("Mapa inválido.");
  if (!ehCompartilhamento(escolha)) return falha("Opção de compartilhamento inválida.");
  const usuario = await obterUsuarioAtual();
  if (!usuario) return falha("Sessão expirada. Entre de novo.");

  const { tenantId, supabase } = await contexto();
  const { data, error } = await supabase
    .from("mapas")
    .update(camposDoCompartilhamento(escolha))
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("user_id", usuario.id)
    .select("id");
  if (error?.code === "42703" || error?.code === "PGRST204") return falha(AVISO_COMPARTILHAR_PENDENTE);
  if (!error && (data ?? []).length === 0) return falha("Só quem criou o mapa pode mudar o compartilhamento.");
  return resultado(error, "Não foi possível mudar o compartilhamento.");
}

// --------------------------------------------------------------------------
// Ramos
// --------------------------------------------------------------------------

/** Ramo novo dentro de `paiId` — logo depois de `depoisDe` ou no fim.
 * `idCliente`: o navegador gera o id pra mostrar o ramo na hora (otimista);
 * a RLS e a PK continuam valendo. */
export async function criarNo(
  mapaId: string,
  paiId: string,
  textoBruto: string,
  depoisDe?: string | null,
  idCliente?: string,
): Promise<ResultadoMapa> {
  const mapa = lerId(mapaId);
  const pai = lerId(paiId);
  if (!mapa || !pai) return falha("Ramo inválido.");
  const texto = textoObrigatorio(textoBruto, MAX_TEXTO_NO, "Texto do ramo");
  if (!texto.ok) return falha(texto.erro);

  const { tenantId, supabase } = await contexto();
  const { nos, error: erroLeitura } = await estruturaDoMapa(supabase, tenantId, mapa);
  if (erroLeitura) return resultado(erroLeitura, "Não foi possível criar o ramo.");
  if (!nos.some((n) => n.id === pai)) return falha("Ramo não encontrado. Recarregue a página.");
  if (nos.length >= MAX_NOS_POR_MAPA) return falha(`Este mapa chegou a ${MAX_NOS_POR_MAPA} ramos. Crie outro mapa pra continuar.`);

  const id = lerId(idCliente) ?? crypto.randomUUID();
  const { error } = await supabase.from("mapa_nos").insert({
    id,
    tenant_id: tenantId,
    mapa_id: mapa,
    pai_id: pai,
    ordem: ordemParaNovo(nos, pai, lerId(depoisDe)),
    texto: texto.valor,
  });
  if (!error) {
    // Quem ganhou filho abre, senão o ramo novo "some" dentro do recolhido.
    await supabase.from("mapa_nos").update({ recolhido: false }).eq("id", pai).eq("tenant_id", tenantId).eq("recolhido", true);
    await tocarMapa(supabase, tenantId, mapa);
  }
  return resultado(error, "Não foi possível criar o ramo.", id);
}

/** Cola uma lista dentro de um ramo (cada linha vira um ramo). */
export async function colarListaNoRamo(mapaId: string, paiId: string, texto: string): Promise<ResultadoMapa> {
  const mapa = lerId(mapaId);
  const pai = lerId(paiId);
  if (!mapa || !pai) return falha("Ramo inválido.");
  if (typeof texto !== "string" || !texto.trim()) return falha("Cole pelo menos uma linha.");
  if (texto.length > 50000) return falha("Lista grande demais — cole até 50 mil caracteres.");

  const { tenantId, supabase } = await contexto();
  const { nos, error: erroLeitura } = await estruturaDoMapa(supabase, tenantId, mapa);
  if (erroLeitura) return resultado(erroLeitura, "Não foi possível colar a lista.");
  if (!nos.some((n) => n.id === pai)) return falha("Ramo não encontrado. Recarregue a página.");
  const vagas = MAX_NOS_POR_MAPA - nos.length;
  if (vagas <= 0) return falha(`Este mapa chegou a ${MAX_NOS_POR_MAPA} ramos. Crie outro mapa pra continuar.`);

  const { error, inseridos, cortados } = await inserirLista(supabase, tenantId, mapa, pai, texto, ordemParaNovo(nos, pai), vagas);
  if (error) return resultado(error, "Não foi possível colar a lista.");
  if (inseridos === 0) return falha("Não achei nenhuma linha com texto pra colar.");
  await supabase.from("mapa_nos").update({ recolhido: false }).eq("id", pai).eq("tenant_id", tenantId);
  await tocarMapa(supabase, tenantId, mapa);
  revalidatePath("/mapas", "layout");
  return cortados > 0 ? falha(`Entraram ${inseridos} ramos; ${cortados} ficaram de fora pelo limite de ${MAX_NOS_POR_MAPA}.`) : { ok: true };
}

/** Corrige o texto (e a nota, quando vier). Na ideia central, o título do
 * mapa acompanha. */
export async function editarNo(noId: string, textoBruto: string, notaBruta?: string): Promise<ResultadoMapa> {
  const id = lerId(noId);
  if (!id) return falha("Ramo inválido.");
  const texto = textoObrigatorio(textoBruto, MAX_TEXTO_NO, "Texto do ramo");
  if (!texto.ok) return falha(texto.erro);
  const campos: Record<string, unknown> = { texto: texto.valor, atualizado_em: new Date().toISOString() };
  if (notaBruta !== undefined) {
    const nota = textoOpcional(notaBruta, MAX_NOTA_NO, "Nota");
    if (!nota.ok) return falha(nota.erro);
    campos.nota = nota.valor;
  }

  const { tenantId, supabase } = await contexto();
  const { data, error } = await supabase
    .from("mapa_nos")
    .update(campos)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("mapa_id, pai_id");
  if (error) return resultado(error, "Não foi possível salvar o ramo.");
  const no = data?.[0];
  if (!no) return falha("Ramo não encontrado. Recarregue a página.");

  if (no.pai_id === null) {
    const { error: erroTitulo } = await supabase
      .from("mapas")
      .update({ titulo: texto.valor, atualizado_em: new Date().toISOString() })
      .eq("id", no.mapa_id)
      .eq("tenant_id", tenantId);
    return resultado(erroTitulo, "Não foi possível renomear o mapa.");
  }
  await tocarMapa(supabase, tenantId, no.mapa_id);
  return resultado(null, "");
}

/** Exclui o ramo e tudo o que está dentro dele. A ideia central não sai
 * (pra apagar tudo, exclua o mapa). */
export async function excluirNo(noId: string): Promise<ResultadoMapa> {
  const id = lerId(noId);
  if (!id) return falha("Ramo inválido.");
  const { tenantId, supabase } = await contexto();
  const { data, error } = await supabase
    .from("mapa_nos")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .not("pai_id", "is", null)
    .select("mapa_id");
  if (!error && (data ?? []).length === 0) return falha("Esse ramo não pode ser excluído. Recarregue a página.");
  if (data?.[0]) await tocarMapa(supabase, tenantId, data[0].mapa_id);
  return resultado(error, "Não foi possível excluir o ramo.");
}

export async function moverNo(noId: string, movimento: MovimentoNo): Promise<ResultadoMapa> {
  const id = lerId(noId);
  if (!id || !MOVIMENTOS.includes(movimento)) return falha("Movimento inválido.");
  const { tenantId, supabase } = await contexto();
  const { data: no, error: erroNo } = await supabase.from("mapa_nos").select("mapa_id").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
  if (erroNo || !no) return falha("Ramo não encontrado. Recarregue a página.");
  const { nos, error: erroLeitura } = await estruturaDoMapa(supabase, tenantId, no.mapa_id);
  if (erroLeitura) return resultado(erroLeitura, "Não foi possível mover o ramo.");

  const plano = planoMovimento(nos, id, movimento);
  if (!plano) return { ok: true }; // já está na ponta: nada a fazer
  const { error } = await supabase
    .from("mapa_nos")
    .update({ ...plano, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (!error && movimento === "dentro") {
    await supabase.from("mapa_nos").update({ recolhido: false }).eq("id", plano.pai_id).eq("tenant_id", tenantId);
  }
  return resultado(error, "Não foi possível mover o ramo.");
}

/** Recolher/expandir fica salvo: o mapa abre do jeito que a pessoa deixou. */
export async function definirRecolhido(noId: string, recolhido: boolean): Promise<ResultadoMapa> {
  const id = lerId(noId);
  if (!id) return falha("Ramo inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("mapa_nos").update({ recolhido: recolhido === true }).eq("id", id).eq("tenant_id", tenantId);
  return resultado(error, recolhido ? "Não foi possível recolher." : "Não foi possível expandir.");
}

/** Recolhe ou expande todos os ramos que têm algo dentro. */
export async function definirTudoRecolhido(mapaId: string, recolhido: boolean): Promise<ResultadoMapa> {
  const id = lerId(mapaId);
  if (!id) return falha("Mapa inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("mapa_nos")
    .update({ recolhido: recolhido === true })
    .eq("mapa_id", id)
    .eq("tenant_id", tenantId)
    .not("pai_id", "is", null);
  return resultado(error, "Não foi possível atualizar o mapa.");
}

// --------------------------------------------------------------------------
// Visão de mapa (fase 2): posições e desfazer
// --------------------------------------------------------------------------

const AVISO_POSICAO_PENDENTE =
  "Ainda não dá pra salvar posição, cor ou borda dos ramos: falta uma atualização do banco (migration 0060). O resto do mapa funciona normalmente.";

function lerCoordenada(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) && Math.abs(valor) <= 100000 ? Math.round(valor * 10) / 10 : null;
}

function erroDePosicao(error: { code?: string; message: string } | null, mensagem: string): ResultadoMapa {
  if (error?.code === "42703" || error?.code === "PGRST204") return falha(AVISO_POSICAO_PENDENTE);
  return resultado(error, mensagem);
}

/** Posição arrastada (relativa ao pai), ou null pra voltar ao automático.
 * Só desenho: nunca toca em `pai_id`/`ordem`. Gravada ao SOLTAR o ramo. */
export async function salvarPosicao(noId: string, posicao: { x: number; y: number } | null): Promise<ResultadoMapa> {
  const id = lerId(noId);
  if (!id) return falha("Ramo inválido.");
  const x = posicao ? lerCoordenada(posicao.x) : null;
  const y = posicao ? lerCoordenada(posicao.y) : null;
  if (posicao && (x === null || y === null)) return falha("Posição inválida.");

  const { tenantId, supabase } = await contexto();
  const { data, error } = await supabase
    .from("mapa_nos")
    .update({ pos_x: x, pos_y: y })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .not("pai_id", "is", null)
    .select("id");
  if (!error && (data ?? []).length === 0) return falha("Ramo não encontrado. Recarregue a página.");
  return erroDePosicao(error, "Não foi possível salvar a posição.");
}

/** Cor e borda escolhidas no ramo (null = automática). Só valores da
 * paleta; o CHECK da migration 0060 é a garantia. */
export async function definirAparencia(noId: string, aparencia: { cor: CorRamo | null; forma: FormaRamo | null }): Promise<ResultadoMapa> {
  const id = lerId(noId);
  if (!id) return falha("Ramo inválido.");
  const cor = aparencia?.cor ?? null;
  const forma = aparencia?.forma ?? null;
  if (cor !== null && !CORES_RAMO.includes(cor)) return falha("Cor inválida.");
  if (forma !== null && forma !== "caixa" && forma !== "linha") return falha("Borda inválida.");

  const { tenantId, supabase } = await contexto();
  const { data, error } = await supabase.from("mapa_nos").update({ cor, forma }).eq("id", id).eq("tenant_id", tenantId).select("id");
  if (!error && (data ?? []).length === 0) return falha("Ramo não encontrado. Recarregue a página.");
  return erroDePosicao(error, "Não foi possível salvar a aparência.");
}

/** "Reorganizar": todos os ramos voltam ao layout automático. */
export async function limparPosicoes(mapaId: string): Promise<ResultadoMapa> {
  const id = lerId(mapaId);
  if (!id) return falha("Mapa inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("mapa_nos")
    .update({ pos_x: null, pos_y: null })
    .eq("mapa_id", id)
    .eq("tenant_id", tenantId)
    .not("pos_x", "is", null);
  return erroDePosicao(error, "Não foi possível reorganizar o mapa.");
}

/** Desfazer "Reorganizar": devolve as posições que existiam antes. */
export async function definirPosicoes(mapaId: string, itens: { id: string; x: number; y: number }[]): Promise<ResultadoMapa> {
  const mapa = lerId(mapaId);
  if (!mapa || !Array.isArray(itens) || itens.length > MAX_NOS_POR_MAPA) return falha("Posições inválidas.");
  const validos = itens.map((i) => ({ id: lerId(i?.id), x: lerCoordenada(i?.x), y: lerCoordenada(i?.y) }));
  if (validos.some((i) => !i.id || i.x === null || i.y === null)) return falha("Posições inválidas.");

  const { tenantId, supabase } = await contexto();
  const respostas = await Promise.all(
    validos.map((i) =>
      supabase.from("mapa_nos").update({ pos_x: i.x, pos_y: i.y }).eq("id", i.id!).eq("mapa_id", mapa).eq("tenant_id", tenantId),
    ),
  );
  return erroDePosicao(respostas.find((r) => r.error)?.error ?? null, "Não foi possível restaurar as posições.");
}

/** Desfazer uma exclusão: reinsere o ramo e tudo o que estava dentro, com
 * os mesmos ids, num insert só (pai antes dos filhos). O pai do primeiro
 * ramo precisa continuar existindo no mapa. */
export async function restaurarRamos(mapaId: string, nos: unknown[]): Promise<ResultadoMapa> {
  const mapa = lerId(mapaId);
  if (!mapa || !Array.isArray(nos) || nos.length === 0 || nos.length > MAX_NOS_POR_MAPA) return falha("Nada pra restaurar.");

  const linhas: Record<string, unknown>[] = [];
  const ids = new Set<string>();
  for (const bruto of nos) {
    const n = (bruto ?? {}) as Record<string, unknown>;
    const id = lerId(n.id);
    const pai = lerId(n.pai_id);
    const texto = textoObrigatorio(n.texto, MAX_TEXTO_NO, "Texto do ramo");
    const nota = textoOpcional(n.nota ?? "", MAX_NOTA_NO, "Nota");
    const ordem = typeof n.ordem === "number" && Number.isFinite(n.ordem) ? n.ordem : null;
    if (!id || !pai || !texto.ok || !nota.ok || ordem === null) return falha("Não foi possível restaurar: dados inválidos.");
    // Dentro do lote, o pai tem que vir antes (só o 1º aponta pra fora).
    if (linhas.length > 0 && !ids.has(pai)) return falha("Não foi possível restaurar: ordem inválida.");
    ids.add(id);
    const x = lerCoordenada(n.pos_x);
    const y = lerCoordenada(n.pos_y);
    linhas.push({
      id,
      mapa_id: mapa,
      pai_id: pai,
      ordem,
      texto: texto.valor,
      nota: nota.valor,
      recolhido: n.recolhido === true,
      ...(x !== null && y !== null ? { pos_x: x, pos_y: y } : {}),
      // Aparência só vai se for da paleta (e só existe com a 0060 aplicada).
      ...(CORES_RAMO.includes(n.cor as CorRamo) ? { cor: n.cor } : {}),
      ...(n.forma === "caixa" || n.forma === "linha" ? { forma: n.forma } : {}),
    });
  }

  const { tenantId, supabase } = await contexto();
  const { nos: atuais, error: erroLeitura } = await estruturaDoMapa(supabase, tenantId, mapa);
  if (erroLeitura) return resultado(erroLeitura, "Não foi possível restaurar.");
  if (!atuais.some((n) => n.id === linhas[0].pai_id)) return falha("O ramo de cima não existe mais — não dá pra desfazer.");
  if (atuais.length + linhas.length > MAX_NOS_POR_MAPA) return falha(`Restaurar passaria de ${MAX_NOS_POR_MAPA} ramos.`);

  const { error } = await supabase.from("mapa_nos").insert(linhas.map((l) => ({ ...l, tenant_id: tenantId })));
  if (!error) await tocarMapa(supabase, tenantId, mapa);
  return resultado(error, "Não foi possível restaurar o ramo.");
}

// --------------------------------------------------------------------------
// Fase 3: executar ramo (Kanban / Planner) e resumo por e-mail
// --------------------------------------------------------------------------

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Liga o ramo à tarefa/compromisso recém-criado (só o dono do mapa). */
async function ligarRamo(
  supabase: Supabase,
  tenantId: string,
  noId: string,
  campos: { tarefa_id?: string | null; compromisso_id?: string | null },
) {
  const { data, error } = await supabase.from("mapa_nos").update(campos).eq("id", noId).eq("tenant_id", tenantId).select("mapa_id");
  if (!error && data?.[0]) await tocarMapa(supabase, tenantId, data[0].mapa_id);
  return { error: error ?? (data && data.length > 0 ? null : { message: "ramo não encontrado" }) };
}

/** Texto do ramo → título de uma linha (o Kanban cria 1 cartão por linha). */
function tituloDeUmaLinha(bruto: unknown): string | null {
  const t = typeof bruto === "string" ? bruto.replace(/\s+/g, " ").trim() : "";
  return t && t.length <= 200 ? t : null;
}

/**
 * "▶ Executar este ramo" como TAREFA do Kanban. Usa as próprias Server
 * Actions do Kanban (criar, prazo, hiperfoco) — mesmas regras, mesma RLS do
 * projeto; o mapa só guarda o vínculo (`tarefa_id`). Prazo, alarme, foco e
 * cor de urgência continuam sendo os do Kanban (decisão de 2026-10-10).
 */
export async function executarRamoComoTarefa(
  noId: string,
  dados: { projetoId: string; colunaId: string; titulo: string; data?: string | null; hora?: string | null; focoMinutos?: number | null },
): Promise<ResultadoMapa> {
  const no = lerId(noId);
  const projetoId = lerId(dados?.projetoId);
  const colunaId = lerId(dados?.colunaId);
  const titulo = tituloDeUmaLinha(dados?.titulo);
  if (!no || !projetoId || !colunaId) return falha("Escolha o projeto e a coluna.");
  if (!titulo) return falha("O título da tarefa precisa ter entre 1 e 200 caracteres.");
  const data = dados.data || null;
  const hora = dados.hora || null;
  if (data && !ehChaveData(data)) return falha("Data inválida.");
  if (hora && !HORA_VALIDA.test(hora)) return falha("Horário inválido.");
  const foco = dados.focoMinutos ?? null;
  if (foco !== null && (!Number.isInteger(foco) || foco < 1 || foco > 24 * 60)) return falha("Duração do foco: de 1 minuto a 24 horas.");

  const { tenantId, supabase } = await contexto();
  const { data: ramo } = await supabase.from("mapa_nos").select("id, tarefa_id").eq("id", no).eq("tenant_id", tenantId).maybeSingle();
  if (!ramo) return falha("Ramo não encontrado. Recarregue a página.");
  if (ramo.tarefa_id) return falha("Este ramo já virou tarefa. Desligue antes de criar outra.");

  const tarefaId = crypto.randomUUID();
  try {
    const fd = new FormData();
    fd.set("titulo", titulo);
    await criarTarefa(projetoId, colunaId, fd, [tarefaId]);
    if (data) {
      const prazo = new FormData();
      prazo.set("data_limite", paraUtcDoFuso(`${data}T${hora ?? "18:00"}`, FUSO_BRASIL).toISOString());
      await atualizarDatasTarefa(tarefaId, projetoId, prazo);
    }
    if (foco) await iniciarHiperfoco(tarefaId, projetoId, foco);
  } catch (erro) {
    console.error("Mapas: executar como tarefa", erro);
    const mensagem = erro instanceof Error && /Concluído/.test(erro.message) ? erro.message : "Não foi possível criar a tarefa.";
    return falha(`${mensagem} Tente de novo.`);
  }

  const { error } = await ligarRamo(supabase, tenantId, no, { tarefa_id: tarefaId });
  revalidatePath(`/projetos/${projetoId}/tarefas`);
  return resultado(error, "A tarefa foi criada, mas não ficou ligada ao ramo.");
}

/** "▶ Executar este ramo" como COMPROMISSO do Planner (aparece na Agenda e
 * no resumo das 7h). Mesma validação do formulário do Planner. */
export async function executarRamoComoCompromisso(noId: string, formData: FormData): Promise<ResultadoMapa> {
  const no = lerId(noId);
  if (!no) return falha("Ramo inválido.");
  const area = formData.get("area");
  if (!ehAreaPlanner(area)) return falha("Área inválida.");
  const compromisso = lerCompromisso(formData);
  if (!compromisso.ok) return falha(compromisso.erro);

  const { tenantId, supabase } = await contexto();
  const { data: ramo } = await supabase.from("mapa_nos").select("id, compromisso_id").eq("id", no).eq("tenant_id", tenantId).maybeSingle();
  if (!ramo) return falha("Ramo não encontrado. Recarregue a página.");
  if (ramo.compromisso_id) return falha("Este ramo já virou compromisso. Desligue antes de criar outro.");

  const compromissoId = crypto.randomUUID();
  const { error: erroCriar } = await supabase
    .from("planner_compromissos")
    .insert({ id: compromissoId, tenant_id: tenantId, area, tipo: "outro", ...compromisso.valor });
  if (erroCriar) return resultado(erroCriar, "Não foi possível criar o compromisso.");

  const { error } = await ligarRamo(supabase, tenantId, no, { compromisso_id: compromissoId });
  revalidatePath("/planner", "layout");
  revalidatePath("/agenda");
  return resultado(error, "O compromisso foi criado, mas não ficou ligado ao ramo.");
}

/** Desfaz só o VÍNCULO — a tarefa/compromisso continua existindo lá. */
export async function desligarRamo(noId: string, qual: "tarefa" | "compromisso"): Promise<ResultadoMapa> {
  const no = lerId(noId);
  if (!no || (qual !== "tarefa" && qual !== "compromisso")) return falha("Ramo inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await ligarRamo(supabase, tenantId, no, qual === "tarefa" ? { tarefa_id: null } : { compromisso_id: null });
  return resultado(error, "Não foi possível desligar.");
}

const LIMITE_ENVIOS_DIA = 20;

/** "📬 Resumo por e-mail": o mapa em tópicos + datas + palavras-chave, SÓ
 * pro e-mail de quem pediu (vem da sessão). Limite: 1 por minuto e 20 por
 * dia por pessoa (tabela `mapa_envios`, migration 0062). */
export async function enviarResumoMapa(mapaId: string): Promise<ResultadoMapa> {
  const mapa = lerId(mapaId);
  if (!mapa) return falha("Mapa inválido.");
  const { tenantId, supabase } = await contexto();
  const usuario = await obterUsuarioAtual();
  if (!usuario?.email) return falha("Sua conta não tem e-mail pra receber o resumo.");

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: envios, error: erroEnvios } = await supabase
    .from("mapa_envios")
    .select("enviado_em")
    .eq("user_id", usuario.id)
    .gte("enviado_em", desde)
    .order("enviado_em", { ascending: false });
  if (erroEnvios) {
    if (erroEnvios.code === "42P01" || erroEnvios.code === "PGRST205") {
      return falha("O resumo por e-mail ainda não está liberado: falta uma atualização do banco (migration 0062).");
    }
    return resultado(erroEnvios, "Não foi possível enviar o resumo.");
  }
  if ((envios ?? []).length >= LIMITE_ENVIOS_DIA) return falha(`Limite de ${LIMITE_ENVIOS_DIA} resumos por dia atingido. Tente amanhã.`);
  if (envios?.[0] && Date.now() - new Date(envios[0].enviado_em).getTime() < 60_000) {
    return falha("Você acabou de pedir um resumo. Espere 1 minuto pra pedir outro.");
  }

  const [{ data: dadosMapa }, { data: nos }] = await Promise.all([
    supabase.from("mapas").select("titulo").eq("id", mapa).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("mapa_nos").select("id, pai_id, ordem, texto, nota").eq("mapa_id", mapa).eq("tenant_id", tenantId),
  ]);
  if (!dadosMapa) return falha("Mapa não encontrado.");

  // Registra ANTES de mandar: clique duplo não manda 2 e-mails.
  const { error: erroRegistro } = await supabase.from("mapa_envios").insert({ tenant_id: tenantId, mapa_id: mapa });
  if (erroRegistro) return resultado(erroRegistro, "Não foi possível enviar o resumo.");

  const resumo = montarResumoMapa({
    titulo: dadosMapa.titulo,
    nos: nos ?? [],
    hoje: hojeISOBrasil(),
    link: `https://www.gaiamum.com.br/mapas/${mapa}`,
  });
  const enviado = await enviarEmailResumoMapa({ destinatario: usuario.email, resumo });
  if (!enviado) return falha("O e-mail não saiu agora. Tente de novo em alguns minutos.");
  return { ok: true };
}
