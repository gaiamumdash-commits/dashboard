import { FUSO_BRASIL, paraUtcDoFuso } from "@/lib/ecc/kanban";
import { dataOpcional, ehChaveData, inteiroEntre, textoObrigatorio, textoOpcional, type Validado } from "@/lib/ecc/planner/regras";

// Leitura + validação dos formulários do Planner — a MESMA função serve pra
// criar e pra editar (as duas nunca divergem). Pura, testada em
// `__tests__/planner-validacao.test.ts`. Os limites espelham os CHECK da
// migration 0057; aqui é só pra devolver a mensagem em português antes.

/** O mínimo de FormData que estas funções usam (facilita o teste). */
export type CamposFormulario = { get(nome: string): unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

/** Primeiro erro vence; senão devolve o objeto montado. */
function juntar<T extends Record<string, unknown>>(campos: { [K in keyof T]: Validado<T[K]> }): Validado<T> {
  const valor = {} as T;
  for (const chave of Object.keys(campos) as (keyof T)[]) {
    const campo = campos[chave];
    if (!campo.ok) return campo;
    valor[chave] = campo.valor;
  }
  return { ok: true, valor };
}

export function lerObjetivo(f: CamposFormulario) {
  return juntar<{ titulo: string; prazo: string | null; notas: string | null }>({
    titulo: textoObrigatorio(f.get("titulo"), 200, "Objetivo"),
    prazo: dataOpcional(f.get("prazo"), "Data"),
    notas: textoOpcional(f.get("notas"), 2000, "Notas"),
  });
}

export function lerLeitura(f: CamposFormulario) {
  return juntar<{ titulo: string; autor: string | null; data_alvo: string | null; notas: string | null }>({
    titulo: textoObrigatorio(f.get("titulo"), 200, "Título"),
    autor: textoOpcional(f.get("autor"), 120, "Autor"),
    data_alvo: dataOpcional(f.get("data_alvo"), "Data alvo"),
    notas: textoOpcional(f.get("notas"), 2000, "Notas"),
  });
}

function linkOpcional(valor: unknown): Validado<string | null> {
  const texto = textoOpcional(valor, 500, "Link");
  if (!texto.ok || !texto.valor) return texto;
  return /^https?:\/\//i.test(texto.valor) ? texto : { ok: false, erro: "O link precisa começar com http:// ou https://." };
}

export function lerCurso(f: CamposFormulario, tipo: "curso" | "idioma") {
  return juntar<{
    nome: string;
    instituicao: string | null;
    objetivo: string | null;
    frequencia: string | null;
    data_alvo: string | null;
    link: string | null;
    notas: string | null;
  }>({
    nome: textoObrigatorio(f.get("nome"), 200, tipo === "idioma" ? "Idioma" : "Nome do curso"),
    instituicao: textoOpcional(f.get("instituicao"), 120, "Instituição"),
    objetivo: textoOpcional(f.get("objetivo"), 300, "Objetivo"),
    frequencia: textoOpcional(f.get("frequencia"), 120, "Frequência"),
    data_alvo: dataOpcional(f.get("data_alvo"), "Data alvo"),
    link: linkOpcional(f.get("link")),
    notas: textoOpcional(f.get("notas"), 2000, "Notas"),
  });
}

function recorrenciaOpcional(valor: unknown): Validado<number | null> {
  if (valor === null || valor === undefined || String(valor).trim() === "") return { ok: true, valor: null };
  return inteiroEntre(valor, 1, 120, "Recorrência (meses)");
}

export function lerManutencao(f: CamposFormulario) {
  return juntar<{
    nome: string;
    ultima_realizacao: string | null;
    proxima_data: string | null;
    recorrencia_meses: number | null;
    observacao: string | null;
  }>({
    nome: textoObrigatorio(f.get("nome"), 120, "Manutenção"),
    ultima_realizacao: dataOpcional(f.get("ultima_realizacao"), "Última realização"),
    proxima_data: dataOpcional(f.get("proxima_data"), "Próxima data"),
    recorrencia_meses: recorrenciaOpcional(f.get("recorrencia_meses")),
    observacao: textoOpcional(f.get("observacao"), 1000, "Observação"),
  });
}

export function lerPet(f: CamposFormulario) {
  return juntar<{ nome: string; tipo: string | null; notas: string | null }>({
    nome: textoObrigatorio(f.get("nome"), 80, "Nome"),
    tipo: textoOpcional(f.get("tipo"), 60, "Tipo"),
    notas: textoOpcional(f.get("notas"), 2000, "Notas"),
  });
}

function inicioCompromisso(data: unknown, hora: unknown): Validado<string> {
  if (!ehChaveData(data)) return { ok: false, erro: "Escolha a data." };
  const horario = String(hora ?? "").trim() || "09:00";
  if (!HORA.test(horario)) return { ok: false, erro: "Horário inválido." };
  return { ok: true, valor: paraUtcDoFuso(`${data}T${horario}`, FUSO_BRASIL).toISOString() };
}

function petOpcional(valor: unknown): Validado<string | null> {
  if (valor === null || valor === undefined || valor === "") return { ok: true, valor: null };
  return ehUuid(valor) ? { ok: true, valor } : { ok: false, erro: "Pet inválido." };
}

/** Data + hora são digitadas no fuso Brasil e gravadas como instante UTC. */
export function lerCompromisso(f: CamposFormulario) {
  return juntar<{ titulo: string; inicio: string; local: string | null; notas: string | null; pet_id: string | null }>({
    titulo: textoObrigatorio(f.get("titulo"), 200, "Título"),
    inicio: inicioCompromisso(f.get("data"), f.get("hora")),
    local: textoOpcional(f.get("local"), 200, "Local"),
    notas: textoOpcional(f.get("notas"), 1000, "Notas"),
    pet_id: petOpcional(f.get("pet_id")),
  });
}

/** Instante ISO → { data "AAAA-MM-DD", hora "HH:MM" } no fuso Brasil — pra
 * preencher o formulário de edição de um compromisso. */
export function dataEHoraParaFormulario(iso: string): { data: string; hora: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BRASIL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const v = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return { data: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}
