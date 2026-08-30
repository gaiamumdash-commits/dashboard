import "server-only";
import { Resend } from "resend";

// Enquanto o domínio gaiamum.com.br não estiver verificado no Resend, o
// remetente de teste (onboarding@resend.dev) só entrega pro e-mail dono
// da conta Resend — troque RESEND_FROM_EMAIL assim que o domínio verificar.
const REMETENTE_PADRAO = process.env.RESEND_FROM_EMAIL || "Gaiamum <onboarding@resend.dev>";
const URL_SITE = "https://www.gaiamum.com.br";
const URL_LOGO = `${URL_SITE}/brand/crab-mark.png`;

function montarHtmlAtividade({
  atorEmail,
  acao,
  tituloTarefa,
  nomeProjeto,
  linkTarefa,
}: {
  atorEmail: string;
  acao: string;
  tituloTarefa: string;
  nomeProjeto: string;
  linkTarefa: string;
}): string {
  return `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#f5e9dc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5e9dc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background-color:#011f51;padding:20px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px;">
                      <img src="${URL_LOGO}" width="28" height="28" alt="" style="display:block;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="color:#f5e9dc;font-size:16px;font-weight:600;">Gaiamum</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">${nomeProjeto}</p>
                <h1 style="margin:0 0 16px;color:#011f51;font-size:19px;font-weight:600;">${tituloTarefa}</h1>
                <p style="margin:0 0 24px;color:#1f2937;font-size:15px;line-height:1.5;">
                  <strong>${atorEmail}</strong> ${acao}.
                </p>
                <a
                  href="${linkTarefa}"
                  style="display:inline-block;background-color:#0069fd;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;"
                >
                  Ver cartão no Gaiamum
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:#9ca3af;font-size:12px;">
                  Você recebeu este e-mail porque é responsável por este cartão no Gaiamum.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

export async function enviarEmailAtividade({
  destinatarios,
  atorEmail,
  acao,
  tituloTarefa,
  nomeProjeto,
  projetoId,
}: {
  destinatarios: string[];
  atorEmail: string;
  acao: string;
  tituloTarefa: string;
  nomeProjeto: string;
  projetoId: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || destinatarios.length === 0) return;

  const resend = new Resend(apiKey);
  const linkTarefa = `${URL_SITE}/projetos/${projetoId}/tarefas`;
  const html = montarHtmlAtividade({ atorEmail, acao, tituloTarefa, nomeProjeto, linkTarefa });

  await Promise.all(
    destinatarios.map((email) =>
      resend.emails
        .send({
          from: REMETENTE_PADRAO,
          to: email,
          subject: `"${tituloTarefa}" foi atualizado no Gaiamum`,
          html,
          text: `${atorEmail} ${acao} em "${tituloTarefa}" (${nomeProjeto}). Veja em: ${linkTarefa}`,
        })
        .then(({ error }) => {
          // O SDK do Resend não lança exceção pra erro de API (domínio não
          // verificado, destinatário fora do sandbox, etc.) — vem como
          // campo `error` na resposta normal, não como rejeição.
          if (error) {
            console.error(`Falha ao enviar e-mail de atividade pra ${email}:`, error);
          }
        })
        .catch((erro) => {
          console.error(`Falha ao enviar e-mail de atividade pra ${email}:`, erro);
        }),
    ),
  );
}
