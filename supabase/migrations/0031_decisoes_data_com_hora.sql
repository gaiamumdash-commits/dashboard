-- Gaiamum — data da decisão passa a ter hora, não só o dia (mesmo motivo da
-- migration 0013 pro prazo do cartão): decisão agora aparece na Agenda
-- (frente 2, integração cross-módulo) e "Dia inteiro" perde o horário real
-- de quando ela foi de fato tomada/registrada. Valores existentes viram
-- meia-noite UTC daquele dia — mesmo comportamento aceito na 0013, tratado
-- no código de leitura da Agenda (mesma técnica já usada pra tarefas
-- antigas).

alter table decisoes
  alter column data type timestamptz using (data::timestamptz);

alter table decisoes
  alter column data set default now();
