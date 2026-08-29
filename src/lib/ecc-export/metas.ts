import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MetaSmart } from "@/lib/ecc/tipos";
import { slugify } from "@/lib/ecc/smart";

/**
 * Exporta a meta SMART como Markdown com frontmatter YAML, pronto pra abrir
 * no Obsidian, dentro de /ecc-system/metas/. Em ambiente serverless (Vercel)
 * o filesystem é efêmero — isso funciona hoje em dev local; quando o Gaiamum
 * ganhar deploy, este exportador troca pra gravar o Markdown no Storage do
 * Supabase em vez de disco local.
 */
export async function exportarMetaSmartMarkdown(meta: MetaSmart, nomeWorkspace: string) {
  const pastaDestino = path.join(process.cwd(), "ecc-system", "metas");
  await mkdir(pastaDestino, { recursive: true });

  const nomeArquivo = `${meta.horizonte}-${slugify(meta.visao_macro)}.md`;
  const conteudo = `---
tipo: meta-smart
horizonte: ${meta.horizonte}
workspace: "${nomeWorkspace}"
criado_em: ${meta.criado_em}
tags: [gaiamum, meta-smart, ${meta.horizonte}]
---

# ${meta.horizonte === "medio_prazo" ? "Meta de médio prazo" : "Meta de longo prazo"}

## Visão macro

${meta.visao_macro}

## S — Específica

${meta.specific}

## M — Mensurável

${meta.measurable}

## A — Atingível

${meta.attainable}

## R — Relevante

${meta.relevant}

## T — Temporal

${meta.time_bound}

---

Relacionado: [[${nomeWorkspace}]]
`;

  await writeFile(path.join(pastaDestino, nomeArquivo), conteudo, "utf-8");
}
