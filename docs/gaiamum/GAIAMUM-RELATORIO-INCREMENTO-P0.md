# Gaiamum — Relatório do Incremento P0 (Confiabilidade e Metas)

**Branch:** `consolidacao/p0-confiabilidade-metas` (criada a partir de `main`, não mesclada, não publicada)
**Executor:** Claude Code (Sonnet 5)

## Changelog das 3 rodadas desta branch

1. **2026-09-30, implementação** — código do P0 escrito (metas/onboarding, rate limit de IA, observabilidade, rede de testes, CI). Migrations preparadas, não aplicadas. Testes de integração escritos, não executados (Docker indisponível no momento).
2. **2026-09-30, validação** — Docker localizado e usado para criar um Postgres de teste isolado; migrations aplicadas; 92 testes passando contra banco real; jornadas principais confirmadas via Playwright; corrigido um desvio de especificação (update explícito em vez de upsert genérico); descoberto um achado de segurança novo (`membros_do_tenant()`), fora do escopo original, não corrigido nesta rodada.
3. **2026-09-30, fechamento (esta rodada)** — achado de segurança corrigido no banco (não só na aplicação), com migration própria e 12 testes cobrindo os 5 cenários pedidos; os 3 crons executados de ponta a ponta contra dado sintético persistido no ambiente isolado (autenticação, execução normal, repetição, concorrência real, timezone, rastreabilidade); 98 testes passando no total.

Este documento está organizado por tema, não por rodada — cada seção já reflete o estado mais atual.

---

## 1. O que mudou para o usuário e riscos reduzidos

- **"Editar" Meta SMART edita de verdade** (update explícito por `id`, não upsert genérico — ver seção 3). Confirmado via UI real e testes de integração.
- **"Pular, preencho depois" não força mais loop de volta ao onboarding.** Confirmado via UI real.
- **Rate limit de IA em 3 camadas, atômico no Postgres**, provado sob concorrência real (10 chamadas simultâneas, limite 5 → exatamente 5/5).
- **Os 3 crons têm log estruturado e rastreável**, e foram **executados de ponta a ponta** nesta rodada — não só revisão de código (ver seção 5).
- **Vazamento de e-mail do workspace corrigido no banco**: um convidado só para 1 projeto não enumera mais e-mail de quem está em outros projetos/fora do workspace visível a ele — a correção é na própria function SQL, não um filtro de tela (ver seção 4).
- **98 testes automatizados passando de verdade** (69 unitários + 29 de integração contra Postgres real, login comum).

**Nada foi publicado.** Todas as migrations (0045-0047) só existem aplicadas no Postgres de teste isolado desta sessão — nunca em produção nem em projeto Supabase Cloud real.

---

## 2. Distinção obrigatória: o que rodou onde

| O quê | Status real |
|---|---|
| Workflow de CI (`.github/workflows/ci.yml`) | Existe no repositório, sintaticamente correto |
| CI rodando no GitHub Actions (remoto) | **Nunca rodou** — branch não publicada, sem PR |
| `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` | Executados localmente, de verdade, várias vezes, incluindo depois da correção de segurança desta rodada — 98 testes, 0 falhas, build com 39 rotas |
| Migrations 0045, 0046, 0047 | Aplicadas **só no Postgres de teste local isolado** (seção 6) — nunca em produção |
| Testes de integração/RLS (29 testes) | Executados de verdade, login real (não `service_role`) |
| Os 3 crons (`disparar-alarmes`, `gerar-contas-fixas`, `reengajamento-lab`) | **Executados de verdade** via HTTP contra o Postgres de teste, com `CRON_SECRET` de teste — nunca contra produção (seção 5) |
| Envio real de e-mail (Resend) | **Nunca aconteceu** — `RESEND_API_KEY` deliberadamente ausente no ambiente de teste, a própria função de envio (`notificacoes.ts`) retorna cedo sem tentar rede quando a chave não existe (`if (!apiKey) return;`) — não é um mock, é a interceptação mais simples possível: a chamada de rede nunca é montada |
| Jornadas na aplicação (login, onboarding, editar/pular meta, mobile) | Executadas de verdade via Playwright contra `next dev` conectado ao Postgres de teste |
| Ambiente UltraQuadras ("platform") | **Nunca tocado** — isolado em bloco de portas diferente, nenhum comando `docker stop/down` executado contra os containers dele |
| `.env.local` de produção do Gaiamum | **Nunca lido nem escrito** nesta sessão (nem nas anteriores) — confirmado por hash SHA256 idêntico antes/depois na sessão de validação; nesta rodada, as env vars do Postgres de teste foram passadas só como variáveis de processo (`export`), nunca gravadas em arquivo |

---

## 3. Metas SMART — update explícito (correção da rodada 2, reconfirmada)

A primeira versão usava `.upsert()`. Corrigida para, por horizonte: buscar o `id` existente → `UPDATE ... WHERE id = <id> AND tenant_id = <tenantId>` na edição; `INSERT` só na criação, com fallback de corrida (erro `23505` do índice único → vira `UPDATE`). Nunca toca `id`/`criado_em`/`tenant_id`. RLS de autorização inalterada.

**Validado:** `tests/integration/metas-smart-upsert.test.ts` (4 testes — cria/edita preservando id, preserva vínculo com projeto, não-autorizado bloqueado, concorrência real não duplica) + jornada real via UI (formulário reabre preenchido, edição persiste após navegação nova, card não duplica).

O índice único `(tenant_id, horizonte)` impede duas linhas com o mesmo par — não impede tenants diferentes terem sua própria meta do mesmo horizonte, nem o mesmo tenant ter "médio prazo" e "longo prazo" simultaneamente. Nenhuma meta foi apagada em nenhum ambiente para esse índice "passar" — ele foi criado só contra bancos de teste vazios.

---

## 4. Correção de segurança: `membros_do_tenant()` vazava e-mail do workspace inteiro

### 4.1 Mapeamento de consumidores (feito antes de qualquer alteração)

| Consumidor | Onde roda | Precisa de acesso a quem? |
|---|---|---|
| `app/equipe/page.tsx` | Página `/equipe` | Só quem já tem `temAcessoCompleto()` chega aqui (guard antes de chamar `listarMembros`) — não era o vetor do vazamento |
| `equipe.ts:listarMembrosComAcessoAoProjeto(tenantId, projetoId)` | Server-side, usado em `/projetos/[id]/tarefas` (seletor de responsável, @menção) e `/projetos/[id]/configuracoes` ("Equipe do quadro") | **Precisa** funcionar pra quem tem `escopo: 'projeto'`, dentro do próprio projeto — não podia perder acesso |
| `atividade.ts:registrarAtividade()` | Notifica responsáveis/menções de uma tarefa | Mesma necessidade — chamador com `escopo: 'projeto'` precisa resolver e-mail de colegas do mesmo projeto |
| `actions.ts:removerMembro()` | Só chamável por owner (guard explícito antes) | Nunca chamado por `escopo: 'projeto'` |

**Causa raiz:** a function SQL nunca teve `EXECUTE` restrito (diferente de `reivindicar_alarme`/`ia_registrar_tentativa`, revogados nas migrations 0029/0046) — qualquer client autenticado podia chamar `supabase.rpc("membros_do_tenant", {t_id})` direto, contornando o filtro que a aplicação sempre fazia depois de buscar.

### 4.2 Correção — no banco, não só na interface

`supabase/migrations/0047_restringe_membros_do_tenant_por_escopo.sql` (`CREATE OR REPLACE FUNCTION`, aditiva): a própria function agora filtra por quem está chamando (`auth.uid()`):
- Acesso completo ao workspace (owner ou `escopo: 'completo'`) → continua vendo todo mundo (comportamento original, preservado).
- `escopo: 'projeto'` → só vê colegas que compartilham pelo menos 1 projeto com ele (via `projeto_membros`), mais o(s) owner(s) do tenant (para permitir @mencionar/atribuir ao dono mesmo se ele não estiver explicitamente listado naquele projeto específico).

### 4.3 Validação — 12 testes, todos passando, cobrindo os 5 cenários pedidos

`tests/integration/rls-limites-entre-projetos.test.ts` (reescrito nesta rodada):

1. **Convidado do projeto A não enumera e-mails do projeto B** — confirmado (chamada direta à RPC nunca inclui e-mail de quem só está no projeto B).
2. **Consulta direta à RPC respeita as mesmas restrições da interface** — o teste chama `supabase.rpc(...)` direto (não a Server Action), simulando exatamente o vetor do vazamento original.
3. **Administrador (owner) e gestores mantêm os acessos legítimos** — owner continua vendo todo mundo; gestor do Projeto A continua vendo os colegas do Projeto A.
4. **Seletores de responsáveis continuam funcionando** — reproduzida a lógica exata de `listarMembrosComAcessoAoProjeto` sobre o resultado da function corrigida, confirmando que o seletor do Projeto A ainda lista corretamente quem pode ser atribuído/mencionado ali.
5. **Nenhuma alteração permite acesso entre tenants** — usuário de outro tenant, sem membership neste, recebe lista vazia (RLS de `current_tenant_ids()` já bloqueava isso antes, reconfirmado).

### 4.4 Rollback

`CREATE OR REPLACE FUNCTION` é aditivo — o SQL da versão anterior está documentado como comentário no fim do próprio arquivo de migration, caso precise reverter (não recomendado — reintroduziria o vazamento).

---

## 5. Os 3 crons — executados de ponta a ponta (não só revisados)

Ambiente: `next dev` conectado ao Postgres de teste isolado, `CRON_SECRET` de teste, **sem `RESEND_API_KEY`** (nenhum e-mail real chega a ser tentado). Dados sintéticos persistidos criados via Admin API/service role, apagados ao final.

### 5.1 `disparar-alarmes`

| Cenário testado | Resultado |
|---|---|
| Autenticação: sem header | `401` |
| Autenticação: secret errado | `401` |
| Autenticação: secret correto | `200` |
| Execução normal (conta a pagar vencendo hoje, com alarme) | Disparou — notificação in-app criada com título/valor corretos |
| Dado órfão (alarme apontando pra conta inexistente) | Ignorado silenciosamente, sem erro — `verificados` não conta o órfão, confirmando que o código filtra antes de virar "disparo" candidato |
| Timezone / data de corte | `disparado_para_referencia` = `2026-09-30T03:00:00+00:00` = exatamente meia-noite de 30/09 em Brasília (UTC-3) convertida para UTC — confirmado campo a campo no banco |
| Repetição (2ª chamada imediata) | `disparados: 0` — **não duplicou** a notificação (confirmado: 1 linha em `notificacoes_app` antes e depois) |
| Concorrência real (2 requests simultâneos, não sequenciais) | Exatamente 1 dos 2 disparou (`disparados: 1` / `disparados: 0`); banco confirma 1 única notificação — claim atômico (`reivindicar_alarme`) correto sob corrida real |
| Rastreabilidade | Cada resposta HTTP e cada linha de log estruturado no console carregam o mesmo `idExecucao`/`idCorrelacao` — confirmado correlacionando as 2 fontes |

### 5.2 `gerar-contas-fixas`

| Cenário testado | Resultado |
|---|---|
| Execução normal (modelo ativo, dia de vencimento 10) | Gerou a conta do mês corrente, `mes_referencia`/`data_vencimento` corretos |
| Alarme de véspera automático | Criado corretamente (`antecedencia_min: 360`, `criado_por` resolvido como o owner) |
| Repetição (2ª chamada imediata) | `geradas: 0, falhas: []` — índice único (`conta_fixa_id, mes_referencia`) barra a duplicata; código trata `23505` como esperado, não como falha |
| Concorrência real (2 requests simultâneos) | Exatamente 1 gerou; banco confirma 1 única linha |

### 5.3 `reengajamento-lab`

| Cenário testado | Resultado |
|---|---|
| Execução normal (usuário há 72h sem atividade, sem patente Explorador) | `enviados: 1`; `lab_tenants.reengajamento_enviado_em` gravado; notificação in-app criada com o texto certo |
| Repetição (2ª chamada imediata) | `verificados: 0` (o filtro de candidatos já exclui quem tem `reengajamento_enviado_em` preenchido, antes mesmo de entrar no loop) — não reenviou |
| Concorrência real (2 requests simultâneos) | Exatamente 1 enviou; banco confirma 1 única notificação — claim atômico (`update ... where reengajamento_enviado_em is null`) correto sob corrida real |

### 5.4 O que NÃO foi testado, honestamente

**Falha real do Postgres/driver (erro 500 genuíno) não foi reproduzida.** Os únicos caminhos de falha real dos 3 crons (erro de RPC, erro de INSERT que não seja `23505`, erro na query inicial) exigiriam corromper deliberadamente o schema ou a conectividade do banco de teste de forma artificial — não fiz isso porque não seria representativo de uma falha real de produção (que tipicamente é timeout/instabilidade de rede, não dado corrompido). O caminho mais próximo e realista que testei — dado órfão (alarme para entidade inexistente) — é tratado sem erro, o que já é o comportamento correto esperado. Isso é uma lacuna honesta, não escondida: se quiser uma prova de que `falhas.push()`/`registrarErro()` realmente disparam em produção, precisaria ser observado organicamente (próxima falha real de infraestrutura) ou via um teste de unidade com o client do Supabase mockado para devolver erro — não construído nesta sessão.

---

## 6. Ambiente de teste local

Docker Desktop localizado em `AppData\Local\Programs\DockerDesktop\` (fora do caminho padrão). Um Supabase local de **outro projeto** (UltraQuadras/"platform") já rodava nas portas padrão (54321-54327) — o Gaiamum foi isolado em `supabase/config.toml` (novo) no bloco 573xx, sem tocar nada do outro projeto. Achado técnico à parte, sem relação com o código do Gaiamum: essa versão do Postgres/CLI local (17.6) exige `auto_expose_new_tables = true` para que `service_role` tenha `GRANT` automático — comportamento diferente do Supabase Cloud (onde produção roda), corrigido só na config de teste.

Migrations aplicadas neste banco isolado, em ordem: 0001-0044 (schema já existente), 0045, 0046 (rodada de validação), 0047 (esta rodada, via `supabase migration up`, sem resetar dados). Containers continuam rodando ao final desta sessão — `npx supabase stop` (dentro de `Documents\Gaiamum`) para derrubar.

---

## 7. Matriz de validação completa

| Item | Implementado | Validado | Evidência | Pendência |
|---|---|---|---|---|
| Metas SMART — update explícito, preserva ID/vínculos, autorização | ✅ | ✅ | `metas-smart-upsert.test.ts` + UI real | Nenhuma |
| Onboarding — pular persiste, criar depois funciona, sem loop | ✅ | ✅ | `onboarding-pulado.test.ts` + UI real | Nenhuma |
| Rate limit de IA — 3 camadas, atômico, fail-closed, bloqueio impede chamada ao provedor | ✅ | ✅ | `rate-limit-concorrencia.test.ts`, `ia-rate-limit-mock.test.ts`, `bloqueio-nao-chama-provedor.test.ts` | Nenhuma |
| Isolamento entre tenants / limites entre projetos / financeiro owner-only | — (pré-existente) | ✅ | `rls-isolamento.test.ts`, `rls-limites-entre-projetos.test.ts`, `rls-financeiro-owner-only.test.ts` | Nenhuma |
| **`membros_do_tenant()` — vazamento corrigido no banco** | ✅ | ✅ | Migration 0047 + 12 testes cobrindo os 5 cenários pedidos | Nenhuma |
| Logger estruturado — formato, correlação, sem dado sensível | ✅ | ✅ | `observabilidade.test.ts` + revisão estática dos 6 call sites | Nenhuma |
| **Cron `disparar-alarmes` — autenticação, execução, repetição, concorrência, timezone, rastreabilidade** | ✅ | ✅ | Execução real via HTTP, seção 5.1 | Falha real de infraestrutura não reproduzida (seção 5.4) |
| **Cron `gerar-contas-fixas` — idem** | ✅ | ✅ | Seção 5.2 | Idem |
| **Cron `reengajamento-lab` — idem** | ✅ | ✅ | Seção 5.3 | Idem |
| CI (GitHub Actions) | ✅ arquivo criado | Validado só localmente (env fictícias) | — | **Nunca rodou no GitHub remoto** — branch não publicada |
| Migrations 0045-0047 | ✅ | ✅ em banco de teste isolado | `supabase migration up`/`db reset`, sem erro | **Nunca aplicadas em produção** — checagem de duplicata em `metas_smart` real continua pendente antes de aplicar lá |
| Jornadas na UI (criar/editar/pular meta, mobile) | ✅ | ✅ via Playwright | Sessão de validação | IA real (transcrição/explicação) não testada via UI |

---

## 8. Instruções para você testar visualmente (opcional — já validado)

1. `npx supabase start` (dentro de `Documents\Gaiamum`, Docker Desktop aberto) reativa o mesmo banco de teste.
2. `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:57321 NEXT_PUBLIC_SUPABASE_ANON_KEY=<a que o start imprime> SUPABASE_SERVICE_ROLE_KEY=<idem> CRON_SECRET=<qualquer valor de teste> npm run dev` — nunca precisa tocar seu `.env.local` real.
3. Testar os crons: `curl -H "Authorization: Bearer <CRON_SECRET escolhido>" http://localhost:3000/api/cron/disparar-alarmes` (repita pros outros 2 endpoints).

---

## 9. Impacto em custo/dependências, rollback e configuração pendente

- Dependência nova: `vitest` (dev-only).
- Nenhum serviço pago novo.
- Rollback do código: branch descartável sem afetar `main`.
- Rollback das migrations: 0045/0046 documentado no relatório anterior (preservado no histórico do arquivo); 0047 documentado na seção 4.4 — nenhuma aplicada em produção.
- Configuração pendente antes de produção: checagem de duplicata em `metas_smart` (migration 0045); opcional, os 3 limites de rate limit de IA.

---

## 10. P1/P2 — confirmação

**Nada de P1/P2 implementado.** Nenhuma migration em produção, nenhum deploy, nenhum cadastro aberto, nenhum e-mail a usuário real (nem sintético — os e-mails de teste nunca saíram do ambiente local, porque `RESEND_API_KEY` esteve deliberadamente ausente).

---

## 11. Pendências restantes (o que falta para considerar o P0 100% fechado)

1. **Falha real de infraestrutura dos crons não reproduzida** (seção 5.4) — nível de confiança atual: alto para o caminho feliz e para dado inconsistente/órfão; não comprovado para erro de rede/Postgres genuíno.
2. **CI nunca rodou no GitHub remoto** — só publicando a branch (push) isso é resolvido; decisão de quando publicar é sua.
3. **Migrations 0045-0047 nunca aplicadas em produção** — a checagem de duplicata em `metas_smart` (pré-requisito documentado na 0045) continua precisando ser rodada contra o banco de produção real antes de aplicar lá.
4. **IA real (transcrição de voz, explicação de Alinhamento) não testada via UI** — o rate limit foi provado por outros meios (testes diretos), mas ninguém clicou o botão de verdade nesta sessão.

Fora essas 4 pendências — que são todas sobre **ambiente de produção/CI remoto**, não sobre a lógica em si — considero o P0 validado de ponta a ponta no ambiente local: 98 testes passando, os 3 crons rodados de verdade, a correção de segurança provada contra os 5 cenários pedidos, e as jornadas principais confirmadas visualmente.
