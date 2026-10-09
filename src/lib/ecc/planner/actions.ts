"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { hojeISOBrasil } from "@/lib/ecc/kanban";
import {
  concluirManutencao,
  ehAreaPlanner,
  ehChaveData,
  ehRefeicao,
  inteiroEntre,
  segundaDaChave,
  textoObrigatorio,
  textoOpcional,
  validarHabito,
} from "@/lib/ecc/planner/regras";
import { lerCompra, lerCompromisso, lerCurso, lerLeitura, lerManutencao, lerObjetivo, lerPet } from "@/lib/ecc/planner/validacao";
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

/** Liga/desliga o "Resumo do dia" por e-mail (migration 0058). Cria a linha
 * de preferências se ainda não existir, sem mexer nas áreas escolhidas. */
export async function definirResumoDiario(ligado: boolean): Promise<ResultadoAcao> {
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase
    .from("planner_preferencias")
    .upsert({ tenant_id: tenantId, resumo_diario: ligado === true, atualizado_em: new Date().toISOString() }, { onConflict: "user_id,tenant_id" });
  return resultado(error, "Não foi possível salvar a preferência do e-mail.");
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
  const area = formData.get("area");
  if (!ehAreaPlanner(area)) return falha("Área inválida.");
  const objetivo = lerObjetivo(formData);
  if (!objetivo.ok) return falha(objetivo.erro);

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_objetivos").insert({ tenant_id: tenantId, area, ...objetivo.valor });
  return resultado(error, "Não foi possível criar o objetivo.");
}

export async function editarObjetivo(objetivoId: string, formData: FormData): Promise<ResultadoAcao> {
  const objetivo = lerObjetivo(formData);
  if (!objetivo.ok) return falha(objetivo.erro);
  return atualizarPorId("planner_objetivos", objetivoId, objetivo.valor, "Não foi possível salvar o objetivo.");
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
  const leitura = lerLeitura(formData);
  if (!leitura.ok) return falha(leitura.erro);
  const status = formData.get("status");
  if (!["quero_ler", "lendo", "concluido"].includes(String(status))) return falha("Status inválido.");

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_leituras").insert({
    tenant_id: tenantId,
    ...leitura.valor,
    status,
    progresso: status === "concluido" ? 100 : 0,
    data_inicio: status === "lendo" ? hojeISOBrasil() : null,
  });
  return resultado(error, "Não foi possível adicionar a leitura.");
}

/** Edita os dados da leitura (título, autor, data alvo, notas). Status e
 * progresso continuam no próprio cartão (`atualizarLeitura`). */
export async function editarLeitura(leituraId: string, formData: FormData): Promise<ResultadoAcao> {
  const leitura = lerLeitura(formData);
  if (!leitura.ok) return falha(leitura.erro);
  return atualizarPorId("planner_leituras", leituraId, leitura.valor, "Não foi possível salvar a leitura.");
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
  const curso = lerCurso(formData, tipo);
  if (!curso.ok) return falha(curso.erro);

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_cursos").insert({ tenant_id: tenantId, tipo, ...curso.valor });
  return resultado(error, tipo === "idioma" ? "Não foi possível adicionar o idioma." : "Não foi possível adicionar o curso.");
}

/** Edita os dados do curso/idioma; o tipo não muda (curso continua curso). */
export async function editarCurso(cursoId: string, formData: FormData): Promise<ResultadoAcao> {
  const tipo = formData.get("tipo") === "idioma" ? "idioma" : "curso";
  const curso = lerCurso(formData, tipo);
  if (!curso.ok) return falha(curso.erro);
  return atualizarPorId("planner_cursos", cursoId, curso.valor, "Não foi possível salvar.");
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
  const compra = lerCompra(formData);
  if (!compra.ok) return falha(compra.erro);
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_compras").insert({ tenant_id: tenantId, ...compra.valor });
  return resultado(error, "Não foi possível adicionar o item.");
}

/** Corrige nome, categoria e quantidade (tabela sem `atualizado_em`). */
export async function editarCompra(itemId: string, formData: FormData): Promise<ResultadoAcao> {
  const compra = lerCompra(formData);
  if (!compra.ok) return falha(compra.erro);
  return atualizarPorId("planner_compras", itemId, compra.valor, "Não foi possível salvar o item.", false, false);
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
  const pet = lerPet(formData);
  if (!pet.ok) return falha(pet.erro);
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_pets").insert({ tenant_id: tenantId, ...pet.valor });
  return resultado(error, "Não foi possível adicionar o pet.");
}

export async function editarPet(petId: string, formData: FormData): Promise<ResultadoAcao> {
  const pet = lerPet(formData);
  if (!pet.ok) return falha(pet.erro);
  return atualizarPorId("planner_pets", petId, pet.valor, "Não foi possível salvar o pet.", false, false);
}

export async function excluirPet(petId: string): Promise<ResultadoAcao> {
  return excluirPorId("planner_pets", petId, "Não foi possível excluir o pet.", true);
}

export async function criarManutencao(formData: FormData): Promise<ResultadoAcao> {
  const manutencao = lerManutencao(formData);
  if (!manutencao.ok) return falha(manutencao.erro);
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_manutencoes").insert({ tenant_id: tenantId, ...manutencao.valor });
  return resultado(error, "Não foi possível criar a manutenção.", true);
}

export async function editarManutencao(manutencaoId: string, formData: FormData): Promise<ResultadoAcao> {
  const manutencao = lerManutencao(formData);
  if (!manutencao.ok) return falha(manutencao.erro);
  return atualizarPorId("planner_manutencoes", manutencaoId, manutencao.valor, "Não foi possível salvar a manutenção.", true);
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
  const area = formData.get("area");
  if (!ehAreaPlanner(area)) return falha("Área inválida.");
  const tipoBruto = String(formData.get("tipo") ?? "outro");
  const tipo = ["consulta", "pet", "outro"].includes(tipoBruto) ? tipoBruto : "outro";
  const compromisso = lerCompromisso(formData);
  if (!compromisso.ok) return falha(compromisso.erro);

  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from("planner_compromissos").insert({ tenant_id: tenantId, area, tipo, ...compromisso.valor });
  return resultado(error, "Não foi possível criar o compromisso.", true);
}

/** Edita título, data/hora, local, notas e pet. Área e tipo ficam como
 * estão (uma consulta continua sendo consulta de Saúde). Pet de outra
 * pessoa é barrado pela RLS (`with check` da migration 0057). */
export async function editarCompromisso(compromissoId: string, formData: FormData): Promise<ResultadoAcao> {
  const compromisso = lerCompromisso(formData);
  if (!compromisso.ok) return falha(compromisso.erro);
  return atualizarPorId("planner_compromissos", compromissoId, compromisso.valor, "Não foi possível salvar o compromisso.", true);
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

/** Update genérico por id (só as linhas da própria pessoa passam pela RLS;
 * nenhuma linha alterada = item não existe ou não é seu). `comCarimbo`:
 * tabelas sem `atualizado_em` (pets) passam `false`. */
async function atualizarPorId(
  tabela: TabelaComId,
  valorId: string,
  campos: Record<string, unknown>,
  mensagem: string,
  tambemAgenda = false,
  comCarimbo = true,
): Promise<ResultadoAcao> {
  const id = lerId(valorId);
  if (!id) return falha("Item inválido.");
  const { tenantId, supabase } = await contexto();
  const { data, error } = await supabase
    .from(tabela)
    .update(comCarimbo ? { ...campos, atualizado_em: new Date().toISOString() } : campos)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id");
  if (!error && (data ?? []).length === 0) return falha("Item não encontrado. Recarregue a página.");
  return resultado(error, mensagem, tambemAgenda);
}

async function excluirPorId(tabela: TabelaComId, valorId: string, mensagem: string, tambemAgenda = false): Promise<ResultadoAcao> {
  const id = lerId(valorId);
  if (!id) return falha("Item inválido.");
  const { tenantId, supabase } = await contexto();
  const { error } = await supabase.from(tabela).delete().eq("id", id).eq("tenant_id", tenantId);
  return resultado(error, mensagem, tambemAgenda);
}
