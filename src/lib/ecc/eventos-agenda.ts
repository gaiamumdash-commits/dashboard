"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { paraUtcDoFuso } from "@/lib/ecc/kanban";

/** Cria um compromisso manual (botão flutuante da Agenda) ou vindo de voz
 * (mesmo Server Action — só muda `origem`/`transcricao_bruta`, preenchidos
 * pelo formulário antes do submit). Segue o mesmo padrão de fuso horário já
 * validado em `criarEventoGoogleCalendar`: nunca resolver no servidor,
 * sempre repassar o valor cru + fuso do navegador (campo hidden `fuso`). */
export async function criarEventoAgendaManual(formData: FormData) {
  const tenantId = await garantirWorkspace();
  const user = await obterUsuarioAtual();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const inicio = String(formData.get("inicio") ?? "");
  const fuso = String(formData.get("fuso") ?? "America/Sao_Paulo");
  const origem = formData.get("origem") === "voz" ? "voz" : "manual";
  const transcricaoBruta = formData.get("transcricao_bruta")
    ? String(formData.get("transcricao_bruta"))
    : null;
  const antecedenciaMin = Number(formData.get("antecedencia_min") ?? 0);

  if (!titulo || !inicio) {
    throw new Error("Preencha título e data/hora do compromisso.");
  }

  const supabase = await createClient();
  const { data: evento, error } = await supabase
    .from("eventos_agenda")
    .insert({
      tenant_id: tenantId,
      titulo,
      inicio: paraUtcDoFuso(inicio, fuso).toISOString(),
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

  revalidatePath("/agenda");
}

export async function excluirEventoAgenda(eventoId: string) {
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

  revalidatePath("/agenda");
}
