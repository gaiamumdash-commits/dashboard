"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { FUSO_BRASIL, hojeISOBrasil, paraUtcDoFuso } from "@/lib/ecc/kanban";
import {
  concluirManutencao,
  dataOpcional,
  ehAreaPlanner,
  ehChaveData,
  ehRefeicao,
  inteiroEntre,
  segundaDaChave,
  textoObrigatorio,
  textoOpcional,
  validarHabito,
} from "@/lib/ecc/planner/regras";
import { AREAS_PLANNER, type ResultadoAcao } from "@/lib/ecc/planner/tipos";

/**
 * Server Actions do Planner (migration 0057). Mesmas garantias do resto do
 * app: `tenantId` sai sempre de `garantirWorkspace()` (sessão), nunca do
 * navegador; `user_id` nunca é enviado — o banco preenche com `auth.uid()` e
 * a RLS (`planner_eh_meu`) recusa qualquer linha que não seja da própria
 * pessoa. Update/delete por `id` só alcançam linhas da própria pessoa pela
 * mesma RLS; o `.eq("tenant_id")` extra é defesa em profundidade.
 *
 * Retornam `ResultadoAcao` em vez de lançar: a mensagem de validação em
 * português chega intacta na tela também em produção (ver `tipos.ts`).
 */

type Contexto = { tenantId: string; supabase: Awaited<ReturnType<typeof createClient>> };

async function contexto(): Promise<Contexto> {
  const tenantId = await garantirWorkspace();
  return { tenantId, supabase: await createClient() };
}

function falha(erro: string): ResultadoAcao {
  return { ok: false, erro };
}

const OK: ResultadoAcao = { ok: true };

/** Tudo do Planner vive sob /planner; datas (compromissos, manutenções)
 * também aparecem na Agenda. */
function revalidarPlanner(tambemAgenda = false) {
  revalidatePath("/planner", "layout");
  if (tambemAgenda) revalidatePath("/agenda");
}

function resultado(error: { message: string } | null, mensagem: string, tambemAgenda = false): ResultadoAcao {
  if (error) {
    console.error(`Planner: ${mensagem}`, error);
    return falha(`${mensagem} Tente de novo.`);
  }
  revalidarPlanner(tambemAgenda);
  return OK;
}

function lerId(valor: unknown): string | null {
  return typeof valor === "string" && /^[0-9a-f-]{36}$/i.test(valor) ? valor : null;
}

// --------------------------------------------------------------------------
// Primeiro acesso
// --------------------------------------------------------------------------

export async function salvarPreferenciasPlanner(areas: string[]): Promise<ResultadoAcao> {
  const { tenantId, supabase } = await contexto();
  const validas = AREAS_PLANNER.filter((a) => areas.includes(a));
  const { error } = await supabase
    .from("planner_preferencias")
    .upsert({ tenant_id: tenantId, areas: validas, atualizado_em: new Date().toISOString() }, { onConflict: "user_id,tenant_id" });
  return resultado(error, "Não foi possível salvar suas preferências.");
}

// --------------------------------------------------------------------------
// Hábitos e rotinas
// --------------------------------------------------------------------------

function lerHabito(formData: FormData) {
  return validarHabito({
    nome: formData.get("nome"),
    area: formData.get("area"),
    tipo: formData.get("tipo"),
    dias: formData.getAll("dias"),
    horario: formData.get("horario"),
    duracao: formData.get("duracao"),
  });
}

export async function criarHabito(formData: FormData): Promise<ResultadoAcao> {
  const validado = lerHabito(formData);
  if (!validado.ok) return falha(validado.erro);
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_habitos").insert({ tenant_id: tenantId, ...validado.valor });
  return resultado(error, "Não foi possível criar.");
}

export async function editarHabito(habitoId: string, formData: FormData): Promise<ResultadoAcao> {
  const id = lerId(habitoId);
  if (!id) return falha("Item inválido.");
  const validado = lerHabito(formData);
  if (!validado.ok) return falha(validado.erro);
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("planner_habitos")
    .update({ ...validado.valor, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível salvar.");
}

/** Arquivar mantém o histórico de dias feitos; reativar devolve à semana. */
export async function definirHabitoAtivo(habitoId: string, ativo: boolean): Promise<ResultadoAcao> {
  const id = lerId(habitoId);
  if (!id) return falha("Item inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("planner_habitos")
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  return resultado(error, ativo ? "Não foi possível reativar." : "Não foi possível arquivar.");
}

export async function excluirHabito(habitoId: string): Promise<ResultadoAcao> {
  const id = lerId(habitoId);
  if (!id) return falha("Item inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_habitos").delete().eq("id", id).eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível excluir.");
}

/** Marca/desmarca um dia. Não aceita dia futuro (ainda não aconteceu).
 * Marcar o que já está marcado não é erro (clique duplo/2 abas). */
export async function marcarHabitoNoDia(habitoId: string, data: string, feito: boolean): Promise<ResultadoAcao> {
  const id = lerId(habitoId);
  if (!id || !ehChaveData(data)) return falha("Dia inválido.");
  if (data > hojeISOBrasil()) return falha("Não dá pra marcar um dia que ainda não chegou.");
  const { tenantId, supabase } = await contexto();

  if (feito) {
    const { error } = await supabase
      .from("planner_habito_registros")
      .upsert({ tenant_id: tenantId, habito_id: id, data }, { onConflict: "habito_id,data", ignoreDuplicates: true });
    return resultado(error, "Não foi possível marcar.");
  }
  const { error } = await supabase
    .from("planner_habito_registros")
    .delete()
    .eq("habito_id", id)
    .eq("data", data)
    .eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível desmarcar.");
}

// --------------------------------------------------------------------------
// Objetivos e notas
// --------------------------------------------------------------------------

export async function criarObjetivo(formData: FormData): Promise<ResultadoAcao> {
  const titulo = textoObrigatorio(formData.get("titulo"), 200, "Objetivo");
  if (!titulo.ok) return falha(titulo.erro);
  const area = formData.get("area");
  if (!ehAreaPlanner(area)) return falha("Área inválida.");
  const prazo = dataOpcional(formData.get("prazo"), "Data");
  if (!prazo.ok) return falha(prazo.erro);
  const notas = textoOpcional(formData.get("notas"), 2000, "Notas");
  if (!notas.ok) return falha(notas.erro);

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("planner_objetivos")
    .insert({ tenant_id: tenantId, titulo: titulo.valor, area, prazo: prazo.valor, notas: notas.valor });
  return resultado(error, "Não foi possível criar o objetivo.");
}

export async function atualizarStatusObjetivo(objetivoId: string, status: string): Promise<ResultadoAcao> {
  const id = lerId(objetivoId);
  if (!id || !["em_andamento", "pausado", "concluido"].includes(status)) return falha("Status inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("planner_objetivos")
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível atualizar o objetivo.");
}

export async function excluirObjetivo(objetivoId: string): Promise<ResultadoAcao> {
  return excluirPorId("planner_objetivos", objetivoId, "Não foi possível excluir o objetivo.");
}

export async function criarNota(formData: FormData): Promise<ResultadoAcao> {
  const titulo = textoObrigatorio(formData.get("titulo"), 200, "Título");
  if (!titulo.ok) return falha(titulo.erro);
  const area = formData.get("area");
  if (!ehAreaPlanner(area)) return falha("Área inválida.");
  const conteudo = textoOpcional(formData.get("conteudo"), 10000, "Nota");
  if (!conteudo.ok) return falha(conteudo.erro);

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("planner_notas")
    .insert({ tenant_id: tenantId, area, titulo: titulo.valor, conteudo: conteudo.valor ?? "" });
  return resultado(error, "Não foi possível criar a nota.");
}

export async function atualizarNota(notaId: string, tituloBruto: string, conteudoBruto: string): Promise<ResultadoAcao> {
  const id = lerId(notaId);
  if (!id) return falha("Nota inválida.");
  const titulo = textoObrigatorio(tituloBruto, 200, "Título");
  if (!titulo.ok) return falha(titulo.erro);
  const conteudo = textoOpcional(conteudoBruto, 10000, "Nota");
  if (!conteudo.ok) return falha(conteudo.erro);

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("planner_notas")
    .update({ titulo: titulo.valor, conteudo: conteudo.valor ?? "", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível salvar a nota.");
}

export async function excluirNota(notaId: string): Promise<ResultadoAcao> {
  return excluirPorId("planner_notas", notaId, "Não foi possível excluir a nota.");
}

// --------------------------------------------------------------------------
// Estudos: leituras e cursos/idiomas
// --------------------------------------------------------------------------

export async function criarLeitura(formData: FormData): Promise<ResultadoAcao> {
  const titulo = textoObrigatorio(formData.get("titulo"), 200, "Título");
  if (!titulo.ok) return falha(titulo.erro);
  const autor = textoOpcional(formData.get("autor"), 120, "Autor");
  if (!autor.ok) return falha(autor.erro);
  const status = formData.get("status");
  if (!["quero_ler", "lendo", "concluido"].includes(String(status))) return falha("Status inválido.");
  const dataAlvo = dataOpcional(formData.get("data_alvo"), "Data alvo");
  if (!dataAlvo.ok) return falha(dataAlvo.erro);

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_leituras").insert({
    tenant_id: tenantId,
    titulo: titulo.valor,
    autor: autor.valor,
    status,
    progresso: status === "concluido" ? 100 : 0,
    data_inicio: status === "lendo" ? hojeISOBrasil() : null,
    data_alvo: dataAlvo.valor,
  });
  return resultado(error, "Não foi possível adicionar a leitura.");
}

/** Status e progresso andam juntos: concluir = 100%; começar a ler grava a
 * data de início (se ainda não tinha). */
export async function atualizarLeitura(
  leituraId: string,
  mudanca: { status?: string; progresso?: number; notas?: string },
): Promise<ResultadoAcao> {
  const id = lerId(leituraId);
  if (!id) return falha("Leitura inválida.");
  const campos: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (mudanca.status !== undefined) {
    if (!["quero_ler", "lendo", "concluido"].includes(mudanca.status)) return falha("Status inválido.");
    campos.status = mudanca.status;
    if (mudanca.status === "concluido") campos.progresso = 100;
  }
  if (mudanca.progresso !== undefined) {
    const progresso = inteiroEntre(mudanca.progresso, 0, 100, "Progresso");
    if (!progresso.ok) return falha(progresso.erro);
    campos.progresso = progresso.valor;
  }
  if (mudanca.notas !== undefined) {
    const notas = textoOpcional(mudanca.notas, 2000, "Notas");
    if (!notas.ok) return falha(notas.erro);
    campos.notas = notas.valor;
  }

  const { tenantId, supabase } = await contexto();
  if (mudanca.status === "lendo") {
    await supabase
      .from("planner_leituras")
      .update({ data_inicio: hojeISOBrasil() })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("data_inicio", null);
  }
  const { error } = await supabase.from("planner_leituras").update(campos).eq("id", id).eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível atualizar a leitura.");
}

export async function excluirLeitura(leituraId: string): Promise<ResultadoAcao> {
  return excluirPorId("planner_leituras", leituraId, "Não foi possível excluir a leitura.");
}

export async function criarCurso(formData: FormData): Promise<ResultadoAcao> {
  const tipo = formData.get("tipo") === "idioma" ? "idioma" : "curso";
  const nome = textoObrigatorio(formData.get("nome"), 200, tipo === "idioma" ? "Idioma" : "Nome do curso");
  if (!nome.ok) return falha(nome.erro);
  const instituicao = textoOpcional(formData.get("instituicao"), 120, "Instituição");
  if (!instituicao.ok) return falha(instituicao.erro);
  const objetivo = textoOpcional(formData.get("objetivo"), 300, "Objetivo");
  if (!objetivo.ok) return falha(objetivo.erro);
  const frequencia = textoOpcional(formData.get("frequencia"), 120, "Frequência");
  if (!frequencia.ok) return falha(frequencia.erro);
  const dataAlvo = dataOpcional(formData.get("data_alvo"), "Data alvo");
  if (!dataAlvo.ok) return falha(dataAlvo.erro);
  const link = textoOpcional(formData.get("link"), 500, "Link");
  if (!link.ok) return falha(link.erro);
  if (link.valor && !/^https?:\/\//i.test(link.valor)) return falha("O link precisa começar com http:// ou https://.");

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_cursos").insert({
    tenant_id: tenantId,
    tipo,
    nome: nome.valor,
    instituicao: instituicao.valor,
    objetivo: objetivo.valor,
    frequencia: frequencia.valor,
    data_alvo: dataAlvo.valor,
    link: link.valor,
  });
  return resultado(error, tipo === "idioma" ? "Não foi possível adicionar o idioma." : "Não foi possível adicionar o curso.");
}

export async function atualizarCurso(
  cursoId: string,
  mudanca: { status?: string; progresso?: number; notas?: string },
): Promise<ResultadoAcao> {
  const id = lerId(cursoId);
  if (!id) return falha("Curso inválido.");
  const campos: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (mudanca.status !== undefined) {
    if (!["planejado", "em_andamento", "concluido"].includes(mudanca.status)) return falha("Status inválido.");
    campos.status = mudanca.status;
    if (mudanca.status === "concluido") campos.progresso = 100;
  }
  if (mudanca.progresso !== undefined) {
    const progresso = inteiroEntre(mudanca.progresso, 0, 100, "Progresso");
    if (!progresso.ok) return falha(progresso.erro);
    campos.progresso = progresso.valor;
  }
  if (mudanca.notas !== undefined) {
    const notas = textoOpcional(mudanca.notas, 2000, "Notas");
    if (!notas.ok) return falha(notas.erro);
    campos.notas = notas.valor;
  }
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_cursos").update(campos).eq("id", id).eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível atualizar.");
}

export async function excluirCurso(cursoId: string): Promise<ResultadoAcao> {
  return excluirPorId("planner_cursos", cursoId, "Não foi possível excluir.");
}

// --------------------------------------------------------------------------
// Casa: compras, cardápio, pets, manutenções
// --------------------------------------------------------------------------

export async function adicionarCompra(formData: FormData): Promise<ResultadoAcao> {
  const nome = textoObrigatorio(formData.get("nome"), 120, "Item");
  if (!nome.ok) return falha(nome.erro);
  const categoria = textoOpcional(formData.get("categoria"), 60, "Categoria");
  if (!categoria.ok) return falha(categoria.erro);
  const quantidade = textoOpcional(formData.get("quantidade"), 40, "Quantidade");
  if (!quantidade.ok) return falha(quantidade.erro);

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_compras").insert({
    tenant_id: tenantId,
    nome: nome.valor,
    categoria: categoria.valor ?? "Geral",
    quantidade: quantidade.valor,
  });
  return resultado(error, "Não foi possível adicionar o item.");
}

export async function marcarCompra(itemId: string, comprado: boolean): Promise<ResultadoAcao> {
  const id = lerId(itemId);
  if (!id) return falha("Item inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_compras").update({ comprado }).eq("id", id).eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível atualizar o item.");
}

export async function excluirCompra(itemId: string): Promise<ResultadoAcao> {
  return excluirPorId("planner_compras", itemId, "Não foi possível remover o item.");
}

export async function limparComprados(): Promise<ResultadoAcao> {
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_compras").delete().eq("tenant_id", tenantId).eq("comprado", true);
  return resultado(error, "Não foi possível limpar a lista.");
}

/** Salva uma célula do cardápio; texto vazio apaga a célula. */
export async function salvarRefeicao(
  semana: string,
  diaSemana: number,
  refeicao: string,
  descricaoBruta: string,
): Promise<ResultadoAcao> {
  if (!ehChaveData(semana) || segundaDaChave(semana) !== semana) return falha("Semana inválida.");
  if (!Number.isInteger(diaSemana) || diaSemana < 1 || diaSemana > 7) return falha("Dia inválido.");
  if (!ehRefeicao(refeicao)) return falha("Refeição inválida.");
  const descricao = textoOpcional(descricaoBruta, 200, "Refeição");
  if (!descricao.ok) return falha(descricao.erro);

  const { tenantId, supabase } = await contexto();
  if (!descricao.valor) {
    const { error } = await supabase
      .from("planner_cardapio")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("semana", semana)
      .eq("dia_semana", diaSemana)
      .eq("refeicao", refeicao);
    return resultado(error, "Não foi possível limpar a refeição.");
  }
  const { error } = await supabase.from("planner_cardapio").upsert(
    {
      tenant_id: tenantId,
      semana,
      dia_semana: diaSemana,
      refeicao,
      descricao: descricao.valor,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "user_id,tenant_id,semana,dia_semana,refeicao" },
  );
  return resultado(error, "Não foi possível salvar a refeição.");
}

export async function criarPet(formData: FormData): Promise<ResultadoAcao> {
  const nome = textoObrigatorio(formData.get("nome"), 80, "Nome");
  if (!nome.ok) return falha(nome.erro);
  const tipo = textoOpcional(formData.get("tipo"), 60, "Tipo");
  if (!tipo.ok) return falha(tipo.erro);
  const notas = textoOpcional(formData.get("notas"), 2000, "Notas");
  if (!notas.ok) return falha(notas.erro);
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("planner_pets")
    .insert({ tenant_id: tenantId, nome: nome.valor, tipo: tipo.valor, notas: notas.valor });
  return resultado(error, "Não foi possível adicionar o pet.");
}

export async function excluirPet(petId: string): Promise<ResultadoAcao> {
  return excluirPorId("planner_pets", petId, "Não foi possível excluir o pet.", true);
}

export async function criarManutencao(formData: FormData): Promise<ResultadoAcao> {
  const nome = textoObrigatorio(formData.get("nome"), 120, "Manutenção");
  if (!nome.ok) return falha(nome.erro);
  const ultima = dataOpcional(formData.get("ultima_realizacao"), "Última realização");
  if (!ultima.ok) return falha(ultima.erro);
  const proxima = dataOpcional(formData.get("proxima_data"), "Próxima data");
  if (!proxima.ok) return falha(proxima.erro);
  let recorrencia: number | null = null;
  const recorrenciaBruta = formData.get("recorrencia_meses");
  if (recorrenciaBruta && String(recorrenciaBruta).trim()) {
    const r = inteiroEntre(recorrenciaBruta, 1, 120, "Recorrência (meses)");
    if (!r.ok) return falha(r.erro);
    recorrencia = r.valor;
  }
  const observacao = textoOpcional(formData.get("observacao"), 1000, "Observação");
  if (!observacao.ok) return falha(observacao.erro);

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_manutencoes").insert({
    tenant_id: tenantId,
    nome: nome.valor,
    ultima_realizacao: ultima.valor,
    proxima_data: proxima.valor,
    recorrencia_meses: recorrencia,
    observacao: observacao.valor,
  });
  return resultado(error, "Não foi possível criar a manutenção.", true);
}

/** "Feito hoje": a próxima data é recalculada pela recorrência. */
export async function marcarManutencaoFeita(manutencaoId: string): Promise<ResultadoAcao> {
  const id = lerId(manutencaoId);
  if (!id) return falha("Manutenção inválida.");
  const { tenantId, supabase } = await contexto();
  const { data: atual, error: erroLeitura } = await supabase
    .from("planner_manutencoes")
    .select("recorrencia_meses")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (erroLeitura || !atual) return falha("Manutenção não encontrada.");

  const { error } = await supabase
    .from("planner_manutencoes")
    .update({ ...concluirManutencao(atual, hojeISOBrasil()), atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível registrar a manutenção.", true);
}

export async function excluirManutencao(manutencaoId: string): Promise<ResultadoAcao> {
  return excluirPorId("planner_manutencoes", manutencaoId, "Não foi possível excluir a manutenção.", true);
}

// --------------------------------------------------------------------------
// Compromissos do Planner (consultas, pets, outros) — aparecem na Agenda.
// --------------------------------------------------------------------------

export async function criarCompromisso(formData: FormData): Promise<ResultadoAcao> {
  const titulo = textoObrigatorio(formData.get("titulo"), 200, "Título");
  if (!titulo.ok) return falha(titulo.erro);
  const area = formData.get("area");
  if (!ehAreaPlanner(area)) return falha("Área inválida.");
  const tipoBruto = String(formData.get("tipo") ?? "outro");
  const tipo = ["consulta", "pet", "outro"].includes(tipoBruto) ? tipoBruto : "outro";
  const data = formData.get("data");
  if (!ehChaveData(data)) return falha("Escolha a data.");
  const horaBruta = String(formData.get("hora") ?? "").trim() || "09:00";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horaBruta)) return falha("Horário inválido.");
  const local = textoOpcional(formData.get("local"), 200, "Local");
  if (!local.ok) return falha(local.erro);
  const notas = textoOpcional(formData.get("notas"), 1000, "Notas");
  if (!notas.ok) return falha(notas.erro);
  const petBruto = formData.get("pet_id");
  const petId = petBruto ? lerId(petBruto) : null;
  if (petBruto && !petId) return falha("Pet inválido.");

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_compromissos").insert({
    tenant_id: tenantId,
    titulo: titulo.valor,
    area,
    tipo,
    inicio: paraUtcDoFuso(`${data}T${horaBruta}`, FUSO_BRASIL).toISOString(),
    local: local.valor,
    notas: notas.valor,
    pet_id: petId,
  });
  return resultado(error, "Não foi possível criar o compromisso.", true);
}

export async function marcarCompromisso(compromissoId: string, concluido: boolean): Promise<ResultadoAcao> {
  const id = lerId(compromissoId);
  if (!id) return falha("Compromisso inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("planner_compromissos")
    .update({ concluido, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  return resultado(error, "Não foi possível atualizar o compromisso.", true);
}

export async function excluirCompromisso(compromissoId: string): Promise<ResultadoAcao> {
  return excluirPorId("planner_compromissos", compromissoId, "Não foi possível excluir o compromisso.", true);
}

// --------------------------------------------------------------------------

type TabelaComId =
  | "planner_objetivos"
  | "planner_notas"
  | "planner_leituras"
  | "planner_cursos"
  | "planner_compras"
  | "planner_pets"
  | "planner_manutencoes"
  | "planner_compromissos";

async function excluirPorId(tabela: TabelaComId, valorId: string, mensagem: string, tambemAgenda = false): Promise<ResultadoAcao> {
  const id = lerId(valorId);
  if (!id) return falha("Item inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from(tabela).delete().eq("id", id).eq("tenant_id", tenantId);
  return resultado(error, mensagem, tambemAgenda);
}
