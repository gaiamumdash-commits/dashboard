# Gaiamum — Backlog de Consolidação (P0/P1/P2)

**Criado:** 2026-09-30. Fonte: `Gaiamum-Prompt-Consolidacao-Inteligente-v1.txt` (prompt de execução), seções 5 e 6.
**Atualizado (validação):** Docker Desktop localizado, Postgres de teste isolado criado — quase todo o P0 passou de "IMPLEMENTADO NÃO VALIDADO" para "IMPLEMENTADO E TESTADO". Achado de segurança NOVO descoberto (`membros_do_tenant()`), fora do escopo original.
**Atualizado (fechamento):** achado de segurança **corrigido e testado** (migration 0047 + 12 testes) — reclassificado de "P1-E proposto" para P0 fechado, item 5.5 abaixo. Os 3 crons foram **executados de ponta a ponta** contra dado sintético no ambiente isolado (autenticação, repetição, concorrência real, timezone, rastreabilidade) — reclassificado de "validação parcial" para testado. Ver `GAIAMUM-RELATORIO-INCREMENTO-P0.md` para o detalhe completo e a pendência honesta que resta (falha real de infraestrutura dos crons não reproduzida).
**Atualizado (ajustes pós-mobile, 2026-10-01):** P1-F (experiência mobile) teve 7 ajustes adicionais implementados e validados — turnos restritos à coluna "Hoje" (nova identidade de sistema, migrations 0048), altura das colunas nivelada via CSS Grid, ordem de colunas/botão "+" corrigidos, barra de navegação horizontal dupla, achado real de bug corrigido no auto-scroll do arrasto mobile, e a revisão de privacidade (item P1-H abaixo, antes só proposta, agora corrigida de verdade com migration 0049). Pedido adicional do Fabio na mesma sessão — botão "👁 Mostrar / 🙈 Ocultar" exclusivo da coluna Concluído, que recolhe os cartões concluídos (e a própria coluna) pra não dominar a altura nivelada das demais — também implementado e testado, ver item P1-I abaixo. Ver `GAIAMUM-RELATORIO-INCREMENTO-AJUSTES-KANBAN-POS-MOBILE.md`.

Estado de cada item usa exatamente 4 rótulos, sem meio-termo:
- **IMPLEMENTADO E TESTADO** — código existe, roda, e há teste automatizado que passou de verdade nesta sessão.
- **IMPLEMENTADO NÃO VALIDADO** — código existe e compila/builda, mas não há prova de execução real (ex.: depende de banco indisponível nesta sessão).
- **PROPOSTO** — documentado com critério de aceite, código não escrito.
- **BLOQUEADO** — não pode avançar sem uma decisão ou recurso externo (dito explicitamente qual).

---

## P0 — Confiabilidade e Metas (implementado nesta sessão, 2026-09-30)

### 5.1 Rede de segurança automatizada

| Item | Estado | Evidência |
|---|---|---|
| Vitest configurado (`vitest.config.ts`, scripts `test`/`test:watch`/`test:integration`) | **IMPLEMENTADO E TESTADO** | `npm test` roda e passa |
| Testes unitários de lógica/regras determinísticas (kanban, parser de fala, categorização, score de alinhamento, menções, rate limit, observabilidade) | **IMPLEMENTADO E TESTADO** | 55 testes, 7 arquivos, todos verdes — ver `src/lib/**/__tests__/*.test.ts` |
| Testes de integração/RLS (isolamento entre tenants, limites entre projetos, financeiro owner-only, metas) | **IMPLEMENTADO E TESTADO** | 29 testes, todos verdes, contra Postgres real (Docker local, isolado do projeto "platform"), com login real (não `service_role`) — ver `tests/integration/*.test.ts` e relatório P0 seções 5-6 |
| CI (GitHub Actions): lint, tipos, testes unitários, build | **IMPLEMENTADO E TESTADO localmente — NUNCA rodou no GitHub remoto** | `.github/workflows/ci.yml` existe e foi validado localmente (env vars fictícias, sem tocar `.env.local`/`.env` reais); só roda de verdade quando a branch for publicada (push/PR), o que não aconteceu nesta sessão |
| CI rodando testes de integração/RLS automaticamente | **BLOQUEADO** | Exigiria subir Postgres/Supabase no runner do GitHub Actions (Supabase Action ou Docker Compose) — decisão de infraestrutura de CI não tomada nesta rodada; próximo passo no P1 se o piloto justificar |
| Testes de permissão (owner/gestor/member, limites entre projetos, edição/exclusão) | **IMPLEMENTADO E TESTADO** | `rls-isolamento.test.ts`, `rls-limites-entre-projetos.test.ts`, `rls-financeiro-owner-only.test.ts` — 17 testes, contra Postgres real |

### 5.2 Observabilidade mínima

| Item | Estado | Evidência |
|---|---|---|
| Logger estruturado (JSON, id de correlação, operação, severidade, contexto sem dado sensível) | **IMPLEMENTADO E TESTADO** | `src/lib/observabilidade.ts`, 5 testes unitários verdes |
| Aplicado nos 3 crons (`disparar-alarmes`, `gerar-contas-fixas`, `reengajamento-lab`) | **IMPLEMENTADO E TESTADO — só o PROCESSAMENTO, não a ENTREGA de e-mail** | Os 3 endpoints disparados de verdade via HTTP contra dado sintético persistido no Postgres de teste: autenticação (401/200), execução normal, repetição sem duplicar, concorrência real (2 requests simultâneos, exatamente 1 processa), timezone/corte confirmado no banco, rastreabilidade via `idExecucao`/`idCorrelacao` cruzados entre resposta HTTP e log do console — ver relatório P0 seção 5. Falha real de infraestrutura (erro 500 genuíno) não reproduzida — pendência honesta, seção 5.4 do relatório. **Distinção que faltava (revisão do P0, 2026-10-01)**: "processou" (notificação in-app criada, `disparado_em` gravado) é uma evidência diferente de "e-mail chegou". `RESEND_API_KEY` ausente no ambiente de teste significa que o envio real NUNCA FOI SEQUER TENTADO (`enviarEmailAlarme`/`enviarEmailReengajamentoLab`/etc. retornam cedo com `if (!apiKey) return;`) — isso não comprova entrega bem-sucedida nem comprova que uma falha do provedor Resend (API fora do ar, e-mail rejeitado, caixa cheia) seria tratada corretamente: hoje esses erros só vão para `console.error` (não para o logger estruturado `observabilidade.ts` usado no resto do cron), então não aparecem correlacionados por `idExecucao`/`idCorrelacao`. Nenhuma mudança de código nesta rodada (fora do escopo mobile); registrado como item P1 novo abaixo |
| Aplicado em mutations críticas fora dos crons (Kanban, Financeiro, Equipe) | **PROPOSTO** | Fora do escopo mínimo desta rodada — essas Server Actions já lançam `Error` com mensagem específica tratada caso a caso; instrumentar tudo de uma vez era desproporcional ao risco atual (ver Blueprint, decisão registrada) |
| Serviço externo de observabilidade (Sentry ou equivalente) | **PROPOSTO** | Vetado explicitamente nesta rodada pelo prompt de consolidação ("não criar conta/assinatura paga"); ver questão de decisão no relatório do P0 |

### 5.3 Controle de consumo de IA

| Item | Estado | Evidência |
|---|---|---|
| Rate limit atômico EM CADA CAMADA (usuário/workspace/global), no Postgres | **IMPLEMENTADO E TESTADO** | `tests/integration/rate-limit-concorrencia.test.ts`: 10 chamadas simultâneas, limite 5 → exatamente 5 permitidas/5 bloqueadas, contagem exata (10) na tabela — prova real de atomicidade sob concorrência, contra Postgres. **Precisão de redação (revisão do P0, 2026-10-01)**: cada `ia_registrar_tentativa` é atômica isoladamente (upsert com lock de linha) — a VERIFICAÇÃO CONJUNTA das 3 camadas não é transacional (não há rollback cruzado). **Achado real corrigido nesta rodada**: a 1ª versão chamava as 3 RPCs em paralelo (`Promise.all`), então uma tentativa bloqueada no limite de usuário ainda consumia cota de workspace/global (compartilhada com outros usuários/tenants) — um único usuário malfeito/com bug podia esgotar a cota de todo mundo sem nenhuma chamada de IA real acontecer. Corrigido para sequencial com curto-circuito (usuário→workspace→global, para no 1º bloqueio); 2 testes novos em `ia-rate-limit-mock.test.ts` provam que as camadas seguintes nunca são chamadas quando uma anterior bloqueia. **Também esclarecido**: os limites são por MINUTO (usuário) e por HORA (workspace/global) — controlam frequência/rajada, não um orçamento diário/mensal; nada impede ~480 chamadas/dia num workspace que fique sempre no teto horário. Um teto diário real é item de produto novo, fora desta rodada |
| Aplicado nos 2 pontos reais de chamada de IA (transcrição de voz, explicação de alinhamento) | **IMPLEMENTADO E TESTADO** | `bloqueio-nao-chama-provedor.test.ts` — prova, com stub do SDK do Gemini, que bloqueio impede a chamada real ao provedor; caso liberado testado no mesmo arquivo |
| Fail-closed (indisponibilidade do controle de cota bloqueia) | **IMPLEMENTADO E TESTADO** | `ia-rate-limit-mock.test.ts` — RPC mockado retornando erro, em qualquer das 3 camadas |
| EXECUTE da função restrito ao service role | **IMPLEMENTADO E TESTADO** | Teste de integração com login real tentando chamar a RPC — permission denied |
| Anthropic/entrevista conversacional ativada | **Deliberadamente NÃO feito** | Prompt de consolidação veda ativar código desconectado nesta rodada |

### 5.4 Metas e onboarding

| Item | Estado | Evidência |
|---|---|---|
| `salvarMetasSmart` — update explícito por `id` (não upsert genérico — corrigido na validação, ver relatório P0 seção 2), preserva id/vínculos | **IMPLEMENTADO E TESTADO** | `tests/integration/metas-smart-upsert.test.ts` (4/4, contra Postgres real) + confirmado via UI real (Playwright) |
| Onboarding reabre preenchido para edição | **IMPLEMENTADO E TESTADO** | Confirmado via UI real: formulário reabre com os 6 campos preenchidos, botão vira "Salvar alterações" |
| "Pular" grava estado persistido (`tenants.onboarding_metas_pulado_em`), é idempotente | **IMPLEMENTADO E TESTADO** | `onboarding-pulado.test.ts` + confirmado via UI real |
| Dashboard não força mais redirect pra quem já pulou | **IMPLEMENTADO E TESTADO** | Confirmado via UI real: nova navegação pra "/" não redireciona, mostra CTA "Criar suas metas" |
| Criar meta depois de ter pulado continua funcionando | **IMPLEMENTADO E TESTADO** | Confirmado via UI real + teste de integração |
| Reconciliação de usuários antigos sem apagar dado | **IMPLEMENTADO** (por desenho, não por migração de dado) | Coluna nova é `nullable` sem default — ninguém preexistente teve estado alterado |

### 5.5 Pendência de segurança do fechamento do P0 — descoberta e CORRIGIDA nesta sessão

| Item | Estado | Evidência |
|---|---|---|
| `membros_do_tenant()` vazava e-mail de todo o workspace pra membro com `escopo: 'projeto'` — descoberto durante a validação (fora do escopo original do P0), reclassificado e tratado como pendência de segurança do fechamento | **IMPLEMENTADO E TESTADO** — com exposição residual ACEITA, documentada (ver nota) | Migration `0047_restringe_membros_do_tenant_por_escopo.sql` — a function agora filtra por quem chama, preservando acesso completo (owner/escopo completo) e colegas de projeto compartilhado, nunca o resto do workspace. 13 testes em `rls-limites-entre-projetos.test.ts` (12 originais + 1 novo) cobrindo os 5 cenários pedidos. **Correção de redação (revisão do P0, 2026-10-01)**: este item e o relatório do P0 chamavam a correção de "nenhuma exposição residual" — impreciso. O e-mail do(s) owner(s) do tenant continua visível a QUALQUER convidado de projeto, mesmo sem projeto compartilhado com aquele owner (teste `[DOCUMENTA EXPOSIÇÃO ACEITA]`). Isso é intencional e necessário (owner tem acesso RLS completo a qualquer projeto, pode legitimamente ser @mencionado/atribuído em qualquer quadro; a @menção grava e-mail literal no texto, não um ID — mascarar quebraria a funcionalidade). Nenhuma correção de código adicional é proporcional sem redesenhar o mecanismo de menção (fora de escopo) — ver `GAIAMUM-RELATORIO-INCREMENTO-MOBILE-E-AJUSTES-P0.md` seção 4 |

---

## P1 — Direção documentada, NÃO implementada nesta sessão

### P1-A — Ciclo simples das metas
**Estado: PROPOSTO.**
Criar, revisar, acompanhar, concluir ou abandonar uma meta, preservando histórico; métrica/unidade/baseline/atual/alvo/prazo quando mensurável; indicadores manuais com fonte/data visíveis.
**Critério de aceite:** meta mensurável tem cálculo rastreável; ausência de dado aparece como ausência (nunca como 0 disfarçado); tarefa concluída não é mostrada como meta atingida; mudança de alvo registra revisão.
**Depende de:** decisão de escopo/papéis (quem edita o quê) antes de qualquer migration nova.

### P1-B — Pulso Gaiamum v1
**Estado: PROPOSTO.**
Até 3 alertas determinísticos no dashboard existente (tarefas vencidas, marcos próximos, contas a pagar vencidas pro owner), com link de ação direto; síntese por LLM opcional e com fallback determinístico.
**Critério de aceite:** cada alerta tem evidência e ação; zero dado gera estado útil, não texto inventado; função continua útil sem LLM; nenhuma consulta cruza dado não autorizado (financeiro nunca aparece pra quem não é owner).
**Depende de:** nada tecnicamente bloqueante — pode começar assim que priorizado.

### P1-C — Página para ação
**Estado: PROPOSTO.**
Menu contextual no BlockNote: selecionar texto → prévia editável → confirmar → vira tarefa (depois decisão/compromisso/marco). LLM propõe dados estruturados validados, nunca executa direto.
**Critério de aceite:** cancelar não grava; conflito de edição não perde conteúdo; dado financeiro só visível pra owner; conteúdo da página é entrada não confiável (instrução nele não pode mudar permissão nem disparar ferramenta).
**Depende de:** nenhuma dependência de P1-A/B.

### P1-D — Checkpoint de projeto
**Estado: PROPOSTO.**
Evolui o Freeze/consolidação já existente (`enviarConsolidacaoProjeto`), com prévia antes de enviar, baseline pra "o que mudou", revisão de destinatários.
**Critério de aceite:** prévia consistente com o banco; envio explícito (nunca automático nesta etapa); gestor nunca recebe resumo financeiro owner-only.
**Depende de:** definir se "o que mudou" precisa de uma tabela de snapshot nova (schema) ou se dá pra inferir sem persistir histórico — decisão de arquitetura a tomar antes de codar.

### ~~P1-E — Corrigir vazamento de e-mail em `membros_do_tenant()`~~ — CONCLUÍDO, movido para o P0
**Estado: IMPLEMENTADO E TESTADO, ver P0 seção 5.5 acima e `GAIAMUM-RELATORIO-INCREMENTO-P0.md` seção 4.** Não é mais um item de P1 — foi reclassificado como pendência de segurança do fechamento do P0 e corrigido nesta mesma branch (migration `0047`), não deixado para depois.

### ~~P1-F — Experiência mobile do Kanban~~ — CONCLUÍDO nesta rodada (2026-09-30/10-01)
**Estado: IMPLEMENTADO E VALIDADO (a maior parte) — ver `GAIAMUM-RELATORIO-INCREMENTO-MOBILE-E-AJUSTES-P0.md` para o detalhe completo, arquivo por arquivo, e a matriz IMPLEMENTADO/PROPOSTO/BLOQUEADO.** Celular em pé mostra uma coluna por vez (quase toda a largura, scroll-snap), com cabeçalho de navegação (nome/contagem/posição + seletor), botão "Visão geral" (retrato e paisagem), celular deitado aproveita a largura pra mostrar mais colunas. Arrasto por toque PRESERVADO e melhorado (alça dedicada + long-press, indicador de destino, "Mover para..." como alternativa pro cenário fim→início de coluna longa — testado e funcionando). Detalhe da tarefa em tela cheia no celular. 2 achados reais de bug corrigidos no processo: rolagem horizontal acidental da página inteira (`min-w-0`/`w-full`/`overflow-x-hidden`) e um stale closure no arrasto por toque (reproduzido e corrigido, não só suposição). Pinça pra zoom avaliada e deliberadamente NÃO implementada (ver seção 6 do relatório) — zoom nativo do navegador continua livre.

### P1-G — Observabilidade de entrega de e-mail (proposto, revisão do P0)
**Estado: PROPOSTO.** Hoje uma falha no envio real (Resend fora do ar, e-mail rejeitado, chave inválida) só vai para `console.error`, fora do logger estruturado (`observabilidade.ts`) usado no resto dos 3 crons — não é correlacionável por `idExecucao`/`idCorrelacao`, e "cron processou" (notificação in-app criada) não é prova de "e-mail chegou".
**Critério de aceite:** falha de envio usa `registrarErro()` com o mesmo `idCorrelacao` da execução do cron; documentação deixa de equiparar "processado" a "entregue".
**Depende de:** nada tecnicamente bloqueante — trocar os `console.error` dos helpers de e-mail (`notificacoes.ts`) por `registrarErro()`, passando o `idCorrelacao` do chamador.

### ~~P1-H — Revisão de privacidade de membros (exposição de e-mail ao owner)~~ — CONCLUÍDO (2026-10-01)
**Estado: IMPLEMENTADO E TESTADO.** Reavaliação mais rigorosa do item fechado na sessão anterior (que só havia documentado a exposição como "necessária" sem provar isso de fato). Corrigido com 2 migrations (`0048` indiretamente, `0049` diretamente): `membros_do_tenant()` só devolve e-mail completo pra quem já tinha direito a ele (acesso completo, ou projeto compartilhado); um novo campo `nome_exibicao` (sempre presente) substitui o e-mail na identificação/seleção/@menção. **Achado mais grave, corrigido junto**: a resolução de e-mail pra NOTIFICAÇÃO real (`registrarAtividade`, `enviarConsolidacaoProjeto`) usava a mesma function pública limitada por escopo de quem disparou a ação — um convidado de projeto podia falhar em notificar o owner por um cartão atribuído a ele. Nova function privilegiada `emails_para_notificacao` (EXECUTE revogado de anon/authenticated) resolve isso de forma sempre completa, nunca dependente do que a interface mostra pra quem agiu. Ver `GAIAMUM-RELATORIO-INCREMENTO-AJUSTES-KANBAN-POS-MOBILE.md` seção 4.

### P1-I — Botão "Mostrar/Ocultar" exclusivo da coluna Concluído — CONCLUÍDO (2026-10-01)
**Estado: IMPLEMENTADO E TESTADO.** Pedido adicional do Fabio no meio da sessão (apelidado por ele de "toca"): com o nivelamento de altura por CSS Grid (item 2 do incremento pós-mobile), a coluna Concluído — que só cresce com o tempo — passou a puxar a altura de todas as outras colunas junto, tirando o foco do que ainda falta fazer. Botão novo no cabeçalho da coluna Concluído (`🙈 Ocultar` / `👁 Mostrar`, só aparece quando há cartões concluídos) alterna um estado local (`concluidosOcultos`, iniciado `true`) que troca a lista de cartões por um resumo clicável ("N cartão(ões) oculto(s) — toque pra ver"), recolhendo a coluna e, por consequência, a altura nivelada de todo o quadro. Puramente de interface (não apaga nem arquiva dado nenhum — é só exibição); testado com Playwright incluindo arrastar um cartão pra dentro da coluna recolhida e a interação com o grid de altura nivelada. Ver `GAIAMUM-RELATORIO-INCREMENTO-AJUSTES-KANBAN-POS-MOBILE.md` seção 2.7.

---

## P2 — Direção documentada, NÃO implementada nesta sessão

### P2-C — Cartões sem turno somem ao dividir uma coluna em turnos pela 1ª vez
**Estado: PROPOSTO.** Achado incidental (2026-10-01, não corrigido, fora do escopo do pedido que o originou): quando uma coluna já populada é dividida em Manhã/Tarde/Noite, cartões com `turno = null` não aparecem em nenhum dos 3 sub-blocos (o filtro é `turno === valor`, nunca `turno === null`). O dado não é perdido (sobrevive reload, reaparece se a divisão for desfeita), mas a experiência confunde — parece que os cartões sumiram.
**Critério de aceite:** cartões sem turno continuam visíveis de alguma forma (ex.: um 4º sub-bloco "Sem turno") quando a coluna é dividida, ou a ação de dividir pede pra classificar os existentes antes.
**Depende de:** decisão de UX sobre o comportamento esperado — não tecnicamente bloqueante.

### P2-A — Financeiro por projeto
**Estado: PROPOSTO.**
Ver Blueprint seção 6 e handoff canônico seção 21 (dívida técnica já registrada). Precisa decidir precedência tarefa/decisão/projeto antes de qualquer `alter table`.

### P2-B — IA contextual
**Estado: PROPOSTO.**
Menu único de ações de IA (resumir, decompor checklist, preparar pauta) com os mesmos controles de custo do P0. Explicitamente NÃO inclui ativar a entrevista Anthropic nem construir chat aberto.

### Transversal — linguagem e esforço
**Estado: PROPOSTO.**
Mapear owner/member/gestor/usuario pra rótulos mais simples na UI (Administrador/Gestor do projeto/Participante) sem tocar enum/RLS. Revisar campos redundantes do score de Alinhamento sem mudar pesos sem registro prévio.

---

## Dependências entre itens

```
P0 (concluído nesta sessão, parcialmente validado)
 └─ é pré-requisito de TODO P1/P2 (regra do prompt: "priorizar integração e
    confiabilidade antes de adicionar módulos")

P1-A (ciclo de metas) ──┬── não bloqueia P1-B/C/D entre si
P1-B (Pulso)            │   (podem ser feitos em qualquer ordem)
P1-C (Página → ação) ───┤
P1-D (Checkpoint)  ──────┘

P2-A (Financeiro por projeto) — independente, mas ganha mais valor depois
  do P1-B (Pulso) existir, pra poder citar "contas vencidas do projeto X"
P2-B (IA contextual) — depende dos controles de custo do P0 já estarem
  validados de ponta a ponta (rate limit real, não só código pronto)
```
