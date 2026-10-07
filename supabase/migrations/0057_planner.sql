-- Gaiamum — Planner V1 (2026-10-07): camada de organização da vida pessoal
-- (Pessoal, Estudos, Casa, Saúde) conectada aos domínios que já existem.
-- Prompt e mockup aprovados: docs/gaiamum/mockups/planner-mockup-aprovado-2026-10-07.jpg
-- e docs/planner/PLANNER_V1.md.
--
-- Decisões do Fabio (2026-10-07), que moldam TODO este schema:
--
-- 1. Dado do Planner é PESSOAL: cada linha tem `user_id` + `tenant_id` e só a
--    própria pessoa enxerga — nem o owner do workspace vê o Planner de um
--    membro. Diferente de tudo que existia até aqui (eventos_agenda,
--    metas_smart etc. são do workspace inteiro). A policy exige as duas
--    coisas: a linha é minha (`user_id = auth.uid()`) E eu ainda pertenço
--    ao workspace (`tenant_id in current_tenant_ids()`) — quem é removido do
--    workspace perde o acesso às linhas que deixou lá.
-- 2. Objetivos pessoais NÃO entram em `metas_smart` (no máximo 1 meta por
--    horizonte por workspace, metas do negócio, visíveis pra equipe) —
--    ganham uma tabela leve própria. A aba Objetivos mostra as Metas SMART só
--    como referência (leitura).
-- 3. Datas do Planner (consultas, compromissos de pet, manutenções) ficam
--    aqui, privadas, e a Agenda passa a LER essas linhas como mais uma fonte
--    (mesmo padrão de contas a pagar/tarefas/decisões, `agenda.ts`) — não
--    viram `eventos_agenda` (que a equipe toda veria e iria pro Google).
--
-- Fora daqui de propósito: nada financeiro (Financeiro segue fonte única),
-- nada de prontuário (Saúde é planejamento de bem-estar, não dado clínico).
--
-- `user_id` tem default `auth.uid()`: as Server Actions nunca mandam o
-- user_id — ele sai do JWT da sessão, e o `with check` recusa qualquer valor
-- diferente mesmo que alguém tente mandar pela API.
--
-- Reversão (nenhuma tabela existente é alterada; nada depende destas):
--   drop table planner_habito_registros, planner_habitos, planner_objetivos,
--     planner_notas, planner_leituras, planner_cursos, planner_compras,
--     planner_cardapio, planner_compromissos, planner_pets,
--     planner_manutencoes, planner_preferencias cascade;
--   drop function planner_eh_meu(uuid, uuid);

-- ==========================================================================
-- Regra única de acesso, usada por todas as policies abaixo.
-- ==========================================================================

create or replace function planner_eh_meu(dono uuid, t_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select dono = auth.uid() and t_id in (select current_tenant_ids());
$$;

-- ==========================================================================
-- Hábitos e rotinas — o mesmo motor serve aos dois: algo que se repete em
-- dias da semana e é marcado como feito por dia. "Rotina" pode ter horário
-- (aparece no card "Hoje" na hora certa); "hábito" é o acompanhamento de
-- consistência (Leitura, Beber água...). Rotina doméstica NÃO reaproveita
-- `tarefas`: tarefa é cartão de Kanban de projeto, do time, sem recorrência.
-- ==========================================================================

create table planner_habitos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  area text not null check (area in ('pessoal', 'estudos', 'casa', 'saude')),
  tipo text not null default 'habito' check (tipo in ('habito', 'rotina')),
  -- ISO: 1 = segunda ... 7 = domingo (a semana do Planner começa na segunda,
  -- igual a `semana.ts`).
  dias_semana smallint[] not null check (
    cardinality(dias_semana) between 1 and 7
    and dias_semana <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  ),
  horario time,
  -- Usado pra somar "tempo estudado" (Estudos) — opcional.
  duracao_minutos integer check (duracao_minutos between 1 and 1440),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Uma linha = "fiz neste dia". Desmarcar apaga a linha. O índice único
-- impede marcar duas vezes o mesmo dia (clique duplo).
create table planner_habito_registros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habito_id uuid not null references planner_habitos (id) on delete cascade,
  data date not null,
  criado_em timestamptz not null default now(),
  unique (habito_id, data)
);

-- ==========================================================================
-- Objetivos pessoais (decisão 2 acima) e notas simples por área.
-- ==========================================================================

create table planner_objetivos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  area text not null check (area in ('pessoal', 'estudos', 'casa', 'saude')),
  prazo date,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'pausado', 'concluido')),
  notas text check (char_length(notas) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Notas simples (texto puro). Não reaproveita `paginas_livres`: lá a página
-- pertence a um projeto e a equipe do quadro inteira lê.
create table planner_notas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area text not null check (area in ('pessoal', 'estudos', 'casa', 'saude')),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  conteudo text not null default '' check (char_length(conteudo) <= 10000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ==========================================================================
-- Estudos: leituras e cursos/idiomas (idioma é um "curso" com objetivo e
-- frequência — não é app de ensino, só organização).
-- ==========================================================================

create table planner_leituras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  autor text check (char_length(autor) <= 120),
  status text not null default 'quero_ler' check (status in ('quero_ler', 'lendo', 'concluido')),
  progresso smallint not null default 0 check (progresso between 0 and 100),
  data_inicio date,
  data_alvo date,
  notas text check (char_length(notas) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table planner_cursos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null default 'curso' check (tipo in ('curso', 'idioma')),
  nome text not null check (char_length(btrim(nome)) between 1 and 200),
  instituicao text check (char_length(instituicao) <= 120),
  objetivo text check (char_length(objetivo) <= 300),
  frequencia text check (char_length(frequencia) <= 120),
  status text not null default 'em_andamento' check (status in ('planejado', 'em_andamento', 'concluido')),
  progresso smallint not null default 0 check (progresso between 0 and 100),
  data_alvo date,
  link text check (link is null or (char_length(link) <= 500 and link ~* '^https?://')),
  notas text check (char_length(notas) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ==========================================================================
-- Casa: compras, cardápio, pets e manutenções.
-- ==========================================================================

create table planner_compras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  categoria text not null default 'Geral' check (char_length(btrim(categoria)) between 1 and 60),
  quantidade text check (char_length(quantidade) <= 40),
  comprado boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Uma célula do cardápio semanal: (semana, dia, refeição). `semana` é sempre
-- a segunda-feira, garantido no banco.
create table planner_cardapio (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  semana date not null check (extract(isodow from semana) = 1),
  dia_semana smallint not null check (dia_semana between 1 and 7),
  refeicao text not null check (refeicao in ('cafe_da_manha', 'almoco', 'lanche', 'jantar')),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  atualizado_em timestamptz not null default now(),
  unique (user_id, tenant_id, semana, dia_semana, refeicao)
);

create table planner_pets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  tipo text check (char_length(tipo) <= 60),
  notas text check (char_length(notas) <= 2000),
  criado_em timestamptz not null default now()
);

create table planner_manutencoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  ultima_realizacao date,
  proxima_data date,
  -- Em meses (filtro a cada 6, ar-condicionado a cada 3, seguro a cada 12).
  -- Ao concluir, a próxima data é recalculada a partir de hoje.
  recorrencia_meses smallint check (recorrencia_meses between 1 and 120),
  observacao text check (char_length(observacao) <= 1000),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ==========================================================================
-- Compromissos do Planner (consulta, compromisso de pet, outro). A Agenda
-- lê esta tabela (decisão 3 acima) — não é uma segunda agenda, é mais uma
-- fonte da mesma Agenda.
-- ==========================================================================

create table planner_compromissos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  area text not null check (area in ('pessoal', 'estudos', 'casa', 'saude')),
  tipo text not null default 'outro' check (tipo in ('consulta', 'pet', 'outro')),
  inicio timestamptz not null,
  local text check (char_length(local) <= 200),
  notas text check (char_length(notas) <= 1000),
  pet_id uuid references planner_pets (id) on delete set null,
  concluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Primeiro acesso: quais áreas a pessoa quer ver primeiro. Uma linha por
-- pessoa por workspace; sem linha = ainda não passou pela boas-vindas.
create table planner_preferencias (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  areas text[] not null default array[]::text[] check (
    areas <@ array['pessoal', 'estudos', 'casa', 'saude']::text[]
  ),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

-- ==========================================================================
-- RLS — todas as tabelas, todas as operações (select/insert/update/delete).
-- ==========================================================================

alter table planner_habitos enable row level security;
alter table planner_habito_registros enable row level security;
alter table planner_objetivos enable row level security;
alter table planner_notas enable row level security;
alter table planner_leituras enable row level security;
alter table planner_cursos enable row level security;
alter table planner_compras enable row level security;
alter table planner_cardapio enable row level security;
alter table planner_pets enable row level security;
alter table planner_manutencoes enable row level security;
alter table planner_compromissos enable row level security;
alter table planner_preferencias enable row level security;

create policy "planner_habitos: so a propria pessoa" on planner_habitos for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

-- Além de ser meu, o registro só pode apontar pra um hábito MEU do mesmo
-- workspace (o FK sozinho aceitaria o UUID do hábito de outra pessoa).
create policy "planner_habito_registros: so a propria pessoa" on planner_habito_registros for all
  using (planner_eh_meu(user_id, tenant_id))
  with check (
    planner_eh_meu(user_id, tenant_id)
    and exists (
      select 1 from planner_habitos h
      where h.id = planner_habito_registros.habito_id
        and h.user_id = planner_habito_registros.user_id
        and h.tenant_id = planner_habito_registros.tenant_id
    )
  );

create policy "planner_objetivos: so a propria pessoa" on planner_objetivos for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

create policy "planner_notas: so a propria pessoa" on planner_notas for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

create policy "planner_leituras: so a propria pessoa" on planner_leituras for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

create policy "planner_cursos: so a propria pessoa" on planner_cursos for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

create policy "planner_compras: so a propria pessoa" on planner_compras for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

create policy "planner_cardapio: so a propria pessoa" on planner_cardapio for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

create policy "planner_pets: so a propria pessoa" on planner_pets for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

create policy "planner_manutencoes: so a propria pessoa" on planner_manutencoes for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

-- Mesmo cuidado do registro de hábito: `pet_id` só pode ser um pet MEU.
create policy "planner_compromissos: so a propria pessoa" on planner_compromissos for all
  using (planner_eh_meu(user_id, tenant_id))
  with check (
    planner_eh_meu(user_id, tenant_id)
    and (
      pet_id is null
      or exists (
        select 1 from planner_pets p
        where p.id = planner_compromissos.pet_id
          and p.user_id = planner_compromissos.user_id
          and p.tenant_id = planner_compromissos.tenant_id
      )
    )
  );

create policy "planner_preferencias: so a propria pessoa" on planner_preferencias for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

-- Privilégios explícitos só pro papel `authenticated` (o anônimo não recebe
-- nada). O Supabase está aposentando a exposição automática de tabela nova
-- na Data API (aviso da CLI: `auto_expose_new_tables`, 2026-10-30) — sem
-- isto, o app perderia acesso às tabelas assim que a mudança valer.
grant select, insert, update, delete on
  planner_habitos, planner_habito_registros, planner_objetivos, planner_notas,
  planner_leituras, planner_cursos, planner_compras, planner_cardapio,
  planner_pets, planner_manutencoes, planner_compromissos, planner_preferencias
  to authenticated;

-- ==========================================================================
-- Índices — toda leitura do Planner filtra por (user_id, tenant_id).
-- ==========================================================================

create index planner_habitos_dono_idx on planner_habitos (user_id, tenant_id) where ativo;
create index planner_habito_registros_dono_data_idx on planner_habito_registros (user_id, tenant_id, data);
create index planner_objetivos_dono_idx on planner_objetivos (user_id, tenant_id);
create index planner_notas_dono_idx on planner_notas (user_id, tenant_id, area);
create index planner_leituras_dono_idx on planner_leituras (user_id, tenant_id);
create index planner_cursos_dono_idx on planner_cursos (user_id, tenant_id);
create index planner_compras_dono_idx on planner_compras (user_id, tenant_id);
create index planner_pets_dono_idx on planner_pets (user_id, tenant_id);
create index planner_manutencoes_dono_idx on planner_manutencoes (user_id, tenant_id, proxima_data) where ativo;
create index planner_compromissos_dono_inicio_idx on planner_compromissos (user_id, tenant_id, inicio);
create index planner_compromissos_pet_idx on planner_compromissos (pet_id) where pet_id is not null;
