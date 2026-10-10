import { filhosPorPai } from "@/lib/ecc/mapas/arvore";
import { detectarData, rotuloData } from "@/lib/ecc/mapas/datas";
import { palavrasChave, tagsDoMapa } from "@/lib/ecc/mapas/palavras";
import type { NoMapa } from "@/lib/ecc/mapas/tipos";

// Conteúdo do "Resumo por e-mail" do mapa — puro (sem envio), testado em
// `__tests__/mapas-resumo-email.test.ts`. Todo texto vem da pessoa, então
// TUDO passa por `escapar` no HTML. O envio (Resend) fica em `actions.ts`.

export type ResumoMapa = { assunto: string; texto: string; html: string };

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

type NoResumo = Pick<NoMapa, "id" | "pai_id" | "ordem" | "texto" | "nota">;

/** Ramos em ordem de leitura (pai antes dos filhos), com o nível. Inclui
 * os recolhidos: o e-mail é o mapa inteiro. */
function emOrdem(nos: NoResumo[]): { no: NoResumo; nivel: number }[] {
  const filhos = filhosPorPai(nos);
  const raiz = nos.find((n) => n.pai_id === null);
  if (!raiz) return [];
  const saida: { no: NoResumo; nivel: number }[] = [];
  const pilha: { no: NoResumo; nivel: number }[] = [{ no: raiz, nivel: 0 }];
  while (pilha.length > 0) {
    const atual = pilha.pop()!;
    saida.push(atual);
    const meus = filhos.get(atual.no.id) ?? [];
    for (let i = meus.length - 1; i >= 0; i--) pilha.push({ no: meus[i], nivel: atual.nivel + 1 });
  }
  return saida;
}

export function montarResumoMapa({ titulo, nos, hoje, link }: { titulo: string; nos: NoResumo[]; hoje: string; link: string }): ResumoMapa {
  const ordem = emOrdem(nos);
  const textos = nos.map((n) => n.texto);
  const datas = ordem
    .slice(1)
    .map(({ no }) => ({ no, d: detectarData(no.texto, hoje) }))
    .filter((x): x is { no: NoResumo; d: NonNullable<ReturnType<typeof detectarData>> } => x.d !== null)
    .sort((a, b) => (a.d.data + (a.d.hora ?? "")).localeCompare(b.d.data + (b.d.hora ?? "")));
  const palavras = palavrasChave(textos, 8);
  const tags = tagsDoMapa(textos, 10);

  // ---- texto puro ----
  const linhas: string[] = [titulo, ""];
  for (const { no, nivel } of ordem.slice(1)) {
    linhas.push(`${"  ".repeat(nivel - 1)}- ${no.texto}`);
    // Nota alinhada ao texto do ramo (depois do "- ").
    if (no.nota) linhas.push(`${"  ".repeat(nivel - 1)}  (${no.nota.replace(/\s+/g, " ")})`);
  }
  if (datas.length > 0) {
    linhas.push("", "Datas do mapa:");
    for (const { no, d } of datas) linhas.push(`- ${rotuloData(d, hoje)}: ${no.texto}`);
  }
  if (palavras.length > 0 || tags.length > 0) {
    linhas.push("", `Palavras-chave: ${[...tags, ...palavras].map((p) => `${p.palavra} (${p.total})`).join(", ")}`);
  }
  linhas.push("", `Abrir o mapa: ${link}`);

  // ---- HTML ----
  const ramos = ordem
    .slice(1)
    .map(
      ({ no, nivel }) =>
        `<tr><td style="padding:3px 0 3px ${(nivel - 1) * 18}px;color:#1f2937;font-size:${nivel === 1 ? 15 : 14}px;line-height:1.4;${nivel === 1 ? "font-weight:600;" : ""}">` +
        `${nivel === 1 ? "●" : "–"} ${escapar(no.texto)}` +
        (no.nota ? `<br><span style="color:#6b7280;font-size:13px;">${escapar(no.nota)}</span>` : "") +
        `</td></tr>`,
    )
    .join("");
  const secao = (rotulo: string, corpo: string) =>
    corpo
      ? `<p style="margin:22px 0 8px;color:#011f51;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">${rotulo}</p>${corpo}`
      : "";
  const htmlDatas = datas
    .map(
      ({ no, d }) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eef0f4;font-size:14px;color:#1f2937;"><span style="display:inline-block;min-width:96px;color:#0069fd;font-weight:600;">${escapar(rotuloData(d, hoje))}</span>${escapar(no.texto)}</td></tr>`,
    )
    .join("");
  const chips = [...tags, ...palavras]
    .map(
      (p) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:#eef3ff;color:#0041bc;font-size:13px;">${escapar(p.palavra)} · ${p.total}</span>`,
    )
    .join("");

  const html = `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#f5e9dc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5e9dc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background-color:#011f51;padding:20px 28px;color:#f5e9dc;font-size:16px;font-weight:600;">Gaiamum · Mapa mental</td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 14px;color:#011f51;font-size:21px;font-weight:600;">🧠 ${escapar(titulo)}</h1>
                ${ramos ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ramos}</table>` : `<p style="color:#6b7280;font-size:14px;">Este mapa ainda não tem ramos.</p>`}
                ${secao("Datas do mapa", htmlDatas ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${htmlDatas}</table>` : "")}
                ${secao("Palavras-chave", chips ? `<div>${chips}</div>` : "")}
                <a href="${escapar(link)}" style="display:inline-block;margin-top:24px;background-color:#0069fd;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;">Abrir o mapa</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.5;">
                Você pediu este resumo no Gaiamum. Ele vai só para o seu e-mail.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  return { assunto: `🧠 Resumo do mapa: ${titulo}`.slice(0, 150), texto: linhas.join("\n"), html };
}
