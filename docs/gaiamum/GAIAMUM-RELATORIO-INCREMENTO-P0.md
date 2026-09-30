# Gaiamum — Relatório do Incremento P0 (Confiabilidade e Metas)

**Data:** 2026-09-30
**Branch:** `consolidacao/p0-confiabilidade-metas` (criada a partir de `main`, não mesclada, não publicada)
**Executor:** Claude Code (Sonnet 5), sessão única, seguindo `Gaiamum-Prompt-Consolidacao-Inteligente-v1.txt`

---

## 1. O que mudou para o usuário e riscos reduzidos

- **"Editar" Meta SMART agora edita de verdade.** Antes, o link "Editar →" do dashboard levava a uma tela que, com metas já salvas, não mostrava formulário nenhum — só uma mensagem e um botão pra "/projetos". Agora a mesma tela reabre o formulário preenchido com os valores atuais; salvar atualiza a meta existente (mesmo `id`, vínculos com projetos/decisões preservados), nunca cria uma segunda.
- **"Pular, preencho depois" não empurra mais de volta pro onboarding em toda visita seguinte.** Antes, o Painel geral (`/`) redirecionava pra `/onboarding` sempre que não houvesse meta salva — mesmo pra quem já tinha escolhido pular. Agora essa decisão fica registrada; o dashboard mostra um convite simples pra criar a meta quando quiser, sem bloquear o resto do trabalho.
- **Clique duplo no botão "Salvar metas" nunca duplica a meta.** Um índice único no banco (não só uma trava na tela) garante isso mesmo se dois cliques chegarem quase juntos.
- **Chamadas de IA (transcrição de voz, explicação do Alinhamento Gaiamum) agora têm limite de uso.** Antes, nenhuma das duas tinha proteção contra uso excessivo — um usuário autenticado podia gerar chamadas pagas sem limite algum. Agora há 3 camadas de limite (por pessoa, por workspace, pro Gaiamum inteiro), e uma tentativa bloqueada nunca chega a custar nada (o bloqueio acontece antes de chamar o provedor).
- **Os 3 crons (alarmes, contas fixas mensais, reengajamento do Lab) agora deixam rastro localizável quando algo falha.** Antes, uma falha só aparecia no corpo de uma resposta HTTP que ninguém consulta manualmente — agora fica um registro estruturado no log da Vercel, com um id que também aparece na resposta.
- **Existe, pela primeira vez, uma rede de testes automatizados e um CI** que roda em todo push/PR: lint, checagem de tipos, 55 testes de regras de negócio, e o build de produção. Isso não muda nada que o usuário vê diretamente, mas reduz o risco de uma mudança futura quebrar algo sem ninguém perceber antes de publicar.

**Nada disso foi publicado em produção.** Tudo está numa branch local, sem push, sem deploy, sem migration aplicada em nenhum banco.

---

## 2. Arquivos e documentos alterados

**Código (correção de metas/onboarding):**
- `src/lib/ecc/actions.ts` — `criarMetasSmart` → `salvarMetasSmart` (upsert real); `pularOnboarding` grava estado.
- `src/lib/ecc/metas.ts` — novas `listarMetasSmart`, `onboardingDeMetasFoiPulado`.
- `src/app/onboarding/page.tsx` — busca metas existentes, sempre renderiza o formulário.
- `src/app/page.tsx` — não força redirect pra quem já pulou; CTA quando não há meta.
- `src/components/onboarding/formulario-smart.tsx` — aceita `metasExistentes`, pré-preenche campos.
- `src/components/onboarding/botao-salvar.tsx` — rótulo customizável ("Salvar alterações" em modo edição).

**Código (rate limit de IA):**
- `src/lib/ecc/ia-rate-limit.ts` (novo) — `verificarRateLimitIA`, `inicioDoMinuto`, `inicioDaHora`.
- `src/lib/ecc/transcricao-audio.ts` — checagem antes de chamar o Gemini.
- `src/lib/ecc/explicacao-alinhamento.ts` — idem.

**Código (observabilidade):**
- `src/lib/observabilidade.ts` (novo) — `registrarErro`, `registrarInfo`, `gerarIdCorrelacao`.
- `src/app/api/cron/disparar-alarmes/route.ts`, `gerar-contas-fixas/route.ts`, `reengajamento-lab/route.ts` — log estruturado.

**Migrations (preparadas, NÃO aplicadas em nenhum ambiente):**
- `supabase/migrations/0045_onboarding_pulado_e_upsert_metas.sql` — índice único `(tenant_id, horizonte)` em `metas_smart`; coluna `tenants.onboarding_metas_pulado_em`.
- `supabase/migrations/0046_rate_limit_ia.sql` — tabela `ia_rate_limit`, função `ia_registrar_tentativa` (com `revoke` de `EXECUTE` público, mesmo padrão de segurança de `reivindicar_alarme`).

**Testes (novos):**
- `vitest.config.ts`, `tests/setup/server-only-stub.ts`
- `src/lib/ecc/__tests__/{kanban,parser-fala-agenda,categorizacao,visao-360,mencoes,ia-rate-limit}.test.ts`
- `src/lib/__tests__/observabilidade.test.ts`
- `tests/integration/{helpers,rls-isolamento,rls-financeiro-owner-only,metas-smart-upsert}.test.ts`
- `tests/integration/README.md`

**CI/config:**
- `.github/workflows/ci.yml` (novo)
- `package.json` — scripts `test`/`test:watch`/`test:integration`; dependência `vitest` adicionada
- `.env.local.example` — completado (faltavam 8 das 13 variáveis realmente usadas pelo código, achado já registrado na auditoria de 2026-09-30)

**Documentação (novos):**
- `docs/gaiamum/GAIAMUM-BLUEPRINT-PRODUTO-v1.md`
- `docs/gaiamum/GAIAMUM-BACKLOG-CONSOLIDACAO.md`
- `docs/gaiamum/GAIAMUM-RELATORIO-INCREMENTO-P0.md` (este arquivo)

**Handoff histórico:** `docs/handoffs/HANDOFF-GAIAMUM-CLAUDE-CODE.md` recebe uma entrada nova de checkpoint (não reescreve nada do passado).

---

## 3. Migrations — conteúdo e rollback

Nenhuma das duas foi aplicada em nenhum banco (local, homologação ou produção) nesta sessão — ficam preparadas para revisão e aplicação manual.

**`0045_onboarding_pulado_e_upsert_metas.sql`:**
- Pré-requisito documentado dentro do próprio arquivo: rodar a query de detecção de duplicata em `(tenant_id, horizonte)` antes de aplicar em qualquer ambiente com dado real (o índice único falha ao criar se já houver duplicata) — não foi possível confirmar essa checagem contra o banco de produção real nesta sessão (ver Impedimentos).
- Rollback: `drop index metas_smart_tenant_horizonte_unico; alter table tenants drop column onboarding_metas_pulado_em;`

**`0046_rate_limit_ia.sql`:**
- Aditiva, sem risco de conflito com dado existente (tabela nova).
- Rollback: `drop function ia_registrar_tentativa(text, text, timestamptz, integer); drop table ia_rate_limit;`

---

## 4. Testes e checagens executados — resultados reais

| Checagem | Resultado | Comando |
|---|---|---|
| Baseline (antes de qualquer mudança) | `tsc` limpo, lint com 3 warnings pré-existentes (mesmos do handoff canônico), build OK (39 rotas) | `npx tsc --noEmit`, `npm run lint`, `npm run build` |
| `tsc --noEmit` após todas as mudanças | **Limpo, sem erro** | idem |
| `npm run lint` após todas as mudanças | **3 problems (0 errors, 3 warnings)** — os mesmos 3 de antes, nenhuma regressão | idem |
| `npm run build` após todas as mudanças | **Sucesso, 39 rotas** (mesma contagem de antes) | idem |
| `npm test` (Vitest, unitários) | **55 testes passando, 7 arquivos, 0 falha** | `npx vitest run` |
| Testes de integração/RLS | **NÃO EXECUTADOS** — 14 testes, todos `skipped` automaticamente (sem `SUPABASE_TEST_URL`/`SUPABASE_TEST_SERVICE_ROLE_KEY`) | ver seção 5 |
| Build só com env vars fictícias (simulando o CI real, sem `.env.local`/`.env` reais) | **Sucesso** — `.env.local`/`.env` movidos temporariamente, build rodado só com os 3 placeholders do workflow, depois restaurados (confirmado por timestamp idêntico ao original) | ver histórico de comandos desta sessão |

**Nenhum teste foi marcado como passando sem ter rodado de verdade.** Nenhuma regra foi ignorada pra "aparentar sucesso" (lint sem regra suprimida, nenhum `it.skip` fora dos testes de integração — que são pulados por falta de infraestrutura, com motivo explícito, não por conveniência).

---

## 5. Impedimento externo (declarado, não contornado)

**Docker Desktop indisponível neste ambiente** — nem `docker ps` conecta (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`), nem o binário existe no caminho padrão do Windows (`C:\Program Files\Docker\Docker\Docker Desktop.exe` não encontrado). Sem ele, `npx supabase start` não sobe um Postgres local, e não há como:

- Aplicar as migrations 0045/0046 e confirmar que rodam sem erro contra um schema real.
- Rodar os 14 testes de integração/RLS (`tests/integration/`) e confirmar de verdade o isolamento entre tenants e o comportamento do upsert de metas.
- Validar as Server Actions (`salvarMetasSmart`, `pularOnboarding`, `verificarRateLimitIA`) num fluxo real de ponta a ponta (elas dependem de `cookies()`/sessão do Next, fora do alcance de um teste unitário puro).

**O que isso significa na prática:** todo o código deste P0 está no estado **IMPLEMENTADO NÃO VALIDADO** (ver `GAIAMUM-BACKLOG-CONSOLIDACAO.md`) exceto a parte que não depende de banco (lógica de janela do rate limit, logger estruturado, e o fato de tudo compilar/buildar). Isso não é "pronto pra piloto" — é pronto pra revisão e para validação assim que houver um Postgres de teste disponível (Docker local funcionando, ou um projeto de homologação isolado no Supabase Cloud).

**O que eu faria a seguir, se destravado:** subir `npx supabase start`, aplicar as 2 migrations novas, rodar `npm run test:integration` com as env vars apontando pro banco local, e só então considerar este P0 validado de ponta a ponta.

---

## 6. Instruções curtas para teste visual (assim que quiser rodar localmente)

1. `npm run dev` (usa seu `.env.local` real, sem tocar produção).
2. Entrar com uma conta de teste que já tenha meta SMART salva → clicar "Editar →" no dashboard → confirmar que o formulário abre preenchido, editar um campo, salvar → confirmar que voltou pra `/projetos` e que a mudança persistiu (reabrir "Editar →" de novo).
3. Com uma conta nova (sem meta), no onboarding clicar "Pular, preencho depois" → ir pra `/` → confirmar que NÃO volta a forçar o onboarding, e que aparece "Você ainda não definiu suas metas SMART" com um link "Criar agora".
4. (Requer `GEMINI_API_KEY` configurada) Gerar a explicação do Alinhamento Gaiamum várias vezes seguidas rapidamente num mesmo projeto → confirmar que, a partir da 4ª chamada no mesmo minuto, aparece a mensagem de limite em vez de gastar uma chamada nova.

---

## 7. Impacto em custo/dependências, rollback e configuração pendente

- **Dependência nova:** `vitest` (dev dependency, não entra no bundle de produção, sem custo).
- **Nenhum serviço pago novo** foi criado ou proposto para ativação automática.
- **Rollback do código:** a branch inteira pode ser descartada sem afetar `main` (nunca foi mesclada).
- **Rollback das migrations:** ver seção 3 — nenhuma foi aplicada, então não há nada a reverter em produção agora; os comandos de rollback estão documentados para quando forem aplicadas.
- **Configuração pendente antes de aplicar em produção:**
  - Rodar a query de detecção de duplicata em `metas_smart` (ver comentário na migration 0045) contra o banco de produção real antes de aplicar o índice único.
  - Opcional: definir `IA_LIMITE_POR_USUARIO_MINUTO`/`IA_LIMITE_POR_WORKSPACE_HORA`/`IA_LIMITE_GLOBAL_HORA` na Vercel (senão usa os defaults conservadores do código: 3/min, 20/hora, 200/hora).
  - Nenhuma variável de ambiente nova é **obrigatória** — tudo tem default seguro.

---

## 8. P1/P2 — confirmação

Documentados por completo em `GAIAMUM-BACKLOG-CONSOLIDACAO.md`, com critérios de aceite e dependências. **Nada de P1/P2 foi implementado nesta sessão.** Nenhum cadastro foi aberto, nenhum e-mail foi enviado a usuário real, nenhuma migration foi aplicada, nenhum deploy foi feito.

**Próximo passo recomendado:** revisão deste relatório (e do Blueprint/Backlog) pelo ChatGPT antes de iniciar qualquer item do P1 — conforme pedido no prompt de consolidação.

---

## 9. Questões que ficaram sem resposta nesta sessão (peço decisão do Product Owner)

1. Quando o Docker Desktop estiver disponível, aplicar as migrations 0045/0046 num Supabase local e rodar `npm run test:integration` de verdade é o próximo passo óbvio — confirma que devo fazer isso na próxima sessão antes de considerar o P0 fechado?
2. Os limites default de rate limit de IA (3/usuário/min, 20/workspace/hora, 200 global/hora) são um chute conservador de engenharia, não uma decisão de produto/negócio — servem para o piloto de 5–10 pessoas, ou você já tem um número em mente?
3. Observabilidade externa (Sentry ou equivalente, free tier) — confirmo que fica fora até você decidir explicitamente, mesmo depois do P0 fechado?
