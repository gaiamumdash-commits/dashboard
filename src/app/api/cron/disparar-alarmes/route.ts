import { NextRequest, NextResponse } from "next/server";
import { autorizacaoCronValida } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { paraUtcDoFuso } from "@/lib/ecc/kanban";
import { enviarEmailAlarme } from "@/lib/ecc/notificacoes";
import type { Alarme } from "@/lib/ecc/tipos";

type Disparo = {
  alarmeId: string;
  tenantId: string;
  referenciaIso: string;
  titulo: string;
  corpo: string;
  link: string;
  destinatariosUserIds: string[];
};

function estaNaHora(referencia: Date, antecedenciaMin: number, agora: Date): boolean {
  const disparaEm = new Date(referencia.getTime() - antecedenciaMin * 60_000);
  return disparaEm <= agora;
}

/** Roda de hora em hora (vercel.json) + reforço via `pg_cron` a cada 15min
 * (Vercel Hobby limita o cron nativo a ~1x/dia, insuficiente pra "3h antes"
 * — ver `supabase/migrations/0019_alarmes.sql`). Verifica os 3 tipos de
 * entidade que podem ter alarme (não há FK — é polimórfico — então cada
 * tipo é uma consulta separada) e usa `reivindicar_alarme` (RPC com UPDATE
 * atômico) pra evitar notificar duas vezes se as duas fontes de agendamento
 * rodarem perto uma da outra. */
export async function GET(request: NextRequest) {
  if (!autorizacaoCronValida(request.headers.get("authorization"), process.env.CRON_SECRET ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const agora = new Date();
  const disparos: Disparo[] = [];

  const { data: alarmesContas } = await supabase.from("alarmes").select("*").eq("entidade_tipo", "conta_a_pagar");
  if (alarmesContas && alarmesContas.length > 0) {
    const { data: contas } = await supabase
      .from("contas_a_pagar")
      .select("id, nome, valor, data_vencimento, pago")
      .in(
        "id",
        alarmesContas.map((a) => a.entidade_id),
      );
    const mapaContas = new Map((contas ?? []).map((c) => [c.id, c]));

    for (const alarme of alarmesContas as Alarme[]) {
      const conta = mapaContas.get(alarme.entidade_id);
      if (!conta || conta.pago) continue;

      // Vencimento é `date` (sem hora) — trata como meia-noite no fuso do
      // Brasil, mesma convenção que a Agenda já usa pra exibir "Dia inteiro".
      const referencia = paraUtcDoFuso(`${conta.data_vencimento}T00:00`, "America/Sao_Paulo");
      if (!estaNaHora(referencia, alarme.antecedencia_min, agora)) continue;

      disparos.push({
        alarmeId: alarme.id,
        tenantId: alarme.tenant_id,
        referenciaIso: referencia.toISOString(),
        titulo: conta.nome,
        corpo: `Vence em ${new Date(`${conta.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")} — ${conta.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        link: "/financeiro",
        destinatariosUserIds: [alarme.criado_por],
      });
    }
  }

  const { data: alarmesTarefas } = await supabase.from("alarmes").select("*").eq("entidade_tipo", "tarefa");
  if (alarmesTarefas && alarmesTarefas.length > 0) {
    const { data: tarefas } = await supabase
      .from("tarefas")
      .select("id, titulo, data_limite, coluna_id, projeto_id")
      .in(
        "id",
        alarmesTarefas.map((a) => a.entidade_id),
      );
    const mapaTarefas = new Map((tarefas ?? []).map((t) => [t.id, t]));

    const idsColuna = [...new Set((tarefas ?? []).map((t) => t.coluna_id))];
    const { data: colunas } =
      idsColuna.length > 0
        ? await supabase.from("colunas_kanban").select("id, concluido").in("id", idsColuna)
        : { data: [] as { id: string; concluido: boolean }[] };
    const mapaConcluida = new Map((colunas ?? []).map((c) => [c.id, c.concluido]));

    for (const alarme of alarmesTarefas as Alarme[]) {
      const tarefa = mapaTarefas.get(alarme.entidade_id);
      if (!tarefa || !tarefa.data_limite || mapaConcluida.get(tarefa.coluna_id)) continue;

      const referencia = new Date(tarefa.data_limite);
      if (!estaNaHora(referencia, alarme.antecedencia_min, agora)) continue;

      const { data: membros } = await supabase.from("tarefa_membros").select("user_id").eq("tarefa_id", tarefa.id);
      const destinatarios = (membros ?? []).map((m) => m.user_id);
      if (destinatarios.length === 0) destinatarios.push(alarme.criado_por);

      disparos.push({
        alarmeId: alarme.id,
        tenantId: alarme.tenant_id,
        referenciaIso: referencia.toISOString(),
        titulo: tarefa.titulo,
        corpo: `Prazo: ${referencia.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}.`,
        link: `/projetos/${tarefa.projeto_id}/tarefas`,
        destinatariosUserIds: destinatarios,
      });
    }
  }

  const { data: alarmesEventos } = await supabase.from("alarmes").select("*").eq("entidade_tipo", "evento_agenda");
  if (alarmesEventos && alarmesEventos.length > 0) {
    const { data: eventos } = await supabase
      .from("eventos_agenda")
      .select("id, titulo, inicio")
      .in(
        "id",
        alarmesEventos.map((a) => a.entidade_id),
      );
    const mapaEventos = new Map((eventos ?? []).map((e) => [e.id, e]));

    for (const alarme of alarmesEventos as Alarme[]) {
      const evento = mapaEventos.get(alarme.entidade_id);
      if (!evento) continue;

      const referencia = new Date(evento.inicio);
      if (!estaNaHora(referencia, alarme.antecedencia_min, agora)) continue;

      disparos.push({
        alarmeId: alarme.id,
        tenantId: alarme.tenant_id,
        referenciaIso: referencia.toISOString(),
        titulo: evento.titulo,
        corpo: `Às ${referencia.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}.`,
        link: "/agenda",
        destinatariosUserIds: [alarme.criado_por],
      });
    }
  }

  let disparados = 0;
  const falhas: string[] = [];

  for (const disparo of disparos) {
    const { data: claimado, error: erroClaim } = await supabase.rpc("reivindicar_alarme", {
      p_alarme_id: disparo.alarmeId,
      p_referencia: disparo.referenciaIso,
    });

    if (erroClaim) {
      falhas.push(`${disparo.alarmeId}: ${erroClaim.message}`);
      continue;
    }
    if (!claimado) continue;

    disparados++;

    await Promise.all(
      disparo.destinatariosUserIds.map(async (userId) => {
        const { error: erroNotificacao } = await supabase.from("notificacoes_app").insert({
          tenant_id: disparo.tenantId,
          user_id: userId,
          titulo: disparo.titulo,
          corpo: disparo.corpo,
          link: disparo.link,
        });
        if (erroNotificacao) {
          falhas.push(`notificacao ${disparo.alarmeId}/${userId}: ${erroNotificacao.message}`);
        }

        const { data: usuario } = await supabase.auth.admin.getUserById(userId);
        if (usuario?.user?.email) {
          await enviarEmailAlarme({
            destinatario: usuario.user.email,
            titulo: disparo.titulo,
            corpo: disparo.corpo,
            link: disparo.link,
          });
        }
      }),
    );
  }

  return NextResponse.json({ verificados: disparos.length, disparados, falhas });
}
