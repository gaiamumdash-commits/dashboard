# Gaiamum — Relatório do Incremento P0 (Confiabilidade e Metas)

**Data:** 2026-09-30 (implementação) + 2026-09-30 (validação, mesma data, sessão seguinte)
**Branch:** `consolidacao/p0-confiabilidade-metas` (criada a partir de `main`, não mesclada, não publicada)
**Executor:** Claude Code (Sonnet 5)

Este relatório tem 2 rodadas registradas: a implementação inicial (seções 1-3) e a **validação real** que a revisou, corrigiu um desvio de especificação e provou boa parte do código contra banco de verdade (seções 4 em diante — é aqui que está o que realmente importa pra decidir se o P0 pode ser considerado fechado).

---

## 1. O que mudou para o usuário e riscos reduzidos

- **"Editar" Meta SMART agora edita de verdade** — **confirmado numa aplicação rodando de verdade, não só por leitura de código** (seção 6). O link "Editar →" do dashboard reabre o formulário preenchido; salvar atualiza a meta existente (mesmo `id`, vínculos com projetos/decisões preservados), nunca cria uma segunda — mesmo em clique duplo.
- **"Pular, preencho depois" não empurra mais de volta pro onboarding** — **confirmado ao vivo**: usuário que pulou, visitou "/" e não foi redirecionado; viu um CTA "Criar suas metas →" em vez disso; criou a meta depois e funcionou normalmente.
- **Chamadas de IA (transcrição de voz, explicação do Alinhamento Gaiamum) agora têm limite de uso em 3 camadas**, atômico no Postgres — **provado sob concorrência real** (10 chamadas simultâneas, limite 5 → exatamente 5 permitidas e 5 bloqueadas, contagem exata na tabela, nenhuma perdida nem duplicada).
- **Os 3 crons deixam rastro localizável quando algo falha** — logger estruturado, aplicado, compila e builda; **não validado em execução real de cron** nesta sessão (não é uma Server Action testável isoladamente sem disparar o endpoint de verdade contra dados reais de alarme/conta — ver matriz, seção 9).
- **Existe, pela primeira vez, uma rede de testes automatizados**: **92 testes passando de verdade** (63 unitários + 29 de integração contra Postgres real, usando identidades comuns, não `service_role`, pra provar autorização de verdade). CI (GitHub Actions) criado e validado localmente (build roda só com env vars fictícias) — **nunca rodou no GitHub remoto** (branch não publicada, ver seção 8).

**Achado de segurança novo, descoberto durante esta validação (fora do escopo original do P0):** `membros_do_tenant()` vaza e-mail de todo o workspace pra quem tem só `escopo: 'projeto'` — ver seção 7.3. Reportado, não corrigido (expandiria o escopo do P0).

**Nada foi publicado em produção.** Migrations aplicadas SÓ num Postgres local isolado, criado e destruído dentro desta sessão — nunca em produção nem em nenhum projeto Supabase Cloud.

---

## 2. Revisão crítica da implementação de Metas SMART (pedido explícito da validação)

### 2.1 Update explícito, não upsert genérico — corrigido nesta rodada

A primeira versão de `salvarMetasSmart` usava `.upsert(linhas, {onConflict: "tenant_id,horizonte"})`. **Isso divergia da instrução original** ("Criar update explícito autorizado; não usar upsert genérico que possa inserir meta duplicada ou trocar ownership"). Era funcionalmente seguro (nunca duplicava — índice único; nunca trocava tenant — `tenant_id` sempre vem de `garantirWorkspace()`), mas não era a operação pedida.

**Corrigido** (`src/lib/ecc/actions.ts:salvarMetasSmart`) para, por horizonte:
1. Buscar o `id` já existente daquele horizonte no tenant.
2. **Existe → `UPDATE ... WHERE id = <id> AND tenant_id = <tenantId>`** (explícito, defesa em profundidade redundante com a RLS). Nunca toca `id`/`criado_em`/`tenant_id` da linha.
3. **Não existe → `INSERT`**. Se colidir (dois requests quase simultâneos, erro `23505` do índice único) → resolvido como edição de verdade (busca o id que o outro request criou, faz `UPDATE` nele) — nunca perde a submissão, nunca duplica.

### 2.2 Autorização e ownership

- `tenantId` sempre vem de `garantirWorkspace()` — nunca de input do cliente. Não há caminho pelo qual esta função trocaria o dono de uma meta de outro tenant.
- Nenhuma checagem de papel (owner vs. member) dentro da função — é **intencional, não um gap**: a RLS de `metas_smart` ("so quem tem acesso completo ao workspace") já é a regra de autorização real, e é a mesma de antes da correção — **não mudei quem pode editar**, conforme pedido ("Manter a regra atual de quem pode editar metas, confirmando-a no código/RLS"). Confirmado nos testes de integração (seção 6): um usuário de outro tenant tentando `UPDATE` direto por `id` conhecido recebe 0 linhas afetadas, sem erro — RLS bloqueia no banco, não só na aplicação.

### 2.3 O que o índice único `(tenant_id, horizonte)` impede, exatamente

Impede **duas linhas de `metas_smart` com o mesmo `tenant_id` E o mesmo `horizonte`**. Não impede (nem deveria): tenants diferentes terem cada um sua própria meta "medio_prazo" (normal); o mesmo tenant ter uma meta "medio_prazo" **e** uma "longo_prazo" ao mesmo tempo (são horizontes diferentes — o índice é composto, não só em `tenant_id`).

### 2.4 "Não elimine metas existentes para fazer o índice passar"

Não apliquei nada em banco com dado real nesta sessão — o índice foi criado só contra um Postgres de teste vazio (seção 5), nunca contra produção. O comentário de pré-requisito na própria migration (rodar a query de detecção de duplicata antes de aplicar em qualquer ambiente com dado real) continua de pé, não executado contra produção, e **nenhuma linha foi apagada em lugar nenhum** para fazer esse índice "passar" — ele passou porque o banco de teste nasceu vazio, não por remoção de dado.

### 2.5 Preservação de vínculos — provado, não só argumentado

Teste de integração real (`metas-smart-upsert.test.ts`): cria uma meta, vincula um projeto a ela (`projetos.meta_smart_id`), edita a meta, confirma que o projeto continua apontando pro mesmo `id`. **Passou.**

---

## 3. Arquivos e documentos alterados (atualizado após a validação)

**Código (correção de metas/onboarding):**
- `src/lib/ecc/actions.ts` — `salvarMetasSmart` reescrita (update explícito + insert com fallback de corrida, ver seção 2); `pularOnboarding` grava estado.
- `src/lib/ecc/metas.ts` — `listarMetasSmart`, `onboardingDeMetasFoiPulado`.
- `src/app/onboarding/page.tsx`, `src/app/page.tsx`, `src/components/onboarding/formulario-smart.tsx`, `botao-salvar.tsx` — como na rodada anterior.

**Código (rate limit de IA / observabilidade):** inalterado desde a rodada anterior — `src/lib/ecc/ia-rate-limit.ts`, `src/lib/observabilidade.ts`, `transcricao-audio.ts`, `explicacao-alinhamento.ts`, os 3 `route.ts` de cron.

**Migrations:**
- `0045_onboarding_pulado_e_upsert_metas.sql` — comentário atualizado pra refletir o update explícito (em vez de upsert); SQL do índice/coluna **inalterado**.
- `0046_rate_limit_ia.sql` — inalterada.

**Testes — expandidos nesta rodada de validação:**
- `tests/integration/metas-smart-upsert.test.ts` — **reescrito**: em vez de chamar `.upsert()` direto, reproduz a lógica exata de `salvarMetasSmart` (select → update-ou-insert-com-fallback-de-23505) e adiciona um teste de não-autorização.
- `tests/integration/rls-limites-entre-projetos.test.ts` (**novo**) — membro com `escopo: 'projeto'` não vê outro projeto do mesmo tenant; descobre o vazamento de `membros_do_tenant()` (seção 7.3).
- `tests/integration/rate-limit-concorrencia.test.ts` (**novo**) — `ia_registrar_tentativa` sob concorrência real, janelas isoladas, escopos isolados, EXECUTE revogado de usuário comum.
- `tests/integration/onboarding-pulado.test.ts` (**novo**) — pular persiste, é idempotente, criar depois continua funcionando.
- `src/lib/ecc/__tests__/ia-rate-limit-mock.test.ts` (**novo**) — fail-closed e bloqueio por camada, com RPC mockado (sem depender de banco).
- `src/lib/ecc/__tests__/bloqueio-nao-chama-provedor.test.ts` (**novo**) — prova, com stub do SDK do Gemini, que uma tentativa bloqueada NUNCA chama o provedor.

**Config de ambiente de teste (novos, não afetam produção):**
- `supabase/config.toml` (novo, via `supabase init`) — portas remapeadas de 543xx pra 573xx (ver seção 5.1) para não colidir com a instância Supabase local de outro projeto (UltraQuadras/"platform") já rodando neste mesmo Docker.
- `supabase/.gitignore` (novo, gerado automaticamente pelo `supabase init`).

---

## 4. Distinção importante: o que rodou onde (pedido explícito da validação)

| O quê | Status real |
|---|---|
| Workflow de CI (`.github/workflows/ci.yml`) | **Existe no repositório**, sintaticamente correto |
| CI rodando no GitHub Actions (remoto) | **NUNCA rodou** — a branch nunca foi publicada (`git push`), não há PR, não há execução no GitHub |
| `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` | **Executados localmente, de verdade**, várias vezes ao longo da sessão, com resultado real colado nos comandos (não resumido de memória) |
| Build só com env vars fictícias (simulando o CI) | **Executado localmente** — `.env.local`/`.env` movidos, build rodado só com os 3 placeholders do workflow, restaurados depois (hash SHA256 idêntico ao original, confirmado) |
| Migrations 0045/0046 | **Aplicadas** — mas só contra um Postgres local isolado criado nesta sessão (seção 5), nunca em produção nem em nenhum projeto Supabase Cloud real |
| Testes de integração/RLS (29 testes) | **Executados de verdade**, contra esse Postgres local, com identidades de usuário comuns (login real via `signInWithPassword`, JWT real) — nunca só `service_role` |
| Jornadas na aplicação (login, onboarding, editar meta, pular, mobile) | **Executadas de verdade** via Playwright contra `next dev` conectado ao mesmo Postgres local — não é leitura de código nem suposição |

---

## 5. Ambiente de teste local — como foi recuperado

### 5.1 Docker Desktop estava disponível, só num caminho não padrão

Na sessão anterior, "Docker indisponível" foi reportado porque o binário não estava em `C:\Program Files\Docker\Docker\Docker Desktop.exe`. Nesta validação, uma busca mais ampla achou o executável real em `C:\Users\proff\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe` — iniciado com sucesso (`Start-Process`), o daemon respondeu em menos de 1 minuto.

**Achado real ao inspecionar os containers já rodando**: já existia uma instância Supabase local de **outro projeto** (UltraQuadras/"platform") ocupando as portas padrão (54321-54327), rodando há 5 semanas. Para não tocar em nada desse outro projeto (regra dura: "Gaiamum é um projeto independente"), o `supabase/config.toml` do Gaiamum (criado via `supabase init`, que só cria esse arquivo — não mexe em migrations) teve todas as portas remapeadas para o bloco 573xx (`57321`-`57329`), isolando 100% os containers do Gaiamum (prefixo `_Gaiamum`) dos containers do outro projeto (prefixo `_platform`). Nenhum comando `docker stop`/`down` foi executado contra os containers do outro projeto.

### 5.2 Achado real: `service_role` sem GRANT nesta versão do Postgres/CLI local

Primeira tentativa de `supabase start` aplicou as 46 migrations sem erro, mas a primeira escrita de teste (via `service_role`, que deveria bypassar RLS completamente) falhou com `permission denied for table tenants`. Diagnóstico via `curl` direto contra o PostgREST local confirmou: a versão do Postgres/CLI local (17.6, CLI 2.109.1, imagem `2026.07.06`) mudou o padrão — tabelas novas **não são mais auto-expostas às roles da Data API (incluindo `service_role`) sem `GRANT` explícito**, diferente do comportamento assumido pelas 46 migrations do Gaiamum (nenhuma tem `GRANT` explícito, porque no Supabase Cloud onde o projeto real roda isso ainda é automático). **Não é um bug no código do Gaiamum** — é uma divergência de comportamento padrão entre essa versão específica do CLI local e o Supabase Cloud. Corrigido só no `config.toml` de teste (`auto_expose_new_tables = true`, com comentário explicando o motivo) + `supabase db reset` para reaplicar as migrations com o GRANT automático restaurado. **Não requer nenhuma mudança nas migrations reais do Gaiamum.**

### 5.3 Credenciais do ambiente de teste

`http://127.0.0.1:57321` (API), chaves JWT padrão de desenvolvimento do Supabase CLI (as mesmas documentadas publicamente em todo projeto Supabase local novo — não são segredos reais, nunca usadas em produção). Não reproduzidas nos arquivos de configuração versionados do projeto — só usadas como variáveis de ambiente de processo durante esta sessão.

### 5.4 Estado ao final desta sessão

Os containers Docker do Gaiamum (Postgres de teste) **continuam rodando** neste ambiente ao final da sessão (não foram derrubados) — permite retomar a validação numa sessão seguinte sem repetir o `supabase start`. Para parar: `npx supabase stop` (dentro de `c:\Users\proff\Documents\Gaiamum`) — não afeta o projeto "platform". Para descartar todo o estado de teste e recomeçar do zero: `npx supabase stop --no-backup` seguido de `npx supabase start`.

---

## 6. Jornadas executadas na aplicação real (Playwright, `next dev` contra o Postgres de teste)

Todas via 2 usuários de teste descartáveis (`jornada1@teste.gaiamum.invalid`, `jornada2@teste.gaiamum.invalid`), criados via Admin API, apagados ao final.

| Jornada | Resultado observado |
|---|---|
| Login → oferta do Lab → "ir direto pro app" → onboarding de metas (vazio) | Fluxo completo sem erro; formulário renderizado com todos os 6 campos do horizonte "médio prazo" |
| Preencher e "Salvar metas e continuar" (criação) | Salvou, redirecionou pra `/projetos`, sem erro |
| Ir pro Painel geral (`/`) → ver a meta no card "Metas SMART" com link "Editar →" | Confirmado — card mostra a "Visão macro" salva |
| Clicar "Editar →" | **Formulário reabriu 100% preenchido** com os valores reais salvos (confirmado campo a campo via snapshot de acessibilidade) — "Salvar metas e continuar" virou "Salvar alterações", botão "Pular" some (correto, não faz sentido em edição) |
| Editar o campo "Visão macro" e salvar | Salvou sem erro, redirecionou pra `/projetos` |
| Voltar pro Painel geral (nova navegação, equivalente a reload) | **A edição persistiu** ("Visão EDITADA — confirmando update real" aparece no card) — só 1 card, não duplicou |
| 2º usuário: login → onboarding → **"Pular, preencho depois"** | Redirecionou pra `/projetos` sem erro |
| Navegar pra `/` (nova navegação) | **Não redirecionou de volta pro onboarding** — mostrou "Painel geral" normal com "Você ainda não definiu suas metas SMART. Criar agora." em vez de forçar o onboarding |
| Clicar "Criar agora", preencher, salvar | Salvou sem erro — **confirma que criar depois de pular continua funcionando** |
| Viewport mobile (390×844) | Dashboard e onboarding renderizam corretamente (menu vira "☰", conteúdo não quebra); "Editar →" funciona igual ao desktop |
| Console do navegador | 2 mensagens de erro (`ERR_CONNECTION_REFUSED` + `TypeError: Failed to fetch`, associadas a `/financeiro/avulsas`) observadas **uma única vez**, coincidindo com uma transição de rota muito rápida (provável prefetch do Next abortado pela troca de página). **Não reproduzido** numa navegação posterior direta e limpa pra `/financeiro/avulsas` (0 erros). Registrado como observação, não como bug confirmado — ver seção 9 para o nível de confiança correto. |

**Não testado nesta sessão** (fora do escopo do que o P0 mudou, mas vale registrar): fluxo de IA real (transcrição de voz / explicação de Alinhamento) dentro da UI — exigiria `GEMINI_API_KEY` real, que não foi usada aqui de propósito (o rate limit em si já foi provado por outros meios, seção 6 da versão anterior deste relatório / testes de integração).

---

## 7. Achados de segurança/robustez descobertos durante esta validação

### 7.1 Confirmado: isolamento entre tenants é real, não só de UI

29 testes de integração, todos passando, usando login real (não `service_role`): usuário de um tenant não lê, não edita, não apaga, não injeta dado no tenant de outro — em projetos, tarefas, páginas livres, contas a pagar, metas SMART. RLS bloqueia no banco (0 linhas afetadas, sem erro de permissão explícito — é assim que RLS do Postgres se comporta) mesmo quando o UUID exato do recurso alheio é conhecido.

### 7.2 Confirmado: Financeiro é owner-only mesmo por acesso indireto

Um member com **acesso completo ao workspace** (não só escopo de projeto) e acesso ao **mesmo projeto** que originou uma despesa (via `tarefa_id`) continua sem enxergar `contas_a_pagar`, `contas_fixas_modelo`, nem a agregação usada pela Agenda. RLS bloqueia mesmo no caso mais favorável possível pro vazamento.

### 7.3 ACHADO NOVO (fora do escopo original do P0): `membros_do_tenant()` vaza e-mail de todo o workspace pra quem tem só `escopo: 'projeto'`

`membros_do_tenant()` (migration 0002, usada por `listarMembros()` em `equipe.ts`) filtra só por `t_id in (select current_tenant_ids())` — **não checa `escopo`**. Confirmado contra Postgres real: um usuário convidado só para 1 projeto específico (`escopo: 'projeto'`, que segundo o design documentado "não vê Equipe do workspace inteiro, só o(s) quadro(s) dele") consegue chamar essa RPC e recebe `user_id` + `email` + `papel` de **todo mundo do workspace**, inclusive o owner.

Não é a mesma classe de exposição que Financeiro/Metas SMART (RLS de tabela bloqueia esses dois corretamente) — é vazamento de e-mail via uma function `security definer`. **Fora do escopo deste P0** (não mexi em `equipe.ts`), não corrigido aqui para não expandir escopo da validação — reportado para decisão do Product Owner. Teste que prova o achado: `tests/integration/rls-limites-entre-projetos.test.ts`.

### 7.4 Confirmado: rate limit de IA é atomicamente correto sob concorrência real

10 chamadas simultâneas (`Promise.all`) contra `ia_registrar_tentativa` com limite 5: exatamente 5 `true`, exatamente 5 `false`, contagem final na tabela = 10 (nenhuma tentativa perdida por "lost update", nenhuma contada em dobro). Janelas de tempo diferentes e escopos diferentes (usuário/workspace/global) não interferem entre si. `EXECUTE` da função confirmado revogado de `anon`/`authenticated` — um usuário comum não consegue chamar a RPC direto do navegador.

### 7.5 Confirmado: tentativa de IA bloqueada nunca chama o provedor (stub)

Com `verificarRateLimitIA` mockado para bloquear, `transcreverAudioComGemini` (o SDK do Gemini) **nunca é invocado** — confirmado via `expect(mock).not.toHaveBeenCalled()`, não inferido da leitura do código. O caso "liberado" foi testado no mesmo arquivo pra confirmar que o mock não estava sempre bloqueando por acidente (falso positivo).

### 7.6 Confirmado: fail-closed do rate limit

Com o RPC simulando erro (banco indisponível), `verificarRateLimitIA` sempre devolve `permitido: false` — inclusive quando só 1 das 3 chamadas (usuário/workspace/global) falha e as outras 2 retornariam `true`.

### 7.7 Confirmado: logs não expõem dado sensível

Revisão de todos os 6 call sites reais de `registrarErro`/`registrarInfo` (os 3 crons, sucesso e falha): todo `contexto` é só contagens/ids; todo `erro` é `error.message` do driver Postgres/Supabase ou uma lista de `"<id>: <mensagem técnica>"`. Nenhum call site passa prompt, áudio, texto de nota/página ou token. Reforçado pelo tipo `ContextoLog` (só aceita `string | number | boolean | null | undefined` — um objeto complexo não compila).

---

## 8. Migrations — conteúdo e rollback (atualizado)

**`0045_onboarding_pulado_e_upsert_metas.sql`** — **aplicada com sucesso** no Postgres de teste isolado (seção 5), sem erro, sem necessidade de resolver duplicata (banco nasceu vazio). **Nunca aplicada em produção.** Pré-requisito antes de aplicar em produção continua de pé (rodar a query de detecção de duplicata real, documentada no próprio arquivo). Rollback: `drop index metas_smart_tenant_horizonte_unico; alter table tenants drop column onboarding_metas_pulado_em;` — não testado (não havia motivo pra reverter no ambiente de teste), mas é uma operação padrão sem risco de perda de dado além da própria coluna/índice que ela reverte.

**`0046_rate_limit_ia.sql`** — **aplicada com sucesso**, exercitada extensivamente (seção 7.4). Rollback: `drop function ia_registrar_tentativa(text, text, timestamptz, integer); drop table ia_rate_limit;` — tabela é só contagem operacional (nunca dado de produto), perda seria só o histórico de contagem de rate limit, não dado de usuário.

---

## 9. Matriz de validação (pedida explicitamente)

| Item | Implementado | Validado | Evidência | Pendência |
|---|---|---|---|---|
| `salvarMetasSmart` — update explícito (não upsert genérico) | ✅ | ✅ | `tests/integration/metas-smart-upsert.test.ts` (4/4) + jornada real via UI (seção 6) | Nenhuma |
| Preservação de ID/vínculos ao editar meta | ✅ | ✅ | Teste de integração + confirmado via UI (card não duplicou após editar) | Nenhuma |
| Clique duplo / corrida não duplica meta | ✅ | ✅ | Teste de concorrência real (`Promise.all`) contra Postgres | Nenhuma |
| Não-autorizado não edita meta de outro tenant | ✅ | ✅ | Teste de integração com usuário real de outro tenant | Nenhuma |
| `pularOnboarding` grava estado persistente | ✅ | ✅ | Teste de integração + confirmado via UI (nova navegação não força onboarding) | Nenhuma |
| "Pular" é idempotente (não sobrescreve timestamp) | ✅ | ✅ | `tests/integration/onboarding-pulado.test.ts` | Nenhuma |
| Criar meta depois de pular continua funcionando | ✅ | ✅ | Teste de integração + confirmado via UI | Nenhuma |
| Dashboard não força redirect pra quem já pulou | ✅ | ✅ | Confirmado via UI (jornada 2, seção 6) | Nenhuma |
| Rate limit de IA — 3 camadas, atômico | ✅ | ✅ | `tests/integration/rate-limit-concorrencia.test.ts` (concorrência real) | Nenhuma |
| Rate limit — fail-closed | ✅ | ✅ | `ia-rate-limit-mock.test.ts` (RPC mockado com erro) | Nenhuma |
| Rate limit — tentativa bloqueada nunca chama provedor | ✅ | ✅ | `bloqueio-nao-chama-provedor.test.ts` (stub do SDK) | Nenhuma |
| Rate limit — EXECUTE revogado de usuário comum | ✅ | ✅ | Teste de integração com login real tentando chamar a RPC | Nenhuma |
| Isolamento entre tenants (RLS) | — (pré-existente) | ✅ **confirmado nesta sessão** | `rls-isolamento.test.ts` (6 testes, login real) | Nenhuma |
| Limites entre projetos do mesmo tenant | — (pré-existente) | ✅ **confirmado nesta sessão** | `rls-limites-entre-projetos.test.ts` (6 testes) | Nenhuma |
| Financeiro owner-only, inclusive acesso indireto | — (pré-existente) | ✅ **confirmado nesta sessão** | `rls-financeiro-owner-only.test.ts` (5 testes) | Nenhuma |
| Logger estruturado — formato e correlação | ✅ | ✅ | `observabilidade.test.ts` (5 testes unitários) | Nenhuma |
| Logger aplicado nos 3 crons | ✅ | **Parcial** — compila, builda, revisão estática confirma ausência de dado sensível | Grep de todos os call sites (seção 7.7) | **Não executado um disparo real do endpoint de cron** contra dado real de alarme/conta — os crons dependem de dado de negócio (alarmes vencidos, contas do mês) que não foi montado nesta sessão; validação ficou no nível de "compila + lógica correta", não "rodou de ponta a ponta" |
| CI (GitHub Actions) — lint/tipos/testes/build | ✅ arquivo criado | **Parcial** — validado localmente (mesmas env vars fictícias do workflow), **nunca rodou no GitHub remoto** | Build local com env fictícias, hash do `.env.local` real confirmado intacto | Só roda de verdade quando a branch for publicada (push/PR) — decisão do Fabio, fora do escopo desta sessão |
| Migrations 0045/0046 — aplicam sem erro | ✅ | ✅ **em banco de teste isolado** | `supabase db reset` com as 46 migrations, sem erro | **Nunca aplicadas em produção** — pré-requisito de checagem de duplicata em produção real continua pendente |
| Jornadas principais na UI (criar/editar/pular meta) | ✅ | ✅ **via Playwright contra app real** | Seção 6 | Nenhuma nas jornadas testadas; IA real (transcrição/explicação) não testada via UI |
| Desktop/mobile | ✅ | ✅ | Viewport 390×844 testado (seção 6) | Não testado em mais de 1 tamanho mobile nem em tablet |

---

## 10. Instruções curtas para você testar visualmente (opcional — já validado via Playwright)

1. Se quiser ver com os próprios olhos: `npx supabase start` (dentro de `Documents\Gaiamum`, Docker Desktop precisa estar aberto) reativa o mesmo banco de teste isolado usado nesta sessão (os containers foram deixados rodando).
2. `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:57321 NEXT_PUBLIC_SUPABASE_ANON_KEY=<a que o supabase start imprime> SUPABASE_SERVICE_ROLE_KEY=<idem> npm run dev -- -p 3070` — nunca precisa tocar no seu `.env.local` real.
3. Criar uma conta nova pela própria tela de cadastro (cadastro está aberto nesse banco de teste) e repetir a jornada da seção 6.

---

## 11. Impacto em custo/dependências, rollback e configuração pendente

- **Dependência nova:** `vitest` (dev-only, sem custo em produção).
- **Nenhum serviço pago novo.**
- **Rollback do código:** branch inteira descartável sem afetar `main`.
- **Rollback das migrations:** ver seção 8 — continuam nunca aplicadas em produção.
- **Configuração pendente antes de produção:** query de detecção de duplicata em `metas_smart` (migration 0045) contra o banco real; opcional definir os 3 limites de rate limit de IA na Vercel (senão usa defaults conservadores).
- **Ambiente de teste local:** containers Docker do Gaiamum continuam rodando neste ambiente (portas 573xx, isolados do projeto "platform") — ver seção 5.4 para como parar/reiniciar.

---

## 12. P1/P2 — confirmação

Documentados em `GAIAMUM-BACKLOG-CONSOLIDACAO.md`. **Nada de P1/P2 implementado.** Nenhuma migration aplicada em produção, nenhum deploy, nenhum cadastro aberto ao público real, nenhum e-mail enviado a usuário real — os 2 usuários de teste (`@teste.gaiamum.invalid`) foram criados e apagados dentro do banco de teste isolado, nunca em produção.

---

## 13. Questões para decisão do Product Owner (atualizadas)

1. **`membros_do_tenant()` vaza e-mail de todo o workspace pra quem tem só `escopo: 'projeto'`** (seção 7.3, achado novo) — corrigir com prioridade no P1, antes do piloto crescer além de você?
2. Logger dos crons validado só por compilação + revisão estática, não por execução real — vale forçar um disparo manual de cada cron (`curl` com o `CRON_SECRET` real) contra o banco de teste antes de considerar isso 100% fechado, ou o nível de confiança atual já é suficiente pro piloto?
3. Quando publicar esta branch (push), o CI do GitHub Actions roda pela primeira vez de verdade — quer que eu publique agora (branch, sem merge em `main`) só para validar o CI remoto, ou prefere revisar o código antes?
4. Limites de rate limit de IA (3/usuário/min, 20/workspace/hora, 200 global/hora) continuam sendo um chute conservador de engenharia — confirma que servem pro piloto de 5-10 pessoas?
