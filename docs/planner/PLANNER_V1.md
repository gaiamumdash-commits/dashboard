# Planner V1 — Gaiamum

**Data:** 2026-10-07 · **Migration:** `supabase/migrations/0057_planner.sql` · **Mockup aprovado:** `docs/gaiamum/mockups/planner-mockup-aprovado-2026-10-07.jpg`

## 1. Visão do produto

O Planner é a camada de organização da vida pessoal dentro do Gaiamum (Pessoal, Estudos, Casa, Saúde), ligada aos módulos que já existem. O ciclo é ORGANIZAR → EXECUTAR → ACOMPANHAR → APRENDER → REORGANIZAR.

Ele **não** é um clone de Notion ou xTiles e **não** duplica Agenda, Tarefas, Metas ou Financeiro. Quando o dado já existe em outro módulo, o Planner lê de lá. Só fica no Planner o que é exclusivo dele: hábitos, rotinas, leituras, cursos, cardápio, compras, pets, manutenções, objetivos pessoais e notas.

## 2. Decisões tomadas (Fabio, 2026-10-07)

| # | Decisão | Por quê |
|---|---|---|
| 1 | **Dado do Planner é privado de cada pessoa.** Toda linha tem `user_id` + `tenant_id`, e nem o owner do workspace vê o Planner de um membro. | Hábito, consulta médica e cardápio são vida pessoal. Tudo que existia antes (`eventos_agenda`, `metas_smart`) é do workspace inteiro. |
| 2 | **Objetivos pessoais ficam numa tabela leve própria** (`planner_objetivos`). As Metas SMART aparecem só como referência, em leitura. | `metas_smart` aceita no máximo 1 meta por horizonte por workspace, é estratégia do negócio e a equipe vê. Estendê-la mexeria no onboarding e na Meta principal do Painel. |
| 3 | **O Planner guarda as datas e a Agenda as lê.** Consultas, compromissos de pet e manutenções ficam no Planner, e `listarAgendaUnificada` passou a ler essas tabelas como a fonte `planner`. | Criar `eventos_agenda` exporia a consulta à equipe e espelharia no Google. Ler como fonte é o mesmo padrão de contas, tarefas e decisões, sem uma segunda agenda. |

Outras decisões de implementação:
- **Hábito e rotina usam o mesmo motor** (`planner_habitos.tipo`). Rotina tem horário e aparece no card "Hoje" na hora certa; hábito é acompanhamento de consistência. As rotinas da casa **não** reaproveitam `tarefas`: tarefa é cartão de Kanban de projeto, do time e sem recorrência.
- **"Sugestão do Gaiamum" é calculada, não é IA** (`sugestaoDaSemana`). Por isso o título não diz "IA". "Reorganizar minha semana" e "Planejar com IA" aparecem desabilitados, com "Em breve", sem integração falsa.
- **Server Actions devolvem `{ ok, erro }`** em vez de lançar exceção, para a mensagem em português chegar à tela também em produção (o Next redige o texto de `throw`).
- **O menu Planner aparece para todos**, inclusive para quem foi convidado só para um quadro, porque o Planner é pessoal. Quem não tem acesso completo não vê a Agenda do workspace dentro do card "Hoje".

## 3. Arquitetura

```
src/lib/ecc/planner/
├── tipos.ts         tipos das tabelas + ResultadoAcao
├── regras.ts        lógica pura: semana ISO, consistência, minutos, manutenção, validação
├── painel.ts        lógica pura: Hoje, Foco de hoje, Esta semana, resumo dos 4 cards
├── dados.ts         leituras no servidor (server-only), consultas paralelas por página
├── actions.ts       Server Actions (CRUD), tenant pela sessão, user_id pelo banco
└── proposta-ia.ts   contrato (zod) da futura proposta de IA, sem chamada de modelo
src/app/planner/page.tsx          Meu Planner (mockup)
src/app/planner/[area]/page.tsx   Pessoal | Estudos | Casa | Saúde, sub-abas em ?aba=
src/components/planner/*          cards, grade de hábitos, seções por área, formulários
src/components/layout/grupo-navegacao-planner.tsx   grupo expansível do menu
```

## 4. Entidades (migration 0057)

| Tabela | Uso | Relacionamentos |
|---|---|---|
| `planner_habitos` | hábitos e rotinas: área, tipo, `dias_semana` (ISO 1–7), horário, duração, ativo | — |
| `planner_habito_registros` | "fiz neste dia" (uma linha por hábito por dia, com unique) | → `planner_habitos` (cascade) |
| `planner_objetivos` | objetivos pessoais por área, com prazo e status | — |
| `planner_notas` | notas de texto por área | — |
| `planner_leituras` | título, autor, status (quero ler/lendo/concluído), progresso, datas | — |
| `planner_cursos` | cursos e idiomas (`tipo`), objetivo, frequência, progresso, link | — |
| `planner_compras` | lista de compras por categoria | — |
| `planner_cardapio` | célula (semana-segunda, dia, refeição), com unique | — |
| `planner_pets` | nome, tipo, notas | — |
| `planner_compromissos` | consulta, pet ou outro, com data/hora; **lido pela Agenda** | → `planner_pets` (set null) |
| `planner_manutencoes` | última vez, próxima data, recorrência em meses; **próxima data lida pela Agenda** | — |
| `planner_preferencias` | áreas escolhidas no primeiro acesso | PK (user, tenant) |

**Rollback:** nenhuma tabela existente foi alterada. Para reverter, é o `drop table ... cascade` documentado no topo da migration.

## 5. Segurança / RLS

- Uma regra única, `planner_eh_meu(user_id, tenant_id)`: `user_id = auth.uid()` **e** `tenant_id in current_tenant_ids()`. Ela vale em `for all` (select/insert/update/delete) nas 12 tabelas.
- `user_id` tem default `auth.uid()`. As Server Actions nunca enviam esse campo, e o `with check` recusa valor forjado.
- O registro de hábito só aponta para um hábito **da própria pessoa** no mesmo workspace. O compromisso só aponta para um pet da própria pessoa.
- Quem sai do workspace perde o acesso às linhas que deixou lá.
- `grant` explícito só para `authenticated`. O anônimo não lê nada. Isso também prepara para a aposentadoria do `auto_expose_new_tables` no Supabase (2026-10-30).
- Nenhum uso de service role no Planner.
- Provado em `tests/integration/rls-planner.test.ts` (13 cenários, USER_A × USER_B no mesmo workspace e entre workspaces).

## 6. Integrações

| Com | Como |
|---|---|
| **Agenda** | `listarAgendaUnificada(..., incluirPlanner = true)` lê compromissos e manutenções do Planner (fonte `planner`, cor lime, sem alarme na V1). O card "Hoje" e o "Esta semana" leem a Agenda real (Google, tarefas com prazo, contas, decisões, eventos) com `incluirPlanner = false`, para não repetir itens. O Lab passa `false`. |
| **Tarefas (Kanban)** | Tarefas com prazo aparecem no "Hoje" e no "Esta semana" via Agenda, só com link: o Planner nunca marca tarefa de projeto. |
| **Metas SMART** | Aparecem em leitura nas abas Objetivos (Pessoal) e Metas (Estudos), com link para editar em Metas SMART. |
| **Financeiro** | Nenhuma: não existe `/planner/financeiro`. Contas aparecem só via Agenda, com link para o Financeiro. |

## 7. Rotas

`/planner` · `/planner/pessoal` (visao, rotina, habitos, objetivos, notas) · `/planner/estudos` (visao, metas, rotina, leituras, cursos, idiomas) · `/planner/casa` (visao, rotinas, compras, cardapio, pets, manutencoes) · `/planner/saude` (visao, rotina, consultas, habitos, bem-estar). Sub-aba em `?aba=`.

## 8. Implementado

- Menu com o grupo Planner expansível e estado ativo por rota.
- Meu Planner no layout do mockup: hero com saudação pelo usuário logado e "Foco de hoje", sugestão calculada, 4 cards de área com anel de consistência e indicadores reais, Hoje, Meus hábitos (grade S T Q Q S S D) e Esta semana (placar N/M).
- Hábitos e rotinas: criar, editar, arquivar, reativar, excluir, marcar e desmarcar (sem dia futuro), com acompanhamento semanal.
- **Tudo é editável depois de criado** ("Editar" abre o mesmo formulário já preenchido): hábitos e rotinas, compromissos e consultas (título, data/hora, local, notas, pet), leituras, cursos e idiomas, manutenções, objetivos, pets e notas. Criar e editar usam a mesma validação (`src/lib/ecc/planner/validacao.ts`), então as duas regras nunca divergem.
- Pessoal, Estudos, Casa e Saúde com todas as sub-abas pedidas.
- Estados de UX: skeleton (`loading.tsx`), vazio por seção, primeiro acesso (boas-vindas com escolha de áreas), erro por toast e no formulário, botão desabilitado durante a ação, atualização otimista com reversão.
- Responsivo: ordem no celular saudação/foco → hoje → hábitos → áreas → semana → sugestão. Abas com rolagem horizontal, sem overflow (verificado em 25 rotas a 390px).
- Acessibilidade: checkboxes com `role="checkbox"` e `aria-checked`; estado no rótulo (nunca só cor, com ✓ visível); tabelas com `caption`, `th scope` e `abbr` nos dias; foco visível; dá para marcar e desmarcar pelo teclado (testado).

## 9. Adiado de propósito

- **IA** ("Planejar com IA" e "Reorganizar minha semana"): só o contrato (`proposta-ia.ts`) e os botões "Em breve".
- Alarmes para itens do Planner (o `alarmes.entidade_tipo` não aceita esses tipos; seria uma migration a mais).
- Espelhar compromissos do Planner no Google Calendar (decisão 3).
- Navegar para semanas passadas ou futuras no Planner (hoje: só a semana atual).
- Saúde clínica (prontuário, exames, medicação): fora do escopo por definição.

## 10. Limitações conhecidas

- Uma rota inválida (ex.: `/planner/financeiro`) mostra a página 404, mas com HTTP 200. É comportamento do Next com `loading.tsx`, que envia o status antes do `notFound()`.
- O nome na saudação vem do e-mail (`primeiroNome`, igual ao Painel). Não existe campo de nome no sistema.
- O `Dialog` compartilhado não tem focus trap nem Escape (limitação já existente, não alterada aqui).

## 11. Próximos passos sugeridos

1. Fabio aplicar a migration 0057 em produção **antes** do deploy.
2. Fase 2 da IA no Planner, reaproveitando o padrão do planejamento de projetos (prompt copiável → prévia → confirmação), já com o contrato pronto.
3. Alarme para consulta e manutenção (estender `alarmes.entidade_tipo`).
