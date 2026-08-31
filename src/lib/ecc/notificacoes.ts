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

export type ItemConsolidacao = {
  titulo: string;
  status: "concluido" | "atrasado" | "aberto";
  diasEmAberto: number;
  prazoFormatado: string | null;
  diasParaPrazo: number | null;
};

export type SecaoConsolidacao = {
  nomeResponsavel: string;
  itens: ItemConsolidacao[];
};

const COR_STATUS: Record<ItemConsolidacao["status"], { fundo: string; texto: string; rotulo: string }> = {
  concluido: { fundo: "#dcfce7", texto: "#166534", rotulo: "Concluído" },
  atrasado: { fundo: "#fee2e2", texto: "#991b1b", rotulo: "Atrasado" },
  aberto: { fundo: "#fef9c3", texto: "#854d0e", rotulo: "Em aberto" },
};

function linhaPrazo(item: ItemConsolidacao): string {
  if (item.status === "concluido") return "";
  if (!item.prazoFormatado || item.diasParaPrazo === null) return "sem prazo definido";
  if (item.diasParaPrazo < 0) return `venceu em ${item.prazoFormatado} — ${Math.abs(item.diasParaPrazo)} dia(s) em atraso`;
  if (item.diasParaPrazo === 0) return `vence hoje (${item.prazoFormatado})`;
  return `prazo ${item.prazoFormatado} — faltam ${item.diasParaPrazo} dia(s)`;
}

function montarHtmlConsolidacao({
  nomeProjeto,
  secoes,
  linkProjeto,
  dataFreeze,
}: {
  nomeProjeto: string;
  secoes: SecaoConsolidacao[];
  linkProjeto: string;
  dataFreeze: string;
}): string {
  const blocosSecao = secoes
    .map((secao) => {
      const linhasItens = secao.itens
        .map((item) => {
          const cor = COR_STATUS[item.status];
          return `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                <span style="display:inline-block;background-color:${cor.fundo};color:${cor.texto};font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;margin-right:8px;">
                  ${cor.rotulo}
                </span>
                <span style="color:#002559;font-size:14px;font-weight:600;">${item.titulo}</span>
                <div style="margin-top:2px;color:#5b6b85;font-size:12px;">
                  aberto há ${item.diasEmAberto} dia(s)${item.status !== "concluido" ? ` · ${linhaPrazo(item)}` : ""}
                </div>
              </td>
            </tr>`;
        })
        .join("");

      return `
        <tr>
          <td style="padding:20px 0 8px;">
            <h2 style="margin:0;color:#011f51;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;">
              ${secao.nomeResponsavel}
            </h2>
          </td>
        </tr>
        <tr>
          <td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${linhasItens}
            </table>
          </td>
        </tr>`;
    })
    .join("");

  return `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:24px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;">
            <tr>
              <td style="border-bottom:2px solid #011f51;padding-bottom:16px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px;">
                      <img src="${URL_LOGO}" width="32" height="32" alt="" style="display:block;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="color:#011f51;font-size:18px;font-weight:700;">Gaiamum</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 0 4px;">
                <p style="margin:0;color:#5b6b85;font-size:12px;">Ponto de situação · ${dataFreeze}</p>
                <h1 style="margin:4px 0 0;color:#011f51;font-size:22px;font-weight:700;">${nomeProjeto}</h1>
              </td>
            </tr>
            ${blocosSecao}
            <tr>
              <td style="padding:24px 0 8px;border-top:1px solid #e5e7eb;">
                <a
                  href="${linkProjeto}"
                  style="display:inline-block;background-color:#0069fd;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;"
                >
                  Ver quadro no Gaiamum
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

export async function enviarEmailConsolidacao({
  destinatarios,
  nomeProjeto,
  secoes,
  projetoId,
}: {
  destinatarios: string[];
  nomeProjeto: string;
  secoes: SecaoConsolidacao[];
  projetoId: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || destinatarios.length === 0) return;

  const resend = new Resend(apiKey);
  const linkProjeto = `${URL_SITE}/projetos/${projetoId}/tarefas`;
  const dataFreeze = new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
  const html = montarHtmlConsolidacao({ nomeProjeto, secoes, linkProjeto, dataFreeze });

  await Promise.all(
    destinatarios.map((email) =>
      resend.emails
        .send({
          from: REMETENTE_PADRAO,
          to: email,
          subject: `Ponto de situação — ${nomeProjeto}`,
          html,
          text: `Ponto de situação de "${nomeProjeto}" em ${dataFreeze}. Veja em: ${linkProjeto}`,
        })
        .then(({ error }) => {
          if (error) {
            console.error(`Falha ao enviar consolidação pra ${email}:`, error);
          }
        })
        .catch((erro) => {
          console.error(`Falha ao enviar consolidação pra ${email}:`, erro);
        }),
    ),
  );
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
