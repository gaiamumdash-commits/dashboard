-- Gaiamum — Conexão pessoal com o Google Calendar (ver + criar eventos).
-- Uma conexão por pessoa (auth.users.id), não por tenant — cada membro
-- conecta a própria conta Google, independente de qual workspace usa.

create table google_calendar_conexoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  google_email text not null,
  refresh_token text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table google_calendar_conexoes enable row level security;
-- De propósito, sem nenhuma policy: só o service role (bypassa RLS) acessa
-- essa tabela — o refresh token nunca passa pelo client autenticado comum,
-- mesmo padrão de segurança já usado pra `convites`.
