-- Gaiamum — Sino de notificação no app. Só o service role grava (o cron de
-- alarme, fase seguinte) — mesmo padrão de segurança de
-- `google_calendar_conexoes`: nenhuma policy de insert pro usuário comum.

create table notificacoes_app (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  corpo text,
  link text,
  tipo text not null default 'alarme' check (tipo in ('alarme')),
  lida boolean not null default false,
  lida_em timestamptz,
  criado_em timestamptz not null default now()
);

alter table notificacoes_app enable row level security;

create policy "notificacoes_app: usuario ve as proprias"
  on notificacoes_app for select
  using (user_id = auth.uid());

create policy "notificacoes_app: usuario marca a propria como lida"
  on notificacoes_app for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notificacoes_app: usuario apaga a propria"
  on notificacoes_app for delete
  using (user_id = auth.uid());

create index notificacoes_app_user_id_idx on notificacoes_app (user_id, lida, criado_em desc);
