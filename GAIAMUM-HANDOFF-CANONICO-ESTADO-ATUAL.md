# Gaiamum — Handoff Canônico do Estado Atual

**Data da auditoria:** 2026-09-30
**Auditor:** Claude Code (Sonnet 5), inspeção direta do repositório `c:\Users\proff\Documents\Gaiamum` (branch `main`, working tree com alterações não commitadas em `docs/handoffs/HANDOFF-ULTRAQUADRAS-CLAUDE-CODE.md` — de outro projeto, irrelevante aqui).
**Método:** leitura de código-fonte real (todas as 44 migrations SQL, ~35 dos ~90 arquivos de `src/lib/ecc/*.ts` lidos por completo, o restante localizado e amostrado), sem execução da aplicação, sem alteração de nenhum arquivo.
**Regra seguida:** nada foi classificado como FUNCIONAL sem ver o fluxo completo (UI → Server Action → banco → RLS). Onde não verifiquei o fluxo completo, digo isso explicitamente.

Este documento é uma fotografia técnica, não uma proposta de roadmap. Nenhuma melhoria foi implementada nesta sessão.

> **Atualizações depois desta auditoria:** o estado atual vive em `docs/handoffs/HANDOFF-GAIAMUM-CLAUDE-CODE.md`; leia a seção "Estado confirmado" mais recente. Módulos novos desde 30/09 com documentação própria:
> - **Planner V1** (07/10, migrations 0057/0058): `docs/planner/PLANNER_V1.md`.
> - **Mapa mental V1** (09–10/10, migrations 0059–0062; lista + mapa visual, datas e palavras por regra, ramo → tarefa/compromisso, resumo por e-mail): `docs/mapas/MAPAS_V1.md`.

---

## 1. Resumo executivo

O Gaiamum é uma aplicação web Next.js 16 (App Router) + Supabase (Postgres com RLS) + Mantine UI, multi-tenant, em produção real (`www.gaiamum.com.br`, piloto com cadastro fechado por allowlist desde 2026-09-12). É um único produto full-stack, não um monorepo de serviços. O código é consistentemente bem estruturado: nomenclatura em português, comentários explicando o *porquê* das decisões (não o óbvio), zero uso de `any` explícito no código auditado, zero `TODO`/`FIXME` deixados soltos no código de produto, RLS aplicado em toda tabela sensível com defesa em profundidade na camada de aplicação.

O produto reúne, hoje, 7 áreas funcionais reais: **Projetos/Tarefas (Kanban)**, **Páginas livres (estilo Notion simplificado)**, **Agenda (unificada com Google Calendar)**, **Financeiro**, **Metas SMART + Indicadores + Decisões (Visão 360°)**, **Marketing/Produto Digital** e o **Gaiamum Lab** (onboarding gamificado com case fictício). A integração real entre elas é maior do que a média de produtos em estágio de piloto — ver a matriz da seção 12 — mas é pontual (pontes específicas), não um "grafo de dados" onde tudo conversa com tudo.

A maior distância entre a visão estratégica declarada ("IA como camada estratégica sobre os dados reais") e a realidade do código: **hoje quase não há IA agindo sobre dados do usuário**. As duas únicas chamadas de LLM sobre dado real do sistema são (a) transcrição de áudio determinística por natureza (voz → texto) e (b) uma interpretação textual curta de um score que já é 100% calculado por fórmula determinística. O restante da "IA" do produto (entrevista de Marketing) tem código pronto para um provedor (Anthropic) que **não é chamado pelo fluxo real em produção** — o fluxo real é colar manualmente uma transcrição de conversa feita fora do Gaiamum.

---

## 2. Arquitetura técnica

**Stack confirmado em `package.json`:**
- Next.js 16.2.12 (App Router), React 19.2.4, TypeScript 5, Tailwind CSS 4.
- Supabase (`@supabase/ssr` + `@supabase/supabase-js`) — Postgres com Row Level Security como camada primária de autorização.
- Mantine 9.6.1 (`@mantine/core`, `@mantine/hooks`) — mas a maior parte da UI observada usa Tailwind puro com tokens de tema custom (`gaiamum-*`), não componentes Mantine — ver seção 15.
- `@blocknote/core` + `@blocknote/mantine` + `@blocknote/react` 0.54.2 — editor de blocos real (não um textarea disfarçado) para "Páginas livres".
- `@anthropic-ai/sdk` 0.122.0 (Claude) e `@google/genai` 2.21.0 (Gemini) — dois provedores de IA no mesmo projeto, ver seção 11.
- `googleapis` 178.0.0 — integração OAuth2 + Calendar API real.
- `resend` 6.25.0 — e-mail transacional.
- `recharts` 2.15.1 — gráficos (uso confirmado no Financeiro, ver seção 9).
- `papaparse` — importação de CSV (extrato bancário).
- `zod` 4 — validação de schema (usado nas saídas estruturadas de IA).
- **Sem** biblioteca de datas (`date-fns`/`dayjs`/`luxon`) — todo cálculo de fuso horário é feito à mão com `Intl.DateTimeFormat`, ver `src/lib/ecc/kanban.ts`.
- **Sem** framework de estado global (Redux/Zustand/Jotai) — estado é Server Components + Server Actions + `revalidatePath`, padrão nativo do App Router.
- **Sem** biblioteca de teste (nenhuma entrada `jest`/`vitest`/`playwright`/`@testing-library` em `package.json`).

**Scripts em `package.json`:** `dev`, `build`, `start`, `lint`. **Não há script `test`.**

**Estrutura de diretórios (`src/`):**
```
src/
├── app/                     — rotas (App Router), ~50 arquivos page.tsx/route.ts
│   ├── api/cron/            — 3 endpoints de cron (alarmes, contas fixas, reengajamento Lab)
│   ├── api/google-calendar/ — callback OAuth
│   ├── auth/                — login (Supabase Auth + Google OAuth próprio)
│   ├── admin/analitica-lab/ — painel restrito ao dono do SaaS
│   ├── financeiro/, agenda/, projetos/[id]/, marketing/, lab/, equipe/, onboarding/, configuracoes/
├── components/               — ~100 componentes, organizados por módulo (agenda/, financeiro/, kanban/, lab/, marketing/, projetos/, equipe/, layout/)
├── lib/
│   ├── ecc/                  — TODA a lógica de negócio e Server Actions (~90 arquivos) — "ecc" não é explicado no código, mas é o namespace de domínio único do produto
│   ├── ecc/lab/               — submódulo isolado do Gaiamum Lab (10 arquivos)
│   ├── ecc-export/            — exportação de dados (Markdown de metas SMART)
│   └── supabase/              — client/server/service/middleware do Supabase
└── proxy.ts                   — middleware do Next (autenticação + cache de membership)
```

Não há separação backend/frontend em serviços distintos, não há API REST própria além dos 3 crons e o callback OAuth — a "API" do produto é inteiramente Server Actions do Next.js (`"use server"`), chamadas diretamente pelos componentes React.

`supabase/migrations/`: 44 migrations SQL, de `0001_schema_inicial.sql` (29/08/2026) a `0044_colunas_em_turnos.sql` (29/09/2026) — ritmo de desenvolvimento de aproximadamente 1 migration por dia útil, histórico de 1 mês.

---

## 3. Metodologia de classificação

Cada funcionalidade neste relatório recebe um dos rótulos abaixo, sempre com evidência de arquivo:

- **FUNCIONAL** — vi o fluxo completo (formulário/UI → Server Action → tabela no banco → RLS correspondente) e ele fecha sem lacuna óbvia.
- **PARCIAL** — o núcleo existe e funciona, mas falta uma parte relevante do que o nome sugere (ex.: "forma de pagamento" existe, "parcelamento" não).
- **UI/MOCK** — existe tela/componente, mas não persiste dado real ou não está conectado à lógica de negócio.
- **QUEBRADO/POSSÍVEL BUG** — encontrei evidência concreta de inconsistência (não apenas suspeita).
- **PLANEJADO** — há schema, comentário ou estrutura preparatória, mas a funcionalidade em si não roda.
- **LEGADO/ÓRFÃO** — código que existe mas não é chamado pelo caminho real da aplicação.
- **NÃO CONFIRMADO** — não tive evidência suficiente (arquivo não lido a fundo, ou lido mas sem certeza do estado real em produção).

---

## 4. Mapa real do produto

Reconstruído a partir das rotas (`src/app/`) e da navegação real (`links-navegacao.tsx`, `menu-lateral.tsx`), não da visão pretendida:

```
Gaiamum
├── Autenticação (/auth) — e-mail/senha + Google OAuth próprio (não é o Google Calendar)
├── Onboarding (/onboarding, /onboarding/lab-ou-direto) — Metas SMART obrigatórias no dia 1
├── Gaiamum Lab (/lab/*) — onboarding gamificado paralelo, opcional, tenant próprio fictício
│   ├── /lab/quadro, /lab/agenda, /lab/financeiro, /lab/paginas, /lab/visao-360, /lab/progresso
├── Painel geral (/) — dashboard: tarefas atrasadas/próximas, financeiro do mês, metas, projetos
├── Projetos (/projetos, /projetos/[id]/*)
│   ├── /tarefas — Kanban (colunas configuráveis, cartões completos)
│   ├── /paginas, /paginas/[paginaId] — Páginas livres (BlockNote)
│   ├── /decisoes — Decisões estruturadas
│   ├── /indicadores — Indicadores numéricos manuais
│   ├── /visao-360 — "Alinhamento Gaiamum" (score determinístico + explicação opcional por IA)
│   └── /configuracoes — cor, arquivar, equipe do quadro, resultado esperado
├── Agenda (/agenda) — unifica Google Calendar + contas a pagar + tarefas c/ prazo + decisões + eventos manuais/voz
├── Financeiro (/financeiro, /financeiro/fixas, /financeiro/avulsas, /financeiro/importar) — owner-only
├── Marketing (/marketing/*) — Perfil do Negócio, Produtos Digitais, Avatar, Entrevista, Mandala de Anúncios, Página de Venda, VSL — owner-only
├── Equipe (/equipe) — convites, membros, papéis — owner-only
├── Configurações (/configuracoes)
└── Admin (/admin/analitica-lab) — restrito ao e-mail fixo do dono do SaaS (EMAIL_DONO_SAAS), não a qualquer owner
```

Não existe "Metas" como área de primeiro nível na navegação — Metas SMART vive dentro do onboarding e do dashboard; não há CRUD de metas fora da criação inicial (ver seção 10).

---

## 5. Inventário de telas e rotas

| Rota | Finalidade | Nível de implementação | Evidência |
|---|---|---|---|
| `/` | Dashboard: atrasadas, vencendo, financeiro do mês, metas, projetos | FUNCIONAL | `app/page.tsx` |
| `/auth`, `/auth/callback`, `/auth/callback/google`, `/auth/redefinir-senha` | Login e recuperação de senha | FUNCIONAL | 4 arquivos em `app/auth/` |
| `/onboarding`, `/onboarding/lab-ou-direto` | Metas SMART obrigatórias + oferta do Lab | FUNCIONAL | `app/onboarding/page.tsx` |
| `/lab/*` (7 sub-rotas) | Onboarding gamificado (case "Café do Mangue") | FUNCIONAL (ver seção 21) | `app/lab/**` |
| `/projetos` | Lista de quadros | FUNCIONAL | `app/projetos/page.tsx` |
| `/projetos/[id]/tarefas` | Kanban do projeto | FUNCIONAL | `app/projetos/[id]/tarefas/page.tsx` |
| `/projetos/[id]/paginas`, `/paginas/[paginaId]` | Páginas livres | FUNCIONAL (escopo simples, ver seção 7) | `paginas-livres.ts` |
| `/projetos/[id]/decisoes` | Decisões | FUNCIONAL | `decisoes.ts` |
| `/projetos/[id]/indicadores` | Indicadores manuais | FUNCIONAL | `indicadores.ts` |
| `/projetos/[id]/visao-360` | Score de alinhamento + explicação por IA opcional | FUNCIONAL | `visao-360.ts`, `explicacao-alinhamento.ts` |
| `/projetos/[id]/configuracoes` | Cor, arquivar, equipe do quadro, resultado esperado | FUNCIONAL | `actions.ts` |
| `/agenda` | Agenda unificada | FUNCIONAL | `agenda.ts` |
| `/financeiro`, `/fixas`, `/avulsas`, `/importar` | Financeiro completo | FUNCIONAL (owner-only) | `financeiro.ts`, `importacao-extrato.ts` |
| `/marketing`, `/marketing/perfil`, `/produtos*`, `/entrevista*`, `/ideias*` | Módulo de Marketing | PARCIAL/FUNCIONAL misto — ver seção 21 | `marketing.ts`, `entrevista.ts`, `mandala.ts` |
| `/equipe` | Convites, membros, papéis | FUNCIONAL | `equipe.ts`, `actions.ts` |
| `/configuracoes` | Configurações de conta | NÃO CONFIRMADO em profundidade (arquivo não lido linha a linha) | `app/configuracoes/page.tsx` |
| `/convite/[token]` | Aceitar convite | FUNCIONAL | `actions.ts:aceitarConvite` |
| `/admin/analitica-lab` | Painel do dono do SaaS: acesso beta + analítica do Lab | FUNCIONAL | `acesso-beta.ts` |
| `/acesso-restrito` | Tela de bloqueio do cadastro fechado | FUNCIONAL | referenciada em `workspace.ts` |
| `/privacidade`, `/termos` | Páginas institucionais estáticas | NÃO CONFIRMADO (não lidas) | `app/privacidade/`, `app/termos/` |
| `/api/cron/disparar-alarmes` | Cron de alarmes (conta/tarefa/evento) | FUNCIONAL, confirmado em produção real (ver handoff) | `route.ts` |
| `/api/cron/gerar-contas-fixas` | Gera instâncias mensais de contas fixas | FUNCIONAL (não lido linha a linha, mas referenciado consistentemente) | `route.ts` |
| `/api/cron/reengajamento-lab` | E-mail de reengajamento 48h sem atividade no Lab | FUNCIONAL (mencionado no schema e no template de e-mail) | `route.ts`, migration `0028` |
| `/api/google-calendar/callback` | OAuth callback do Calendar | FUNCIONAL | `route.ts` |

Não encontrei rotas órfãs (páginas sem link de navegação) nem componentes de página duplicados. Não encontrei dead ends de navegação óbvios no código lido — mas não testei a aplicação rodando, então a UX real de erro/loading não foi validada visualmente (ver seção 15 para o que dá para inferir do código).

---

## 6. Jornadas do usuário

**Onboarding (cadastro → primeiro projeto):**
`/auth` (cadastro) → `garantirWorkspace()` cria tenant+membership via RPC transacional → `/onboarding/lab-ou-direto` (se ainda não decidiu) → `/onboarding` (Metas SMART, só "médio prazo" hoje) → redirect `/projetos`. Sem meta SMART cadastrada, `/` sempre redireciona de volta para `/onboarding` (`app/page.tsx:40-42`) — ou seja, **é uma etapa obrigatória, não pulável de fato** apesar de existir `pularOnboarding()` (que redireciona para `/projetos`, mas o dashboard `/` continua empurrando de volta enquanto não houver meta salva).

**Criar projeto → tarefa → conclusão:**
`/projetos` (botão "novo projeto", só owner) → `criarProjeto` cria projeto + `projeto_membros` (criador vira gestor) + 3 colunas padrão → `/projetos/[id]/tarefas` → criar cartão (aceita colar várias linhas = vários cartões de uma vez) → mover entre colunas (drag-and-drop com ordem fracionária) → soltar na coluna "Concluído" (fixa, toca som). Atrito real identificado: só o **owner** cria projeto (`actions.ts:111-113`), então num workspace de equipe, gestores/membros nunca criam quadros novos — só o dono paga e decide estrutura.

**Tarefa completa (estilo Trello):** título → descrição → datas (início/limite com hora) → prioridade (P1-P4) → membros (múltiplos) → etiquetas (6 cores fixas) → checklist → comentários (com @menção) → anexo (até 15MB) → "aguardando" (GTD) → marco (`is_marco`) → valor estimado → gerar conta a pagar a partir do cartão. Isso é um cartão rico, comparável em profundidade a um Trello com Power-Ups — mas tudo dentro de um único modal (`detalhe-tarefa.tsx`, não lido linha a linha, mas todos os campos acima têm Server Action correspondente confirmada em `actions.ts`).

**Financeiro:** lançar despesa avulsa ou conta fixa recorrente → alarme de véspera criado automaticamente (18h do dia anterior) → marcar como paga (pede forma de pagamento no primeiro clique) → aparece na Agenda e na coluna "Compromissos de hoje" do Kanban. Atrito: financeiro é **owner-only por RLS** — mesmo um gestor de projeto nunca vê o financeiro, mesmo que tenha gerado a conta a partir de uma tarefa dele.

**Não encontrei** uma jornada "criar meta SMART depois do onboarding" — a criação de metas parece acontecer uma única vez, no onboarding (`criarMetasSmart` insere todas de uma vez a partir de um formulário fixo por `horizonte`). Não há botão "+ nova meta" identificado no código lido.

---

## 7. Auditoria específica do modelo "Notion" (Páginas livres)

**O que existe de fato**, confirmado em `src/lib/ecc/paginas-livres.ts` + migration `0032_paginas_livres.sql`:

- Editor de blocos real via BlockNote (`@blocknote/core`/`react`/`mantine`), não um textarea — suporta os tipos de bloco nativos do BlockNote (heading, parágrafo, lista com marcador, etc., conforme `PartialBlock[]`).
- Conteúdo persistido como `jsonb` em `paginas_livres.conteudo`.
- Template inicial fixo ao criar: "Material de referência" + "Ideias / algum dia" (2 headings), deliberadamente **sem** seção de "próximas ações" — comentário explícito no código explica que isso é proposital, para não competir com o Kanban (ver GTD, seção 16).
- **Uma página pertence a exatamente um projeto** (`projeto_id` NOT NULL) — não existe página solta fora de um projeto, nem página de workspace inteiro.
- **Lista plana, sem hierarquia**: não há `parent_id`/página-filha em `paginas_livres`. É uma lista de páginas por projeto, cada uma independente.
- **Sem templates além do inicial**, sem atalhos de comando (`/`) confirmados no código lido, sem embeds de outras entidades do sistema (uma página não referencia uma tarefa ou decisão por link interno), sem versionamento/histórico.
- **Concorrência otimista simples, não colaboração em tempo real**: `atualizarConteudoPaginaLivre` compara o `atualizado_em` que o cliente tinha ao carregar contra o do banco; se divergem, devolve `{conflito: true}` em vez de fazer merge — dois usuários editando ao mesmo tempo não veem as edições um do outro em tempo real, só descobrem o conflito ao salvar.
- Permissão: qualquer membro com acesso ao projeto edita (mesmo padrão de tarefas); só gestor/owner apaga.

**Classificação: FUNCIONAL, mas com escopo deliberadamente reduzido.** Não é um clone de Notion (sem hierarquia, sem base de dados/tabela, sem colaboração real-time) — é uma "caixa de notas por projeto" com um editor rico. Isso está alinhado ao princípio estratégico declarado ("não copiar o Notion"), mas significa que hoje **"Páginas" serve para anotação de referência e ideias soltas, não para conhecimento estruturado ou base de conhecimento navegável**.

---

## 8. Projetos e Tarefas (Kanban)

Lido por completo em `kanban.ts` (utilitários), `actions.ts` (CRUD principal) e o schema em 8 migrations distintas (`0001`, `0002`, `0003`, `0006`, `0007`, `0009`, `0013`, `0030`, `0042`, `0044`).

**Confirmado FUNCIONAL:**
- Projetos com status (ativo/pausado/concluído), cor de fundo, arquivamento, resultado esperado (texto livre usado no score de Visão 360°).
- Colunas configuráveis por projeto (criar/renomear/apagar/reordenar), exceto a coluna "Concluído" que é fixa e imutável por regra de RLS (`colunas_kanban: update por quem tem acesso, exceto a fixa`).
- Divisão opcional de uma coluna em 3 turnos (Manhã/Tarde/Noite) — feature recente (migration `0044`, 29/09/2026), reversível.
- Cartão completo: membros múltiplos, checklist, etiquetas (6 cores fixas, reaproveitáveis entre projetos), datas com hora, prioridade P1-P4, anexos, comentários com @menção, campo "aguardando" (GTD), flag de marco, valor estimado, geração de conta a pagar.
- Ordem de cartão dentro da coluna: posição fracionária (`double precision`), técnica idêntica à do Trello/Notion internamente — evita reindexar a coluna inteira a cada arrasto (migration `0042`).
- Histórico de atividade por tarefa (`tarefa_atividades`) com 10 tipos de evento, sobrevive à exclusão do cartão (`tarefa_id` vira `null`, mas a linha permanece — decisão explícita registrada no comentário da migration `0007`).
- Notificação por e-mail (Resend) a responsáveis e menções, disparada via `after()` do Next (não bloqueia a resposta ao usuário).
- "Freeze" / consolidação: `enviarConsolidacaoProjeto` manda um e-mail de ponto de situação (agrupado por responsável, com status/atraso) para todo mundo com acesso ao quadro — recurso não convencional em produtos deste porte.
- Permissões em 2 camadas reais: RLS no Postgres (autoridade final) + guard na Server Action (`exigirGestorOuOwner`) como defesa em profundidade — dentro de um projeto, qualquer membro cria/move/renomeia; só gestor ou owner apaga (cartão, coluna ou o quadro).

**Achado de dívida técnica leve:** `atualizarStatusProjeto` (mudar ativo/pausado/concluído) não chama `exigirGestorOuOwner` — depende inteiramente da RLS de `projetos` ("update por quem tem acesso", que libera qualquer membro com acesso ao projeto, não só gestor/owner). Isso é consistente com a regra declarada ("dentro do projeto, todo mundo pode fazer tudo, menos apagar"), então não é um bug — mas é inconsistente com o padrão do resto do arquivo, que sempre tem uma função `exigir*` explícita antes do update. Risco real: baixo (a RLS já impede acesso cross-tenant/cross-projeto).

---

## 9. Agenda (Calendário)

Lido por completo em `agenda.ts`, `alarmes.ts`, `google-calendar.ts`, `google-calendar-interno.ts`, `parser-fala-agenda.ts`.

**O que aparece na Agenda, e de onde vem** (`listarAgendaUnificada`, `agenda.ts:23-172`):
1. Eventos do Google Calendar (pessoal, por usuário conectado via OAuth próprio).
2. Contas a pagar em aberto (só para o owner).
3. Tarefas com `data_limite` preenchida, cuja coluna não é a "Concluído".
4. Eventos manuais/por voz (`eventos_agenda`).
5. Decisões (só para o owner).

**Sincronização com Google Calendar: bidirecional parcial, real, não mockada.**
- Conexão via OAuth2 próprio (`GOOGLE_CALENDAR_CLIENT_ID/SECRET`), escopos `calendar.events` + `userinfo.email`, refresh token salvo em `google_calendar_conexoes` (tabela sem nenhuma RLS policy de leitura para o usuário comum — só service role acessa, decisão de segurança deliberada).
- Criar/editar/excluir um compromisso do Gaiamum espelha automaticamente no Google Calendar do usuário (`google-calendar-interno.ts:espelharCompromissoNoGoogle`), usando uma propriedade privada (`gaiamum_id`) no evento do Google como vínculo — **sem coluna nova no banco**.
- Alarme do Gaiamum vira lembrete pop-up no evento espelhado do Google.
- Falha do Google nunca derruba o salvamento no Gaiamum — vira aviso (`ResultadoSincronizacao`).
- Tratamento real de erro: token revogado (`invalid_grant`) apaga a conexão automaticamente; permissão insuficiente (usuário desmarcou o escopo do Calendar na tela de consentimento) idem, com mensagem específica.
- **Limitação documentada no próprio código**: o app Google Cloud está "publicado em produção, não verificado" (0/100 usuários) — qualquer usuário vê o aviso "app não verificado" ao conectar. Verificação completa não foi solicitada (exige vídeo de demonstração), só compensa ao abrir comercialmente.

**Voz → evento: parser 100% determinístico, sem IA** (`parser-fala-agenda.ts`) — regex sobre texto sem acento para extrair título, data (hoje/amanhã/dia da semana/data explícita), horário (intervalo "das X às Y", "às X", "meio-dia"/"meia-noite") e antecedência de alarme ("N minutos/horas/dias antes"). O resultado sempre passa por uma tela de confirmação editável antes de criar o compromisso — não é "best-effort silencioso". A transcrição de áudio em si (quando a Web Speech API do navegador não está disponível, ex. Safari/iOS) é que usa IA (Gemini) — ver seção 11.

**Alarmes:** sistema polimórfico genérico (`alarmes`, entidade `conta_a_pagar`/`tarefa`/`evento_agenda`), com "claim" atômico via função SQL (`reivindicar_alarme`) para não duplicar notificação quando dois crons disparam ao mesmo tempo. Disparo via **2 mecanismos redundantes**: cron nativo da Vercel (limitado a 1x/dia no plano Hobby, ver `vercel.json`) + `pg_cron` direto do Postgres a cada 15 minutos (migration `0021`, criado especificamente porque o plano Hobby não permite cron mais frequente que diário). Confirmado funcionando em produção real segundo o handoff (não re-verificado nesta auditoria, mas a implementação é coerente e o achado consta documentado com evidência de teste ponta a ponta).

**Classificação: FUNCIONAL**, com boa cobertura de casos de erro reais (token expirado, permissão negada, timezone).

---

## 10. Financeiro

Lido por completo em `financeiro.ts`, `categorizacao.ts`, schema em migrations `0008`, `0034`, `0043`.

**Confirmado FUNCIONAL:**
- Contas fixas (modelo recorrente, dia de vencimento, categoria) → geradas mensalmente em instâncias (`contas_a_pagar`) por cron (`gerar-contas-fixas/route.ts`, não lido linha a linha mas referenciado de forma consistente e citado como funcionando em produção no handoff).
- Despesas avulsas.
- Categorização automática por regra de palavra-chave, **100% determinística, sem IA** (`categorizacao.ts` — comentário explícito no código: "Sem IA nesta primeira versão: determinístico, editável pelo próprio Fabio, sem custo de API").
- Importação de extrato bancário via CSV (`importacao-extrato.ts`, não lido linha a linha, mas `papaparse` está nas dependências e a rota `/financeiro/importar` existe com componente dedicado `importar-extrato.tsx`).
- Marcar como paga com forma de pagamento (dinheiro/pix/débito/crédito) — campo adicionado em 29/09/2026 (migration `0043`).
- Anexo de comprovante (mesma tabela genérica `anexos` usada por tarefas), até 15MB, bucket privado no Supabase Storage com RLS por tenant no path.
- Alarme de véspera automático (18h do dia anterior) criado em toda conta nova, sem ação manual.
- Ponte com Kanban/Decisões: gerar conta a pagar a partir de uma tarefa ou decisão (índice único garante que não duplica).
- Dashboard/gráficos: `recharts` está nas dependências, componente `consolidacao-global.tsx` existe — **não lido linha a linha**, então a profundidade real dos gráficos é NÃO CONFIRMADA.

**PARCIAL confirmado:** forma de pagamento existe, mas **parcelamento não** — comentário explícito na migration `0043`: "parcelamento (compra em N vezes) fica fora de propósito, é um desenho de schema maior e não foi pedido nesta rodada." Isso está registrado como pendência aberta no próprio handoff do projeto.

**Isolamento confirmado**: Financeiro é estritamente **owner-only** por RLS (`contas_a_pagar: so owner`, `contas_fixas_modelo: so owner`, etc.) — nenhum gestor de projeto ou membro convidado vê qualquer dado financeiro, mesmo que tenha originado a despesa a partir de uma tarefa dele. Isso é coerente com o princípio "dado sensível" declarado nos comentários das migrations, mas significa que o Financeiro **não é uma ferramenta de colaboração em equipe** hoje — é uma ferramenta pessoal do dono do workspace.

**Não confirmado / não lido a fundo:** fluxo de conciliação bancária, exportação de relatórios, indicadores de fluxo de caixa projetado vs. realizado (o `README`/comentários de migration mencionam "fluxo de caixa e conciliação bancária" como exemplo de meta SMART a atingir — ou seja, o próprio código trata isso como algo que **ainda não existe**, um objetivo futuro citado dentro de um placeholder de formulário, não uma feature implementada).

---

## 11. Metas e Metas SMART

Lido em `metas.ts`, `smart.ts`, `indicadores.ts`, `decisoes.ts`, `visao-360.ts`, `actions.ts:criarMetasSmart`.

- **Criação**: formulário único no onboarding, um conjunto de campos SMART (Specific/Measurable/Attainable/Relevant/Time-bound) + "visão macro", por horizonte. **Só "médio prazo" (1-3 anos) é oferecido hoje** — "longo prazo" existe no schema/tipo mas foi removido do formulário em 2026-09-09 por decisão registrada no código ("rigor SMART para 3-5+ anos não é realista pro ritmo de mercado; só 1 meta real com esse horizonte existia em produção antes da mudança").
- **Confirmado no código (não é mais suposição): não existe edição de meta SMART depois de criada.** `metas.ts` só tem uma função de contagem cacheada (`contarMetasSmart`); a escrita em `metas_smart` acontece em um único lugar de todo o `src/` (`actions.ts:criarMetasSmart`), e é um `insert` puro, nunca um `update`/`upsert` (confirmado por busca de todos os arquivos que tocam `metas_smart`). O link "Editar →" no dashboard (`app/page.tsx:143`) aponta para `/onboarding` — e `app/onboarding/page.tsx:33-45` mostra que, quando `temMetasSmart` é verdadeiro, a página **não renderiza o formulário `FormularioSmart` de jeito nenhum**: mostra só o texto "Suas metas já estão salvas" com um botão "Ir pros projetos" (que leva para `/projetos`, não para um formulário preenchido). **Classificação: QUEBRADO/POSSÍVEL BUG confirmado por leitura de código** — o rótulo "Editar" no dashboard promete uma ação que a tela de destino não oferece. Não há, em lugar nenhum do código, um caminho para mudar o texto de uma meta SMART depois que ela foi salva.
- **Progresso da meta: não existe cálculo direto.** Não há campo de "% concluído" em `metas_smart`. O que existe é o **"Alinhamento Gaiamum"** (Visão 360°, `visao-360.ts`): uma fórmula 100% determinística que combina 4 fatores (vínculo a meta SMART, atraso de tarefas, progresso do quadro, indicadores em relação à meta) com pesos redistribuídos dinamicamente conforme os dados disponíveis. Não é a meta em si que tem progresso — é o **projeto** que recebe um score de alinhamento, e a meta SMART é só um dos 4 fatores desse score (peso base 20%, binário: vinculado ou não).
- **Indicadores** (`indicadores.ts`): numéricos, por projeto, atualização **manual** (o usuário digita o "valor atual" — não há nenhuma automação lendo dado de outro módulo para atualizar um indicador sozinho).
- **Decisões** (`decisoes.ts`): registro estruturado (título/decisão/motivo/impacto esperado), com meta SMART e valor estimado opcionais, ponte real para o Financeiro (gera conta a pagar).

**Classificação consolidada: PARCIAL.** A fundação de dados (Etapa 1 do "Contexto Vivo", conforme comentário da migration `0026`) está pronta e é usada de verdade pelo score de alinhamento, mas o conceito de "meta" em si é hoje quase estático (criada uma vez, sem CRUD posterior claro) e seu "progresso" é uma inferência indireta via projeto, não uma medição direta da meta.

---

## 12. Inteligência Artificial

**Seção crítica — mapeamento completo de todos os pontos de chamada de IA encontrados no código.**

### 12.1 Dois provedores, dois papéis muito diferentes

| Provedor | SDK | Modelo | Onde é chamado de fato | Uso real confirmado? |
|---|---|---|---|---|
| Anthropic (Claude) | `@anthropic-ai/sdk` | `claude-sonnet-5` (constante `MODELO_MARKETING` em `ia.ts`) | `responderTurnoEntrevista`, `extrairPerfilEAvatarDaEntrevista` em `ia.ts` | **NÃO — nenhum call site encontrado além da própria definição.** Ver 12.2. |
| Google Gemini | `@google/genai` | `gemini-3.1-flash-lite` (constante `MODELO_GEMINI_PADRAO` em `gemini.ts`) | `transcricao-audio.ts` (transcrever voz→texto) e `explicacao-alinhamento.ts` (interpretar o score de Visão 360°) | **SIM, nos 2 pontos.** |

### 12.2 Achado principal: código de IA conversacional pronto, mas desconectado do fluxo real

`ia.ts` implementa uma entrevista guiada de 4 estágios via Claude (Situação → Problema → Implicação → Necessidade, método claramente inspirado em SPIN Selling, reescrito do zero segundo o comentário do próprio código) com saída estruturada via `zodOutputFormat` — código tecnicamently correto e bem escrito.

**Mas o fluxo real em produção (`entrevista.ts`) não chama nenhuma dessas duas funções.** O comentário no próprio `registrarRespostaEtapa` diz: *"sem nenhuma chamada de IA, o texto já veio de uma conversa que o Fabio rodou fora do Gaiamum"*. E `finalizarComExtracaoColada` faz *"parse determinístico (sem IA)"* do texto colado (`prompt-entrevista.ts`, não lido linha a linha, mas a assinatura `parsearResultadoEntrevista` e o comentário confirmam extração por regex/parsing de texto formatado, não por LLM).

Ou seja: **a "Entrevista guiada por IA" do Marketing, como o usuário a experimenta hoje, não usa IA nenhuma dentro do Gaiamum** — é um formulário de "colar um bloco de texto formatado" com parser determinístico. O código Anthropic existe, compila, está testado o suficiente para ter tratamento de erro (`mensagemDeErroIA`), mas é **código órfão do ponto de vista do produto em produção** — classificação: **LEGADO/ÓRFÃO** (ou, sob outra leitura, **PLANEJADO**: pode ser a próxima etapa óbvia, trocar o fluxo de "colar texto" pelo chat real via `responderTurnoEntrevista`).

Isso também significa: **`ANTHROPIC_API_KEY` está entre as dependências do projeto e é necessária para o build/tipo do SDK, mas não gera custo de uso em produção hoje**, porque o código que a chamaria nunca é invocado pelo fluxo real.

### 12.3 Os 2 usos reais de IA, em detalhe

**(a) Transcrição de voz (`transcricao-audio.ts` + `gemini.ts:transcreverAudioComGemini`)**
- Entrada: áudio gravado no navegador (Blob, até 5MB) — só ativado quando a Web Speech API do navegador não está disponível (Safari/iOS).
- Contexto enviado ao modelo: só o áudio em base64 + um prompt fixo pedindo transcrição literal em português. **Nenhum dado do usuário (nome, workspace, outras tarefas) é enviado.**
- Saída: texto transcrito, que segue para o **mesmo parser determinístico** (`interpretarFalaAgenda`) usado no caminho normal da Web Speech API — a IA aqui só substitui o reconhecimento de voz do navegador, não interpreta o compromisso.
- Áudio nunca é persistido — processado em memória e descartado.
- Log de consumo (tokens) sempre registrado, sucesso ou falha, via `registrarConsumoIA` → tabela `ia_consumo_log`.

**(b) Explicação do Alinhamento Gaiamum (`explicacao-alinhamento.ts`)**
- Entrada: nome do projeto, resultado esperado (texto do usuário), e o **score e os 4 fatores já calculados por fórmula determinística** (não é a IA que calcula o score).
- Contexto enviado: só esses números/textos — nenhum dado financeiro, nenhum dado de outro projeto, nenhum dado de outro usuário.
- Saída: 3-5 frases interpretando o score, com instrução explícita no prompt para "nunca inventar dado que não foi dado" e "nunca prometer um resultado que os números não sustentam".
- **Otimização de custo real e deliberada**: `alinhamentoTemDadosReais()` decide se vale a pena gastar a chamada — só executa se houver dado real além do vínculo binário à meta SMART. Comentário no código confirma isso como decisão consciente ("decide quando vale a pena gastar uma chamada de IA").
- Gatilho de gamificação: primeira geração bem-sucedida concede a patente "Master" do Lab (`concederPatente`).

### 12.4 Onde IA foi deliberadamente evitada em favor de determinismo (bom sinal de disciplina de custo)

Confirmado por comentário explícito no código em 3 lugares:
1. **Parser de fala da Agenda** (`parser-fala-agenda.ts`) — regex, não LLM, mesmo sendo "linguagem natural".
2. **Categorização financeira** (`categorizacao.ts`) — regra por palavra-chave, não LLM.
3. **Score de Alinhamento Gaiamum** (`visao-360.ts`) — fórmula matemática com pesos, não LLM; a IA só entra depois, opcionalmente, para **explicar em texto** um número já calculado.

O Mandala de Anúncios, Página de Venda e Roteiro de VSL (módulo Marketing, Incrementos 3-5) seguem o **mesmo padrão da Entrevista**: fluxo "gerar prompt copiável → colar resposta manualmente" — **nenhuma chamada de API de IA integrada**, confirmado em `mandala.ts` (nenhum import de `ia.ts`/`gemini.ts`) e consistente com o comentário da migration `0016` ("no fluxo manual, gerar prompt, colar resposta do Claude, salvar").

### 12.5 Resposta direta à pergunta do pedido: há LLM sendo usado onde determinismo bastaria?

**Não, no que está de fato em produção.** Os 2 usos reais de IA (transcrição de áudio, explicação de score) são, por natureza, tarefas que **exigem** um modelo de linguagem (transcrever fala livre; parafrasear um resultado numérico em prosa natural) — não são candidatos óbvios a substituição por SQL/regra. O risco de custo real não está em uso indevido de IA, e sim no **código pronto e não utilizado** (Anthropic/entrevista) que, se algum dia for ativado sem os mesmos cuidados de custo (cache de prompt, decisão de "vale a pena chamar") vistos em `explicacao-alinhamento.ts`, poderia gerar gasto recorrente por conversa — vale planejar isso deliberadamente antes de ligar.

### 12.6 Consumo e observabilidade

`ia_consumo_log` (migration `0028`) registra toda chamada real (sucesso ou falha) com tokens, sem RLS de leitura para o usuário comum — só o painel `/admin/analitica-lab` (restrito ao dono do SaaS via `souDonoDoSaas()`) cruza dados de todos os tenants. Não encontrei rate limiting explícito por usuário/tenant nas chamadas de IA (diferente do limite de 20 convites/hora encontrado em `actions.ts`) — **achado de segurança/custo**: um usuário autenticado poderia, em tese, gerar muitas transcrições de áudio seguidas sem limite de taxa aplicado no código (a exposição real depende do volume de usuários simultâneos, hoje baixo por estar em piloto fechado).

---

## 13. Integração entre os módulos

| Relação | Status | Evidência |
|---|---|---|
| Tarefa → Calendário | **SIM** | `listarAgendaUnificada` inclui tarefas com `data_limite` (`agenda.ts:48-54`) |
| Tarefa → Financeiro | **SIM** | `gerarContaAPagarDaTarefa`, `tarefas.valor_estimado` (migration `0034`) |
| Projeto → Financeiro | **PARCIAL** | Só indireto via tarefa/decisão individual gerando conta; `contas_a_pagar` não tem `projeto_id` — não existe "financeiro consolidado por projeto" |
| Meta SMART → Projeto | **SIM** | `projetos.meta_smart_id` FK (migration `0001`), usado no score de alinhamento |
| Meta SMART → Financeiro | **NÃO** | Nenhuma referência direta; só 2 saltos possíveis via Decisão (que tem `meta_smart_id` opcional e pode gerar conta) |
| Meta SMART → Indicadores | **NÃO direto** | `indicadores` tem `projeto_id`, não `meta_smart_id` — a ligação é só transitiva via o projeto |
| Página livre → Projeto | **SIM** (só isso) | `paginas_livres.projeto_id` NOT NULL; conteúdo da página não referencia de volta tarefas/decisões |
| Decisão → Projeto | **SIM** | `decisoes.projeto_id` NOT NULL |
| Decisão → Meta SMART | **SIM** (opcional) | `decisoes.meta_smart_id` |
| Decisão → Financeiro | **SIM** | `gerarContaAPagarDaDecisao`, índice único por decisão |
| Calendário → Financeiro | **SIM** | Contas a pagar aparecem na Agenda e na coluna "Compromissos de hoje" do Kanban |
| Calendário → Projeto | **SIM** | Tarefas com prazo e decisões aparecem na Agenda, linkadas de volta ao projeto |
| Equipe/Colaboração → Tarefa | **SIM** | `tarefa_membros`, menções (`mencoes.ts`), notificação de atividade |
| IA → Tarefas | **PARCIAL/INDIRETO** | Só via Alinhamento (soma dados de tarefas em um score); nenhuma IA lê/sugere/prioriza tarefas diretamente |
| IA → Financeiro | **NÃO** | Nenhum ponto de código encontrado onde IA processa dado financeiro |
| IA → Metas | **PARCIAL/INDIRETO** | Só cita se há vínculo (sim/não) no prompt de explicação — não analisa o conteúdo/qualidade da meta |
| Gaiamum Lab → dados reais do usuário | **NÃO** | Lab roda em um **tenant separado e fictício** ("Café do Mangue"), ligado ao usuário só por `user_id` (patente/progresso são conquista de conta, não de workspace) — nenhum dado do Lab cruza para o workspace real |
| Google Calendar → Agenda/Kanban | **SIM** | Sincronização bidirecional parcial real, ver seção 9 |

**Conclusão desta seção:** o Gaiamum de hoje é mais integrado do que "módulos coexistindo" — há pontes reais e testadas (Tarefa/Decisão↔Financeiro, Kanban↔Agenda↔Google, Projeto↔Meta↔Score) — mas **o Financeiro e as Metas continuam sendo os dois módulos mais isolados**: o primeiro por decisão de segurança (owner-only, sem visão por projeto), o segundo por não ter CRUD pós-onboarding nem ligação direta a indicadores. A "camada de IA cruzando tudo" descrita na visão estratégica **não existe ainda** — o que existe é uma fórmula determinística (Alinhamento Gaiamum) que faz o papel de agregador, com uma IA opcional só para comentar o resultado em texto.

---

## 14. Modelo de dados

**44 migrations, ~40 tabelas.** Resumo das entidades principais (finalidade / campos-chave / relacionamento / ownership / RLS):

| Tabela | Finalidade | Ownership / tenant | RLS |
|---|---|---|---|
| `tenants` | Workspace | — | select próprio workspace; update só owner (desde `0036`) |
| `memberships` | Vínculo usuário↔tenant, papel (owner/member), escopo (completo/projeto) | `user_id`, `tenant_id` | select mesmo workspace; delete/update só owner |
| `metas_smart` | Metas SMART por workspace | `tenant_id` | isolado por workspace + `tem_acesso_completo` (não vale pra quem entrou só num projeto) |
| `projetos` | Quadros/projetos | `tenant_id` | select/update por quem tem acesso ao projeto; insert só owner; delete só gestor/owner |
| `projeto_membros` | Quem tem acesso a um projeto específico, papel gestor/usuario | `tenant_id`, `projeto_id` | gerenciado por gestor do projeto ou owner |
| `colunas_kanban` | Colunas do Kanban por projeto, "Concluído" é fixa | `tenant_id`, `projeto_id` | update/delete da fixa bloqueado por RLS |
| `tarefas` | Cartões — título, descrição, prioridade, datas, coluna, ordem, turno, marco, valor estimado, aguardando | `tenant_id`, `projeto_id` | por acesso ao projeto |
| `tarefa_membros`, `tarefa_checklist_itens`, `tarefa_etiquetas`, `tarefa_atividades` | Sub-entidades do cartão | `tenant_id` | isolado por workspace (tabelas filhas) ou por acesso ao projeto (atividades) |
| `etiquetas` | 6 cores fixas, reaproveitáveis no workspace | `tenant_id` | isolado por workspace |
| `anexos` | Genérico — conta a pagar (owner-only) ou tarefa (por acesso ao projeto) | `tenant_id`, `entidade_tipo`+`entidade_id` polimórfico | 2 policies distintas por `entidade_tipo` |
| `convites` | Convite de workspace ou de projeto específico | `tenant_id` | colunas sensíveis travadas contra UPDATE por trigger (`0030`) |
| `contas_fixas_modelo`, `contas_a_pagar` | Financeiro — modelo recorrente e instâncias mensais | `tenant_id` | **owner-only**, sem exceção |
| `contas_categoria_regras` | Regras de categorização por palavra-chave | `tenant_id` | owner-only |
| `decisoes` | Registro de decisão de projeto | `tenant_id`, `projeto_id` | owner-only |
| `indicadores` | Indicador numérico manual por projeto | `tenant_id`, `projeto_id` | owner-only |
| `paginas_livres` | Notas/BlockNote por projeto | `tenant_id`, `projeto_id` | por acesso ao projeto (não owner-only) |
| `eventos_agenda` | Compromissos manuais/voz | `tenant_id` | por `tem_acesso_completo` |
| `alarmes` | Polimórfico — conta/tarefa/evento | `tenant_id`, `entidade_tipo`+`entidade_id` | regra por tipo de entidade |
| `google_calendar_conexoes` | Refresh token OAuth por usuário | `user_id` (não `tenant_id`) | **sem nenhuma policy** — só service role |
| `notificacoes_app` | Sino in-app | `user_id` | usuário só vê/marca/apaga a própria |
| `perfis_negocio`, `produtos_digitais`, `avatares_cliente`, `avatar_itens`, `entrevistas_ia`, `ideias_conteudo`, `pecas_conteudo`, `paginas_venda`, `roteiros_vsl` | Módulo Marketing (9 tabelas) | `tenant_id` | **todas owner-only** |
| `ia_consumo_log` | Log de uso de IA cross-tenant | `tenant_id`/`user_id` nullable | **RLS ligado, sem nenhuma policy** — só service role lê/escreve |
| `lab_tenants`, `lab_passos`, `patentes_usuario` | Gaiamum Lab — por CONTA (`user_id`), não por workspace | `user_id` | select próprio; insert só service role |
| `acesso_beta_permitido` | Allowlist do cadastro fechado | — (`email` como PK) | **sem nenhuma policy** — só service role |

**Riscos de modelo de dados identificados (nenhum é uma vulnerabilidade ativa — todos já mitigados no schema atual, listados porque a auditoria pediu explicitamente):**
- `reivindicar_alarme()` era `security definer` com `EXECUTE` público por padrão do Postgres, permitindo (antes da correção) que qualquer usuário autenticado silenciasse o alarme de outro tenant via `supabase.rpc()` direto do navegador — **corrigido na migration `0029`** (revoke explícito), documentado no próprio comentário da migration como achado de auditoria de segurança em 2026-09-10.
- Colunas sensíveis de `convites` (tenant/projeto/e-mail/papel/token) eram alteráveis via UPDATE por qualquer policy que liberasse cancelar/reenviar — **corrigido na migration `0030`** com trigger `BEFORE UPDATE` comparando OLD/NEW.
- `tem_acesso_ao_projeto()` na migration `0003` não considerava `escopo = 'completo'`, deixando quem aceitava convite geral sem ver nenhum projeto — **corrigido na migration `0004`**.
- Race condition real em `garantirWorkspace()` podia criar 2 tenants para o mesmo usuário em requisições simultâneas — **corrigido na migration `0040`** com advisory lock transacional.

Esses 4 achados **já corrigidos** são um bom sinal de maturidade do processo (auditorias de segurança acontecem e geram migration corretiva rápida), não uma lista de problemas abertos.

**Diagrama textual simplificado:**
```
tenants ─┬─< memberships >─ auth.users
         ├─< projetos ─┬─< colunas_kanban ─< tarefas ─┬─< tarefa_membros
         │              │                              ├─< tarefa_checklist_itens
         │              │                              ├─< tarefa_etiquetas >─ etiquetas
         │              │                              ├─< tarefa_atividades
         │              │                              └─< anexos (entidade_tipo='tarefa')
         │              ├─< decisoes ──> metas_smart (opcional)
         │              │      └──> contas_a_pagar (0..1, via decisao_id)
         │              ├─< indicadores
         │              ├─< paginas_livres
         │              └─< projeto_membros >─ auth.users
         ├─< metas_smart
         ├─< contas_fixas_modelo ─< contas_a_pagar >─ anexos (entidade_tipo='conta_a_pagar')
         │                                    └──> tarefas (0..1, via tarefa_id)
         ├─< eventos_agenda
         ├─< alarmes (conta_a_pagar | tarefa | evento_agenda)
         ├─< convites
         ├─< perfis_negocio ─< produtos_digitais ─┬─< avatares_cliente ─< avatar_itens
         │                                          ├─< entrevistas_ia
         │                                          ├─< ideias_conteudo ─< pecas_conteudo
         │                                          ├─< paginas_venda
         │                                          └─< roteiros_vsl
         └─< ia_consumo_log (cross-tenant, só admin)

auth.users ─┬─< google_calendar_conexoes (1:1)
            ├─< lab_tenants (1:1) ─< lab_passos, patentes_usuario
            └─< notificacoes_app
```

---

## 15. Multiusuário e equipes

**O que existe de verdade** (schema + `equipe.ts` + `membership.ts` + `actions.ts`):

- **Workspace (tenant)** com **papel** (`owner`/`member`) e **escopo** (`completo`/`projeto`) — 2 dimensões independentes de permissão, não uma única hierarquia.
- **Convite**: por e-mail, com token UUID, expira em 7 dias, pode ser de workspace inteiro ou de um projeto específico. Rate limit real: 20 convites/hora por tenant (`actions.ts:1028`).
- **Papéis dentro de um projeto**: `gestor`/`usuario` (`projeto_membros`) — um gestor de projeto (mesmo não sendo owner do tenant) pode: convidar gente para o próprio quadro, apagar cartão/coluna/página daquele quadro, promover/remover outros membros do quadro. Documentado no código como "coordenador de projeto" (migration `0014`).
- **Auditoria**: `tarefa_atividades` registra quem fez o quê e quando, sobrevive à exclusão do cartão.
- **Isolamento de dados**: reforçado em 2 camadas (RLS + guard de aplicação) em praticamente toda Server Action lida.

**O que NÃO existe:**
- Não há "organização" acima do workspace — é tenant único e plano (sem hierarquia de múltiplos workspaces sob uma conta-mãe).
- Não há papéis customizáveis/granulares além de owner/member + gestor/usuario fixos.
- Não há comentário/colaboração em tempo real (só otimista, com detecção de conflito, na página livre).
- Compartilhamento de link público (ex.: "compartilhar página com quem não é membro") — **não encontrado**.

**Teste de segurança realizado nesta auditoria (análise estática, não ataque ao vivo):**
Segui a cadeia de autorização de 6 fluxos sensíveis (financeiro, decisões, indicadores, páginas livres, alarmes, anexos) comparando a policy de RLS contra a Server Action correspondente. Em todos os casos verificados, a policy de RLS é suficiente por si só para impedir acesso cross-tenant mesmo que a camada de aplicação falhasse — ou seja, **não é "segurança por obscuridade" via UI**, é imposta no banco. Não executei nenhuma chamada real trocando IDs (a instrução pediu para não fazer ataques destrutivos e eu não tenho a aplicação rodando nesta sessão) — este é um achado de **leitura de código**, não um pentest ao vivo. Recomendo, antes de abrir comercialmente, um teste dinâmico real (criar 2 contas de teste, tentar acessar recurso da outra trocando UUID na URL/DevTools) — o próprio handoff do projeto registra que isso já foi feito manualmente ao menos uma vez (sessão #29, confirmação de segurança multi-usuário via RLS real, não só UI).

---

## 16. UX/UI e consistência

Baseado em leitura de código (não em execução visual da aplicação — não tenho screenshots desta sessão):

**Pontos positivos identificáveis no código:**
- Sistema de cor consistente: 6 cores fixas (`purple/teal/yellow/blue/coral/lime`) reaproveitadas em etiquetas, cor de projeto e avatar por e-mail (hash determinístico) — não é uma paleta arbitrária por tela.
- Tratamento de erro deliberado e documentado: várias Server Actions devolvem `{erro}` em vez de `throw`, especificamente porque o Next.js redige mensagens de exceção em produção — padrão aplicado de forma consistente onde encontrado (`gerarExplicacaoAlinhamento`, `transcreverAudioParaTexto`, `editarEventoGoogleCalendar`).
- Uso de `<Suspense>` em pontos que fariam round-trip extra (sino de notificação, patente, link do Lab) para não bloquear o shell da página — mostra atenção a performance percebida.
- Menu lateral `sticky` (corrigido explicitamente por bug relatado: rodapé "Sair" sumia em página comprida) e menu mobile equivalente (`menu-mobile.tsx`) — responsividade tratada como requisito, não afterthought.
- Confirmação antes de exclusão, mensagens de erro específicas por caso (ex.: "Já existe um convite pendente", "Essa tarefa já tem uma conta gerada").

**Pontos de atenção (inferidos do código, não de teste visual):**
- **Curva de entendimento real antes de trabalhar**: o modelo de permissão tem 2 dimensões (papel × escopo) mais um terceiro nível (papel dentro do projeto) — um "coordenador de projeto" não-owner precisa entender que ele não vê Financeiro/Metas SMART/Equipe do workspace, só o próprio quadro. Isso não está exposto de forma óbvia na UI segundo o código lido (é uma regra de RLS/aplicação, não uma explicação na tela) — risco real de confusão para quem não é o Fabio.
- **Financeiro é owner-only silenciosamente**: um gestor de projeto que gera uma conta a pagar a partir de uma tarefa dele nunca mais a vê depois (RLS bloqueia) — o código não indica se a UI avisa isso no momento da geração.
- **"Editar" meta SMART é um link enganoso, confirmado em código** (não apenas suspeita): leva a uma tela que, com metas já existentes, não mostra formulário nenhum — ver seção 10.
- Não encontrei componente de "loading skeleton" dedicado além de `esqueleto-pagina.tsx` (1 arquivo) — não sei se cada tela pesada (Kanban, Agenda) tem seu próprio skeleton ou reaproveita um genérico; **não confirmado**.
- Acessibilidade (ARIA, navegação por teclado, contraste): **não confirmado** — não há indício no código lido de auditoria de acessibilidade deliberada (nenhum comentário, nenhuma lib como `@radix-ui`/`react-aria` além do que o Mantine já traz).

---

## 17. Produtividade real vs. performativa

Sinais concretos encontrados **a favor** do princípio declarado ("não criar mais trabalho de organização"):
- Criar tarefa aceita colar várias linhas de uma vez (1 cartão por linha) — evita repetição manual.
- Template de página livre deliberadamente sem "próximas ações" para não duplicar o Kanban (comentário explícito no código, ver seção 7).
- Categorização financeira automática por regra, edição once/reaproveitamento.
- Alarme de véspera criado automaticamente em toda conta nova, sem configuração manual.
- Menções (@) com autocomplete restrito a membros reais do workspace (evita erro de digitação virando notificação perdida).

Sinais de **possível overhead administrativo** encontrados:
- O cartão de tarefa tem muitos campos opcionais (prioridade, tag/etiqueta, datas, membros, checklist, "aguardando", marco, valor estimado) — não há indicação no código de que campos vazios sejam escondidos por padrão (não confirmado visualmente); risco real de "excesso de opções" mencionado no pedido de auditoria, mas não posso confirmar sem ver a tela renderizada.
- Duas fontes de verdade para "meta" vinculada: `projetos.meta_smart_id` (uma meta por projeto) e `decisoes.meta_smart_id` (uma meta por decisão) — não são a mesma coisa, mas o usuário precisa entender a diferença.
- "Alinhamento Gaiamum" exige que o usuário preencha resultado esperado do projeto, indicadores manuais e mantenha prazos atualizados para gerar um score útil — é uma métrica que depende de disciplina de preenchimento manual em 3 lugares diferentes para funcionar bem, o que é exatamente o tipo de "trabalho de organizar em vez de executar" que o princípio estratégico quer evitar. Vale questionar se isso está valendo o esforço de preenchimento pedido ao usuário.

---

## 18. Performance e custo operacional

- **Cache de sessão/membership**: `proxy.ts` (middleware) resolve o tenant/papel/escopo uma vez e guarda em cookie httpOnly por 5 minutos, evitando 1 round-trip ao Supabase por navegação — medição documentada no código (~300-500ms por consulta "quente"). Nunca usado como fonte de autorização real (RLS é a autoridade), só como dica de UI — comentário explícito sobre esse trade-off de segurança.
- **`cache()` do React** usado corretamente em vários pontos (`buscarMembershipAtual`, `listarPatentesDoUsuario`, `contarNaoLidasCache`) para evitar consultas duplicadas na mesma renderização — sinal de atenção real a N+1 dentro de um request.
- **Polling, não realtime**: o sino de notificações faz polling client-side a cada 60s (comentário em `notificacoes-app.ts`), não usa Supabase Realtime/WebSocket — para o volume atual (piloto fechado) é aceitável; se a base crescer, é uma fonte de carga previsível e linear com número de usuários simultâneos logados.
- **`Promise.all` usado consistentemente** para paralelizar buscas independentes (dashboard, agenda unificada, consolidação de projeto) — não vi padrão N+1 óbvio nos arquivos lidos (loops fazendo query por item dentro de um `for`); a única leitura em loop encontrada foi de escrita em lote pequena (`avatar_itens`, no máximo 10 itens, comentário explícito dizendo que dispensa diff por ser pequeno).
- **Bundle**: dependências relativamente pesadas presentes — BlockNote (editor rico), Mantine, `googleapis` (SDK grande do Google). Não medi o bundle final (não rodei build nesta sessão) — **não confirmado** o tamanho real gerado.
- **`bodySizeLimit: 16mb`** em Server Actions, elevado deliberadamente do padrão de 1MB do Next para suportar upload de anexo até 15MB — decisão documentada, não um esquecimento.
- **Sem cache HTTP/CDN customizado** além do que a Vercel dá por padrão — não encontrei configuração de `revalidate`/ISR além do `unstable_cache` pontual em `metas.ts`.
- **Custo de IA**: baixo hoje, pelas razões da seção 11 (Anthropic não é chamado; Gemini só em 2 pontos com guarda de custo explícita em um deles).
- **Cron duplicado por necessidade, não por erro**: o alarme roda em 2 mecanismos (Vercel 1x/dia + `pg_cron` a cada 15min) — gera mais chamadas HTTP do que o estritamente necessário, mas é uma decisão de engenharia documentada (limite do plano Hobby da Vercel), com proteção contra disparo duplicado (`reivindicar_alarme` atômico).

---

## 19. Segurança

(Nomes de variáveis apenas — nenhum valor de secret foi lido ou é reproduzido aqui.)

**Variáveis de ambiente usadas de fato pelo código** (`grep process.env` em todo `src/`):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_LOGIN_CLIENT_ID`/`SECRET` (login social), `GOOGLE_CALENDAR_CLIENT_ID`/`SECRET` (integração de agenda — **par distinto** do de login), `EMAIL_DONO_SAAS`, `MODO_CADASTRO_FECHADO`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`.

**Achado de dívida técnica real:** `.env.local.example` (o template específico do Gaiamum) lista só 5 dessas 13 variáveis (faltam `GOOGLE_LOGIN_*`, `EMAIL_DONO_SAAS`, `MODO_CADASTRO_FECHADO`, `GEMINI_API_KEY`, `RESEND_*`, `CRON_SECRET`) — quem clonar o projeto do zero hoje não descobre pelo template que precisa configurar essas 8 variáveis. `.env.example` (na raiz, sem "local") é na verdade um template genérico do tooling AIOX (menciona `DEEPSEEK_API_KEY`, `CLICKUP_API_KEY`, `N8N_*`, `RAILWAY_TOKEN` — nada disso é usado pelo Gaiamum), não deve ser confundido com a configuração real da aplicação.

**Autenticação**: Supabase Auth (e-mail/senha) + Google OAuth **próprio** para login (distinto da integração de Calendar, com client ID/secret separados — separação correta de escopo de risco).

**Autorização**: RLS como autoridade final em toda tabela sensível (confirmado por amostragem extensa das 44 migrations), com guards redundantes na aplicação (`exigirOwner`, `exigirGestorOuOwner`, `souDonoDoSaas`) — múltiplos achados de auditoria de segurança **já corrigidos** e documentados no próprio histórico de migrations (ver seção 14: `0004`, `0029`, `0030`, `0040`).

**Tabelas com RLS ligado e propositalmente sem nenhuma policy para o usuário comum** (só service role acessa): `google_calendar_conexoes` (refresh token), `notificacoes_app` insert, `lab_tenants`/`lab_passos`/`patentes_usuario` insert, `acesso_beta_permitido`, `ia_consumo_log` — padrão consistente e correto para dado que só a lógica server-side deve escrever.

**Secrets nunca expostos ao cliente**: refresh token do Google, `CRON_SECRET` (usado para autenticar os endpoints de cron, incluindo via Postgres Vault para o `pg_cron`, nunca commitado — instrução explícita no comentário da migration `0021`), `SUPABASE_SERVICE_ROLE_KEY` usado só em `lib/supabase/service.ts` com `server-only` importado.

**Validação/sanitização**: nome de arquivo sanitizado antes de compor o path de storage (`nomeSanitizado = arquivo.name.replace(/[^\w.\-]/g, "_")`), tamanho de upload limitado (5MB áudio, 15MB anexo, 16MB body de Server Action), valores numéricos validados (`Number.isFinite`) antes de gravar. Não encontrei sanitização de HTML/XSS explícita em texto livre (descrição de tarefa, comentário) — **não confirmado** se o React já cobre isso por padrão (JSX escapa por default, então o risco real é baixo, mas não vi `dangerouslySetInnerHTML` em nenhum ponto lido, o que é positivo).

**Rate limiting**: só encontrado em 1 lugar (convites, 20/hora). Não encontrado em: geração de transcrição de IA, criação de tarefa, login. Risco real baixo hoje (piloto fechado, poucos usuários), mas ausente estruturalmente.

**Isolamento de tenant em chamadas de IA**: confirmado — `tenantId`/`projetoId` sempre vêm de `garantirWorkspace()` (nunca de input direto do cliente) antes de qualquer chamada a Gemini, e o log de consumo por tenant é gravado via service role, não exposto entre tenants.

---

## 20. Testes e confiabilidade

- **Testes automatizados no código do produto: zero.** Nenhum arquivo `*.test.*`/`*.spec.*` existe em `src/`. Os únicos arquivos de teste no repositório pertencem a `.aiox-core/` (ferramental de automação do agente, não é código do Gaiamum).
- **Sem configuração de Jest/Vitest/Playwright/Testing Library** no projeto (nada em `package.json`, nenhum arquivo de config na raiz).
- **Sem CI/CD**: não existe `.github/workflows/`.
- **TypeScript**: usado de forma estrita no código lido — nenhuma ocorrência de `: any` ou `as any` encontrada por busca no `src/` inteiro (achado positivo real, não presumido).
- **Lint**: script `lint` existe (`eslint.config.mjs` presente); não rodei o linter nesta sessão para confirmar se passa limpo.
- **Tratamento de exceção**: consistente nos arquivos lidos — quase toda Server Action verifica `error` do Supabase e lança `Error` com mensagem específica; funções que enviam e-mail sempre envolvem em `try/catch` que nunca propaga falha para o fluxo principal (comentário recorrente: "nunca quebra X por causa do log/e-mail").
- **`console.error`** usado como mecanismo de log de falha não-crítica em vários pontos (envio de e-mail, falha ao criar alarme automático) — não há integração com serviço de observabilidade (Sentry, etc.) confirmada no código (havia `SENTRY_DSN` no `.env.example` genérico do AIOX, mas nenhum `import` de `@sentry/*` encontrado em `src/`, então **não está de fato integrado ao produto**).
- **Confiabilidade em produção**: o handoff do projeto (não parte desta auditoria de código, mas documento correlato) registra testes manuais recorrentes com Playwright contra build de produção isolado antes de cada publicação, com contas de teste descartáveis — ou seja, existe uma disciplina de teste manual/ponta-a-ponta consistente, mas **não automatizada e não repetível sem intervenção humana a cada mudança**.

**Não posso medir cobertura** — não existe, então não há percentual a reportar.

---

## 21. Dívida técnica

| Problema | Evidência | Impacto | Área | Gravidade |
|---|---|---|---|---|
| Zero testes automatizados e zero CI/CD | Ausência confirmada em `package.json` e no repositório | Toda mudança depende de teste manual disciplinado; risco de regressão silenciosa cresce com o tamanho do código (~90 arquivos de lógica) | Todo o produto | **Alta** |
| "Entrevista por IA" (Anthropic) implementada mas não conectada ao fluxo real | `ia.ts` sem call site fora de si mesmo; `entrevista.ts` usa parse de texto colado | Manutenção de código morto; risco de confundir o próximo desenvolvedor sobre o que está "pronto" | Marketing / IA | **Média** |
| `.env.local.example` incompleto (faltam 8 de 13 variáveis reais) | Comparação direta entre `grep process.env` e o arquivo de exemplo | Onboarding de novo ambiente/dev fica sujeito a tentativa e erro | DevOps/Setup | **Baixa** |
| Link "Editar" de Meta SMART não leva a nenhum formulário de edição | `actions.ts:criarMetasSmart` só faz `insert`; `app/onboarding/page.tsx:33-45` não renderiza `FormularioSmart` quando já há metas | Usuário clica "Editar", não consegue editar nada — funcionalidade ausente atrás de um rótulo que promete o contrário | Metas | **Média** (confirmado em código) |
| Financeiro sem visão agregada por projeto (`contas_a_pagar` sem `projeto_id`) | Migration `0008`/`0034` — só `tarefa_id`/`decisao_id` opcionais | Impede relatório "quanto este projeto está custando" sem juntar via tarefa/decisão manualmente | Financeiro / Integração | **Baixa** |
| Parcelamento de despesa não implementado (só forma de pagamento simples) | Comentário explícito na migration `0043` | Usuário com compra parcelada no cartão lança "no olho" ou por fora | Financeiro | **Baixa** (escopo já conhecido e adiado deliberadamente) |
| Sem rate limiting em chamadas de IA (transcrição de áudio) | Ausência confirmada por busca — só convites têm limite de taxa | Exposição a custo inesperado se a base de usuários crescer sem o controle ser adicionado antes | IA / Custo | **Média** |
| Sem observabilidade de erro em produção (Sentry citado só em template genérico não usado) | Nenhum `import` de `@sentry/*` em `src/` | Falhas silenciosas (`console.error`) só são vistas em log da Vercel, exigem ida manual ao dashboard | Confiabilidade | **Média** |
| App do Google Calendar "não verificado" no Google Cloud | Comentário explícito no handoff/código | Todo usuário vê aviso de alerta ao conectar o Calendar; bloqueio formal em 100 usuários | Integração / UX | **Baixa** (aceitável em piloto, vira bloqueante ao escalar) |

---

## 22. Inventário final das funcionalidades

| Módulo | Funcionalidade | Status | Evidência | Observação |
|---|---|---|---|---|
| Auth | Login e-mail/senha | FUNCIONAL | `app/auth/*` | |
| Auth | Login Google | FUNCIONAL | `auth-google.ts`, `auth/callback/google/route.ts` | Client ID/secret distintos do Calendar |
| Auth | Recuperar senha | FUNCIONAL | `app/auth/redefinir-senha/page.tsx` | Não lido linha a linha |
| Onboarding | Metas SMART (médio prazo) | FUNCIONAL | `actions.ts:criarMetasSmart` | Só 1 horizonte oferecido hoje |
| Onboarding | Oferta do Lab pré-onboarding | FUNCIONAL | migration `0036`, `onboarding/lab-ou-direto` | |
| Onboarding | Editar meta SMART existente | **QUEBRADO/POSSÍVEL BUG** (confirmado em código) | `actions.ts:criarMetasSmart` (só `insert`) + `app/onboarding/page.tsx:33-45` (não renderiza formulário se já há metas) | Ver seção 21 |
| Metas SMART | Ciclo completo do módulo (criar → editar → medir progresso direto) | **PARCIAL** | `metas.ts`, `visao-360.ts` | Criação funciona uma vez; edição não existe; "progresso" é só indireto via score de Alinhamento — ver seção 10 |
| Projetos | CRUD de projeto | FUNCIONAL | `actions.ts` | Criar é só owner |
| Projetos | Arquivar/cor/resultado esperado | FUNCIONAL | `actions.ts` | |
| Kanban | Colunas configuráveis + coluna fixa | FUNCIONAL | `actions.ts`, migration `0006` | |
| Kanban | Divisão de coluna em turnos | FUNCIONAL | migration `0044` (29/09/2026, feature muito recente) | |
| Kanban | Cartão completo (membros/checklist/etiqueta/anexo/comentário/menção) | FUNCIONAL | `actions.ts`, `mencoes.ts`, `anexos.ts` | |
| Kanban | Ordem por arrasto (posição fracionária) | FUNCIONAL | migration `0042` | |
| Kanban | Histórico de atividade + e-mail | FUNCIONAL | `atividade.ts`, `notificacoes.ts` | |
| Kanban | "Freeze"/consolidação por e-mail | FUNCIONAL | `actions.ts:enviarConsolidacaoProjeto` | |
| Páginas livres | Editor de blocos (BlockNote) por projeto | FUNCIONAL | `paginas-livres.ts` | Sem hierarquia, lista plana |
| Páginas livres | Detecção de conflito de edição | FUNCIONAL (otimista, não merge) | `atualizarConteudoPaginaLivre` | Não é colaboração real-time |
| Decisões | CRUD por projeto | FUNCIONAL | `decisoes.ts` | Owner-only |
| Indicadores | CRUD manual por projeto | FUNCIONAL | `indicadores.ts` | Sem automação de valor |
| Visão 360° | Score "Alinhamento Gaiamum" | FUNCIONAL | `visao-360.ts` | 100% determinístico |
| Visão 360° | Explicação do score por IA | FUNCIONAL | `explicacao-alinhamento.ts` | Gemini, com otimização de custo |
| Agenda | Unificação (Google + Financeiro + Kanban + eventos + decisões) | FUNCIONAL | `agenda.ts` | |
| Agenda | Sincronização bidirecional com Google | FUNCIONAL | `google-calendar-interno.ts` | App Google não verificado |
| Agenda | Criar evento por voz | FUNCIONAL | `parser-fala-agenda.ts`, `transcricao-audio.ts` | Parser determinístico; IA só na transcrição |
| Agenda | Coluna "Compromissos de hoje" no Kanban | FUNCIONAL | `coluna-compromissos-do-dia.tsx`, `listarCompromissosDoDia` | |
| Alarmes | Genérico (conta/tarefa/evento) + cron duplo | FUNCIONAL | `alarmes.ts`, migrations `0019`/`0021`/`0022` | |
| Financeiro | Contas fixas + geração mensal por cron | FUNCIONAL | `financeiro.ts`, cron `gerar-contas-fixas` | Cron não lido linha a linha |
| Financeiro | Despesas avulsas | FUNCIONAL | `financeiro.ts` | |
| Financeiro | Forma de pagamento | FUNCIONAL | migration `0043` | |
| Financeiro | Parcelamento | **PLANEJADO** | Comentário explícito na `0043` | Fora de escopo deliberadamente |
| Financeiro | Categorização automática | FUNCIONAL | `categorizacao.ts` | Determinística |
| Financeiro | Importação de extrato (CSV) | NÃO CONFIRMADO (arquivo não lido a fundo) | `importacao-extrato.ts`, rota `/financeiro/importar` | `papaparse` confirmado nas deps |
| Financeiro | Anexo de comprovante | FUNCIONAL | `anexos.ts` | |
| Financeiro | Alarme de véspera automático | FUNCIONAL | `criarAlarmeVesperaAutomatico` | |
| Financeiro | Gráficos/dashboard consolidado | NÃO CONFIRMADO (componente não lido) | `consolidacao-global.tsx`, dep `recharts` | |
| Equipe | Convites (workspace e projeto) | FUNCIONAL | `equipe.ts`, `actions.ts` | Rate limit 20/hora |
| Equipe | Papéis owner/member + gestor/usuario | FUNCIONAL | RLS + `equipe.ts` | |
| Equipe | Remover membro (com proteção do último owner) | FUNCIONAL | `actions.ts:removerMembro` | |
| Marketing | Perfil do negócio | FUNCIONAL | `marketing.ts` | Owner-only |
| Marketing | Produtos digitais | FUNCIONAL | `marketing.ts` | |
| Marketing | Avatar do cliente | FUNCIONAL | `marketing.ts` | |
| Marketing | Entrevista guiada por IA (conversacional) | **LEGADO/ÓRFÃO** | `ia.ts` sem call site real | Ver seção 12.2 |
| Marketing | Entrevista (colar texto + parse determinístico) | FUNCIONAL | `entrevista.ts` | Este é o fluxo real |
| Marketing | Mandala de Anúncios (ideias + copy) | FUNCIONAL (fluxo manual, sem IA integrada) | `mandala.ts` | "gerar prompt, colar resposta" |
| Marketing | Página de Venda | NÃO CONFIRMADO em profundidade (schema e rota existem) | migration `0024`, `app/marketing/produtos/[id]/pagina-venda/` | Padrão igual à Mandala, não lido linha a linha |
| Marketing | Roteiro de VSL | NÃO CONFIRMADO em profundidade | migration `0025`, `app/marketing/produtos/[id]/vsl/` | Idem |
| Gaiamum Lab | Onboarding gamificado (case Café do Mangue) | FUNCIONAL | `lab/*`, migrations `0027`/`0035`/`0037`/`0038`/`0039` | Tenant fictício isolado |
| Gaiamum Lab | Patentes (Explorador/Estrategista/Master) | FUNCIONAL | `patentes.ts` | Por conta, não por workspace |
| Gaiamum Lab | Progresso por passo | FUNCIONAL | `progresso.ts` | |
| Gaiamum Lab | Reengajamento por e-mail (48h) | FUNCIONAL | cron `reengajamento-lab`, `notificacoes.ts` | Cron não lido linha a linha |
| Admin | Allowlist de acesso beta | FUNCIONAL | `acesso-beta.ts` | Restrito a `EMAIL_DONO_SAAS` |
| Admin | Analítica de IA/Lab | NÃO CONFIRMADO em profundidade | rota `/admin/analitica-lab` | Página não lida linha a linha |
| Notificações | Sino in-app (polling 60s) | FUNCIONAL | `notificacoes-app.ts` | |
| Notificações | E-mail (Resend) — atividade, convite, alarme, consolidação, reengajamento | FUNCIONAL | `notificacoes.ts` | Domínio próprio ainda não verificado no Resend (comentário no código) |

---

## 23. O que o Gaiamum é hoje

O Gaiamum hoje é uma **aplicação web de gestão pessoal/pequena-equipe, multi-tenant, com um núcleo de Kanban muito completo** (comparável em profundidade de cartão a um Trello com vários Power-Ups nativos), **uma Agenda genuinamente unificada** com sincronização bidirecional real ao Google Calendar, **um Financeiro pessoal do dono do workspace** (contas fixas recorrentes + avulsas + alarme automático), uma **camada leve de estratégia de projeto** (Meta SMART → Decisões → Indicadores → um score determinístico de alinhamento, opcionalmente explicado em texto por IA), um **bloco de notas por projeto** com editor rico mas sem hierarquia, um **módulo de Marketing/conteúdo digital** que hoje funciona majoritariamente no modo "gerar prompt para copiar, colar resposta manualmente" (não como IA integrada), e um **onboarding gamificado paralelo** (Gaiamum Lab) tecnicamente sólido e isolado do workspace real do usuário. É um produto em piloto fechado (allowlist), em produção real, com histórico de desenvolvimento rápido e disciplinado (~1 migration/dia, correções de segurança documentadas e aplicadas em horas), sem testes automatizados, sem CI/CD, dependente inteiramente de teste manual disciplinado antes de cada publicação.

## O Gaiamum ainda não é

Ainda não é um produto onde **a IA funciona como camada estratégica sobre os dados reais** — isso é, hoje, uma fórmula determinística (o score de Alinhamento) com uma frase de IA opcional por cima, não um sistema que lê tarefas atrasadas, cruza com metas e financeiro, e sugere prioridade ou risco de forma proativa (os exemplos citados na visão estratégica — "identificar riscos", "relacionar execução e metas", "sugerir próximos passos" — não têm implementação real hoje). Ainda não é um Notion (sem hierarquia de páginas, sem base de dados/tabela dentro de uma página, sem colaboração em tempo real). Ainda não é uma ferramenta financeira de equipe (é estritamente pessoal do owner). Ainda não tem um módulo de Metas com ciclo de vida completo (criar depois do dia 1, editar sem risco de duplicar, medir progresso diretamente). Ainda não tem rede de segurança automatizada contra regressão (zero testes, zero CI) — a confiabilidade de cada mudança depende inteiramente da disciplina manual de quem está codando.

---

## 24. Evidências (índice de referência rápida)

Todas as afirmações técnicas relevantes deste documento já trazem `arquivo:linha` ou `arquivo:função` inline, no formato pedido (ex.: `src/lib/ecc/kanban.ts:urgenciaDoPrazo`). Os arquivos mais centrais para uma inspeção adicional, em ordem de relevância:
`src/lib/ecc/actions.ts` (Kanban/Projetos/Equipe), `src/lib/ecc/financeiro.ts`, `src/lib/ecc/agenda.ts`, `src/lib/ecc/visao-360.ts` + `explicacao-alinhamento.ts`, `src/lib/ecc/ia.ts` + `gemini.ts` (IA), `src/lib/ecc/workspace.ts` + `membership.ts` + `equipe.ts` (segurança/multiusuário), `supabase/migrations/*.sql` (fonte de verdade do schema e das regras de acesso).

## 25. Arquivo de saída

Este documento: `GAIAMUM-HANDOFF-CANONICO-ESTADO-ATUAL.md`, raiz do repositório (`c:\Users\proff\Documents\Gaiamum\GAIAMUM-HANDOFF-CANONICO-ESTADO-ATUAL.md`).

---

## 26. Questões para decisão estratégica

Não respondidas aqui — cabem ao Product Owner antes de qualquer mudança relevante:

1. O código de entrevista conversacional via Anthropic (`ia.ts`) deve ser **ativado** (trocando o fluxo atual de "colar texto") ou **removido** para não confundir manutenção futura? Se ativado, qual controle de custo/rate limit entra junto?
2. Confirmado que hoje não existe nenhuma forma de editar uma Meta SMART depois de criada (o link "Editar" do dashboard leva a uma tela sem formulário) — isso deve virar uma edição de verdade (`upsert`), e com que prioridade?
3. Vale a pena dar ao Financeiro uma visão agregada por projeto (mesmo mantendo owner-only por acesso), para responder "quanto este projeto custou" sem juntar manualmente tarefas e decisões?
4. Parcelamento de despesa (adiado desde a sessão que criou a migration `0043`) — quando entra no roadmap, e a estrutura sugerida no próprio comentário do código (FK "pai" reaproveitando `conta_fixa_id`, ou tabela nova) é a direção certa?
5. Zero testes automatizados é um risco aceitável no piloto atual — em que marco (número de usuários? número de módulos? primeira contratação de dev além do Fabio?) isso deixa de ser aceitável e vira prioridade?
6. Observabilidade de erro em produção (hoje só `console.error` + log da Vercel) — vale integrar Sentry (ou equivalente) antes ou depois de abrir comercialmente?
7. Verificação do app Google Cloud (Calendar) exige vídeo de demonstração e trabalho de compliance — em que momento isso deixa de ser adiável (hoje bloqueia a partir de 100 usuários)?
8. O modelo "Gaiamum Lab roda num tenant fictício isolado, sem cruzar com dados reais" deve continuar assim para sempre, ou em algum momento faz sentido o Lab usar (ou influenciar) dados reais do workspace do usuário (ex.: sugerir replicar uma estrutura do case fictício no projeto real)?
9. Rate limiting ausente em chamadas de IA (transcrição de voz) — vale endereçar antes ou depois do cadastro abrir (hoje mitigado só pelo volume baixo do piloto fechado)?
10. A visão estratégica de "IA como camada sobre dados reais" (identificar riscos, relacionar execução e metas, sugerir próximos passos) — qual desses exemplos é a prioridade real de próximo incremento, dado que hoje nenhum existe?
