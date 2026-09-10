import { NextRequest, NextResponse } from "next/server";
import { autorizacaoCronValida } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { listarUsuariosEmRiscoDeEvasao } from "@/lib/ecc/lab/analitica";
import { enviarEmailReengajamentoLab } from "@/lib/ecc/notificacoes";

/** Roda 1x/dia (vercel.json) — reengajamento não-punitivo do Gaiamum Lab:
 * usuários há 48h+ sem atividade e ainda sem a patente Explorador recebem
 * um e-mail único (nunca repetido, progresso nunca é apagado). Claim
 * atômico via UPDATE condicional em `lab_tenants.reengajamento_enviado_em`
 * (o Postgres reavalia o WHERE depois do lock — uma 2ª execução concorrente
 * sempre recebe 0 linhas afetadas), mesmo espírito do `reivindicar_alarme`
 * usado em disparar-alarmes, sem precisar de função SQL dedicada (volume
 * esperado baixo, sem concorrência real aqui). */
export async function GET(request: NextRequest) {
  if (!autorizacaoCronValida(request.headers.get("authorization"), process.env.CRON_SECRET ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const service = createServiceClient();
  const candidatos = (await listarUsuariosEmRiscoDeEvasao()).filter((u) => !u.reengajamentoJaEnviado);

  let enviados = 0;
  const falhas: string[] = [];

  for (const usuario of candidatos) {
    if (!usuario.email) continue;

    const { data: claimado, error: erroClaim } = await service
      .from("lab_tenants")
      .update({ reengajamento_enviado_em: new Date().toISOString() })
      .eq("user_id", usuario.userId)
      .is("reengajamento_enviado_em", null)
      .select("user_id");

    if (erroClaim) {
      falhas.push(`${usuario.userId}: ${erroClaim.message}`);
      continue;
    }
    if (!claimado || claimado.length === 0) continue;

    const nome = usuario.email.split("@")[0];
    await enviarEmailReengajamentoLab({ destinatario: usuario.email, nome });

    const { error: erroNotificacao } = await service.from("notificacoes_app").insert({
      tenant_id: usuario.tenantId,
      user_id: usuario.userId,
      titulo: "O Café do Mangue tá te esperando",
      corpo: "Seu progresso continua guardado — volte quando quiser.",
      link: "/lab",
      tipo: "lab_reengajamento",
    });
    if (erroNotificacao) {
      falhas.push(`notificacao ${usuario.userId}: ${erroNotificacao.message}`);
    }

    enviados++;
  }

  return NextResponse.json({ verificados: candidatos.length, enviados, falhas });
}
