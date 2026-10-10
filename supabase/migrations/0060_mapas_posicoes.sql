-- Gaiamum — Mapa mental, fase 2 (2026-10-10): posição manual e aparência
-- (cor e borda) dos ramos na visão de mapa.
--
-- `pos_x`/`pos_y` = onde a pessoa ARRASTOU o ramo, RELATIVO ao centro do
-- ramo pai (null = posição automática do layout). Relativo de propósito:
-- arrastar um ramo leva junto tudo o que está dentro dele com UMA gravação,
-- e "Reorganizar" é zerar as duas colunas do mapa.
--
-- Posição é só desenho: nunca muda `pai_id` nem `ordem` (a hierarquia).
-- Ficam na própria linha do ramo, então valem as mesmas policies da 0059
-- (só o dono grava; equipe lê mapa compartilhado). Nada é copiado.
--
-- Não destrutiva: colunas novas, nulas, sem default caro — os ramos que já
-- existem continuam iguais e abrem no layout automático.
--
-- `cor` / `forma` (pedido do Fabio): escolha por ramo; null = automático
-- (cor do ramo principal / borda conforme o estilo do mapa). Ramos de
-- dentro herdam a cor escolhida. Só valores da paleta — nada livre.
--
-- Reversão: alter table mapa_nos drop column pos_x, drop column pos_y,
--   drop column cor, drop column forma;

alter table mapa_nos
  add column pos_x double precision check (pos_x between -100000 and 100000),
  add column pos_y double precision check (pos_y between -100000 and 100000),
  add constraint mapa_nos_posicao_completa check ((pos_x is null) = (pos_y is null)),
  add column cor text check (cor in ('roxo', 'verde-agua', 'coral', 'azul', 'amarelo', 'lima', 'verde', 'laranja')),
  add column forma text check (forma in ('caixa', 'linha'));

notify pgrst, 'reload schema';
