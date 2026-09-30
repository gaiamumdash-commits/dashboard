-- Gaiamum — forma de pagamento na conta a pagar. Pendência registrada desde
-- a sessão #49 do handoff (dinheiro/pix/débito/cartão de crédito), retomada
-- agora porque o pedido de "clicar na conta e dizer como paguei" (vindo da
-- integração Kanban ↔ Financeiro) esbarra exatamente nela. Só o campo
-- simples — parcelamento (compra em N vezes) fica fora de propósito, é um
-- desenho de schema maior e não foi pedido nesta rodada.
--
-- Nullable e sem default: normalmente só é preenchida no momento de marcar a
-- conta como paga (`marcarComoPaga`), não no lançamento — antes de pagar,
-- muitas vezes ainda não se sabe como vai pagar.

alter table contas_a_pagar
  add column forma_pagamento text check (forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito'));
