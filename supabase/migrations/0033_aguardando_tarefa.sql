-- GTD (lado acionável) no cartão: "Aguardando" — a única saída do fluxo de
-- processamento do GTD que não tinha equivalente hoje (Calendário e Próxima
-- ação já são cobertos por data_limite preenchida/vazia). Opcional por
-- cartão: texto livre, nulo por padrão, não força nada em quem não usa.
alter table tarefas add column aguardando_de text;
