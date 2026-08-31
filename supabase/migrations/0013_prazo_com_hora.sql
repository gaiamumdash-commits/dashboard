-- Gaiamum — Prazo do cartão passa a ter hora, não só o dia (pedido do
-- Fabio: "faltar 48 horas" precisa ser preciso, não só 2 dias de
-- calendário). Valores existentes (só data) viram meia-noite UTC daquele
-- dia — comportamento aceitável pra quem já tinha prazo cadastrado.

alter table tarefas
  alter column data_limite type timestamptz using (data_limite::timestamptz);
