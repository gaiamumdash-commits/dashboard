import { z } from "zod";

/** Schema compartilhado entre o caminho manual (colar resultado de uma
 * entrevista rodada no Claude Code/claude.ai) e o futuro caminho automático
 * (chamada direta à API, Incremento 2b) — sem depender do SDK da Anthropic,
 * pra não acoplar o caminho manual a uma credencial que ele não tem ainda. */
export const ExtracaoEntrevistaSchema = z.object({
  perfil: z.object({
    nome_negocio: z.string().min(1),
    nicho: z.string().min(1),
    tom_de_voz: z.string().min(1),
    resumo_diagnostico: z.string().min(1),
  }),
  produto: z.object({
    nome: z.string().min(1),
    formato: z.enum(["curso", "ebook", "mentoria", "template", "comunidade", "outro"]),
    promessa: z.string().min(1),
  }),
  avatar: z.object({
    dores: z.array(z.string().min(1)).length(5),
    desejos: z.array(z.string().min(1)).length(5),
    dor_unificada: z.string().min(1),
    gatilho_compra: z.string().min(1),
  }),
});

export type ExtracaoEntrevista = z.infer<typeof ExtracaoEntrevistaSchema>;
