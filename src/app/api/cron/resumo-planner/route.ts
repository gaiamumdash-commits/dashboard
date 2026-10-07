import { NextRequest, NextResponse } from "next/server";
import { autorizacaoCronValida } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { enviarEmailResumoPlanner } from "@/lib/ecc/notificacoes";
import { gerarIdCorrelacao, registrarErro, registrarInfo } from "@/lib/observabilidade";
import { FUSO_BRASIL, hojeISOBrasil } from "@/lib/ecc/kanban";
import { limitesDoDia } from "@/lib/ecc/semana";
import { primeiroNome } from "@/lib/ecc/painel-geral";
import { somarDiasChave } from "@/lib/ecc/planner/regras";
import { montarResumoDiario, resumoTemConteudo } from "@/lib/ecc/planner/resumo-diario";
import type { CompromissoPlanner, HabitoPlanner, ManutencaoPlanner, RegistroHabito } from "@/lib/ecc/planner/tipos";

/** Resumo do dia do Planner por e-mail (migration 0058) — 1x/dia, 7h de
 * Brasília (10:00 UTC no vercel.json). Service role de propósito (o cron
 * não tem sessão), então o isolamento é feito AQUI: cada e-mail é montado só
 * com as linhas do par (user_id, tenant_id) de quem recebe, e só pra quem
 * ainda é membro daquele workspace (mesma regra da RLS `planner_eh_meu`).
 *
 * Sem duplicar: antes de enviar, troca `planner_preferencias.resumo_enviado_em`
 * pra hoje num UPDATE condicional — uma 2ª execução no mesmo dia recebe 0
 * linhas e pula (mesmo padrão do reengajamento do Lab). Quem desligou
 * (`resumo_diario = false`) nunca é reivindicado. Dia vazio não gera e-mail. */
export async function GET(request: NextRequest) {
  if (!autorizacaoCronValida(request.headers.get("authorization"), process.env.CRON_SECRET ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const idExecucao = gerarIdCorrelacao();
  const service = createServiceClient();
  const hoje = hojeISOBrasil();
  const ontem = somarDiasChave(hoje, -1);
  const { inicio, fimExclusivo } = limitesDoDia(hoje);

  const [habitosR, registrosR, compromissosR, manutencoesR, preferenciasR, membershipsR] = await Promise.all([
    service.from("planner_habitos").select("id, user_id, tenant_id, nome, tipo, dias_semana, horario, ativo").eq("ativo", true),
    service.from("planner_habito_registros").select("habito_id, user_id, tenant_id").eq("data", ontem),
    service
      .from("planner_compromissos")
      .select("user_id, tenant_id, titulo, inicio, local")
      .eq("concluido", false)
      .gte("inicio", inicio.toISOString())
      .lt("inicio", fimExclusivo.toISOString()),
    service
      .from("planner_manutencoes")
      .select("user_id, tenant_id, nome, proxima_data")
      .eq("ativo", true)
      .lte("proxima_data", hoje),
    service.from("planner_preferencias").select("user_id, tenant_id, resumo_diario, resumo_enviado_em"),
    service.from("memberships").select("user_id, tenant_id"),
  ]);

  const erroLeitura = [habitosR, registrosR, compromissosR, manutencoesR, preferenciasR, membershipsR].find((r) => r.error)?.error;
  if (erroLeitura) {
    registrarErro({ operacao: "cron.resumo-planner", idCorrelacao: idExecucao, erro: erroLeitura.message });
    return NextResponse.json({ idExecucao, erro: "Falha ao ler o Planner." }, { status: 500 });
  }

  type ComDono = { user_id: string; tenant_id: string };
  const chave = (r: ComDono) => `${r.user_id}:${r.tenant_id}`;
  const membros = new Set(((membershipsR.data as ComDono[] | null) ?? []).map(chave));
  const preferencias = new Map(
    ((preferenciasR.data as (ComDono & { resumo_diario: boolean; resumo_enviado_em: string | null })[] | null) ?? []).map((p) => [chave(p), p]),
  );

  const habitos = (habitosR.data as (ComDono & HabitoPlanner)[] | null) ?? [];
  const registros = (registrosR.data as (ComDono & RegistroHabito)[] | null) ?? [];
  const compromissos = (compromissosR.data as (ComDono & CompromissoPlanner)[] | null) ?? [];
  const manutencoes = (manutencoesR.data as (ComDono & ManutencaoPlanner)[] | null) ?? [];

  // Só quem tem ALGUMA coisa no Planner pra hoje entra na lista.
  const candidatos = new Set([...habitos, ...compromissos, ...manutencoes].map(chave));

  const dataPorExtenso = (() => {
    const t = new Date().toLocaleDateString("pt-BR", { timeZone: FUSO_BRASIL, weekday: "long", day: "2-digit", month: "long" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();

  let enviados = 0;
  let semConteudo = 0;
  let desligados = 0;
  const falhas: string[] = [];

  for (const dono of candidatos) {
    if (!membros.has(dono)) continue;
    const preferencia = preferencias.get(dono);
    if (preferencia && !preferencia.resumo_diario) {
      desligados++;
      continue;
    }
    if (preferencia?.resumo_enviado_em === hoje) continue;

    const deste = <T extends ComDono>(linhas: T[]) => linhas.filter((l) => chave(l) === dono);
    const resumo = montarResumoDiario({
      hoje,
      habitos: deste(habitos),
      registrosDeOntem: deste(registros),
      compromissos: deste(compromissos),
      manutencoes: deste(manutencoes),
    });
    if (!resumoTemConteudo(resumo)) {
      semConteudo++;
      continue;
    }

    const [userId, tenantId] = dono.split(":");

    // Claim: garante a linha de preferência e reivindica o envio de hoje.
    if (!preferencia) {
      await service
        .from("planner_preferencias")
        .upsert({ user_id: userId, tenant_id: tenantId }, { onConflict: "user_id,tenant_id", ignoreDuplicates: true });
    }
    const { data: reivindicado, error: erroClaim } = await service
      .from("planner_preferencias")
      .update({ resumo_enviado_em: hoje })
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("resumo_diario", true)
      .or(`resumo_enviado_em.is.null,resumo_enviado_em.lt.${hoje}`)
      .select("user_id");
    if (erroClaim) {
      falhas.push(`${dono}: ${erroClaim.message}`);
      continue;
    }
    if (!reivindicado || reivindicado.length === 0) continue;

    const { data: usuario, error: erroUsuario } = await service.auth.admin.getUserById(userId);
    const email = usuario?.user?.email;
    if (erroUsuario || !email) {
      falhas.push(`${dono}: sem e-mail`);
      continue;
    }

    const ok = await enviarEmailResumoPlanner({ destinatario: email, nome: primeiroNome(email), resumo, dataPorExtenso });
    if (ok) {
      enviados++;
    } else {
      // Libera o dia de novo pra uma próxima execução tentar outra vez.
      await service.from("planner_preferencias").update({ resumo_enviado_em: null }).eq("user_id", userId).eq("tenant_id", tenantId);
      falhas.push(`${dono}: falha no envio`);
    }
  }

  const contexto = { idExecucao, candidatos: candidatos.size, enviados, semConteudo, desligados, totalFalhas: falhas.length };
  if (falhas.length > 0) {
    registrarErro({ operacao: "cron.resumo-planner", idCorrelacao: idExecucao, contexto, erro: falhas.join(" | ") });
  } else {
    registrarInfo({ operacao: "cron.resumo-planner", contexto });
  }

  return NextResponse.json({ ...contexto, falhas });
}
