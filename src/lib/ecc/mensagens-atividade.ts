import type { TipoAtividade } from "@/lib/ecc/tipos";

/** Texto da atividade — sem dependência de servidor, pra poder ser
 * reaproveitado tanto no e-mail de notificação (atividade.ts, server-only)
 * quanto na timeline do cartão (client component). */
export const MENSAGEM_POR_TIPO: Record<TipoAtividade, (detalhe: Record<string, string>) => string> = {
  criada: () => "criou este cartão",
  movida: (d) => `moveu este cartão de "${d.de}" para "${d.para}"`,
  descricao_editada: () => "editou a descrição deste cartão",
  checklist_item_adicionado: (d) => `adicionou "${d.texto}" ao checklist`,
  checklist_item_concluido: (d) => `marcou "${d.texto}" como concluído no checklist`,
  checklist_item_reaberto: (d) => `reabriu "${d.texto}" no checklist`,
  checklist_item_removido: (d) => `removeu "${d.texto}" do checklist`,
  membro_adicionado: () => "te adicionou como responsável por este cartão",
  membro_removido: () => "te removeu como responsável deste cartão",
  excluida: () => "apagou este cartão",
  comentario: (d) => `comentou: "${d.texto}"`,
};
