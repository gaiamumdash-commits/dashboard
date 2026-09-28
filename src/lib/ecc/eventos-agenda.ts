"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { paraUtcDoFuso } from "@/lib/ecc/kanban";
import { salvarAlarme } from "@/lib/ecc/alarmes";
import {
  espelharCompromissoNoGoogle,
  removerEspelhoDoGoogle,
  type ResultadoSincronizacao,
} from "@/lib/ecc/google-calendar-interno";

/** Cria um compromisso manual (botão flutuante da Agenda) ou vindo de voz
 * (mesmo Server Action — só muda `origem`/`transcricao_bruta`, preenchidos
 * pelo formulário antes do submit). Segue o mesmo padrão de fuso horário já
 * validado em `criarEventoGoogleCalendar`: nunca resolver no servidor,
 * sempre repassar o valor cru + fuso do navegador (campo hidden `fuso`).
 * Com o Google conectado, também cria a cópia no Google Calendar. */
export async function criarEventoAgendaManual(formData: FormData): Promise<ResultadoSincronizacao> {
  const tenantId = await garantirWorkspace();
  const user = await obterUsuarioAtual();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const inicio = String(formData.get("inicio") ?? "");
  const fim = String(formData.get("fim") ?? "");
  const fuso = String(formData.get("fuso") ?? "America/Sao_Paulo");
  const origem = formData.get("origem") === "voz" ? "voz" : "manual";
  const transcricaoBruta = formData.get("transcricao_bruta")
    ? String(formData.get("transcricao_bruta"))
    : null;
  const antecedenciaMin = Number(formData.get("antecedencia_min") ?? 0);

  if (!titulo || !inicio) {
    throw new Error("Preencha título e data/hora do compromisso.");
  }

  const inicioUtc = paraUtcDoFuso(inicio, fuso);
  const fimUtc = fim ? paraUtcDoFuso(fim, fuso) : null;
  if (fimUtc && fimUtc <= inicioUtc) {
    throw new Error("O fim precisa ser depois do início.");
  }

  const supabase = await createClient();
  const { data: evento, error } = await supabase
    .from("eventos_agenda")
    .insert({
      tenant_id: tenantId,
      titulo,
      inicio: inicioUtc.toISOString(),
      fim: fimUtc ? fimUtc.toISOString() : null,
      origem,
      transcricao_bruta: transcricaoBruta,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Falha ao criar compromisso: ${error.message}`);
  }

  // O alarme é opcional e vem no mesmo formulário — como o evento acabou de
  // ser criado, o `entidade_id` só existe agora, então não dá pra usar o
  // fluxo genérico de `salvarAlarme` (pensado pra editar item já existente).
  if (antecedenciaMin > 0) {
    const { error: erroAlarme } = await supabase.from("alarmes").insert({
      tenant_id: tenantId,
      entidade_tipo: "evento_agenda",
      entidade_id: evento.id,
      antecedencia_min: antecedenciaMin,
      criado_por: user.id,
    });
    if (erroAlarme) {
      throw new Error(`Compromisso criado, mas falha ao salvar o alarme: ${erroAlarme.message}`);
    }
  }

  const sincronizacao = await espelharCompromissoNoGoogle({
    compromissoId: evento.id,
    titulo,
    inicio: inicioUtc,
    fim: fimUtc,
    antecedenciaMin: antecedenciaMin > 0 ? antecedenciaMin : null,
  });

  revalidatePath("/agenda");
  return sincronizacao;
}

/** Edita título/data/hora (e, opcionalmente, o alarme) de um compromisso do
 * Gaiamum e atualiza a cópia no Google Calendar. Devolve o resultado em vez
 * de lançar erro: em produção o Next.js redige a mensagem de qualquer
 * `throw` de Server Action, e a pessoa ficaria sem saber o que corrigir. */
export async function editarEventoAgenda(
  formData: FormData,
): Promise<ResultadoSincronizacao | { status: "invalido"; aviso: string }> {
  const tenantId = await garantirWorkspace();

  const eventoId = String(formData.get("evento_id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const inicio = String(formData.get("inicio") ?? "");
  const fim = String(formData.get("fim") ?? "");
  const fuso = String(formData.get("fuso") ?? "America/Sao_Paulo");
  const antecedenciaMin = Number(formData.get("antecedencia_min") ?? 0);
  const antecedenciaAnterior = Number(formData.get("antecedencia_anterior") ?? 0);

  if (!eventoId || !titulo || !inicio) {
    return { status: "invalido", aviso: "Preencha título e data/hora do compromisso." };
  }

  const inicioUtc = paraUtcDoFuso(inicio, fuso);
  const fimUtc = fim ? paraUtcDoFuso(fim, fuso) : null;
  if (fimUtc && fimUtc <= inicioUtc) {
    return { status: "invalido", aviso: "O fim precisa ser depois do início." };
  }

  const supabase = await createClient();
  const { data: atualizado, error } = await supabase
    .from("eventos_agenda")
    .update({
      titulo,
      inicio: inicioUtc.toISOString(),
      fim: fimUtc ? fimUtc.toISOString() : null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", eventoId)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error || !atualizado) {
    return { status: "invalido", aviso: "Não consegui salvar a alteração — recarregue a página e tente de novo." };
  }

  // Mudar o horário já rearma o alarme sozinho (o cron controla o disparo
  // pelo instante de referência, que muda junto com o início). Só regrava o
  // alarme quando a antecedência escolhida mudou — regravar sempre zeraria
  // o "já disparou" e repetiria o aviso de um compromisso que já passou.
  if (antecedenciaMin !== antecedenciaAnterior) {
    const dadosAlarme = new FormData();
    dadosAlarme.set("entidade_tipo", "evento_agenda");
    dadosAlarme.set("entidade_id", eventoId);
    dadosAlarme.set("antecedencia_min", String(antecedenciaMin));
    dadosAlarme.set("caminho_revalidar", "/agenda");
    await salvarAlarme(dadosAlarme);
  }

  const sincronizacao = await espelharCompromissoNoGoogle({
    compromissoId: eventoId,
    titulo,
    inicio: inicioUtc,
    fim: fimUtc,
    antecedenciaMin: antecedenciaMin > 0 ? antecedenciaMin : null,
  });

  revalidatePath("/agenda");
  return sincronizacao;
}

export async function excluirEventoAgenda(eventoId: string): Promise<ResultadoSincronizacao> {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("eventos_agenda")
    .delete()
    .eq("id", eventoId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(`Falha ao excluir compromisso: ${error.message}`);
  }

  // `alarmes` é polimórfico, sem FK — sem isso, o alarme do compromisso
  // excluído ficaria órfão pra sempre (inofensivo, o cron já ignora alarme
  // sem entidade correspondente, mas é lixo acumulando à toa).
  await supabase.from("alarmes").delete().eq("entidade_tipo", "evento_agenda").eq("entidade_id", eventoId);

  const sincronizacao = await removerEspelhoDoGoogle(eventoId);

  revalidatePath("/agenda");
  return sincronizacao;
}
