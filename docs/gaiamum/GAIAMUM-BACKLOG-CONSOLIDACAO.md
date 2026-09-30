# Gaiamum — Backlog de Consolidação (P0/P1/P2)

**Criado:** 2026-09-30. Fonte: `Gaiamum-Prompt-Consolidacao-Inteligente-v1.txt` (prompt de execução), seções 5 e 6.

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
| Testes de integração/RLS (isolamento entre tenants, financeiro owner-only, upsert de metas) | **IMPLEMENTADO NÃO VALIDADO** | Código pronto em `tests/integration/*.test.ts`, mas **não executado**: Docker Desktop indisponível neste ambiente (nem o binário no caminho padrão), sem Postgres local pra rodar contra. `describe.skipIf` os pula automaticamente sem a env var de banco de teste — ver `tests/integration/README.md` |
| CI (GitHub Actions): lint, tipos, testes unitários, build | **IMPLEMENTADO E TESTADO** | `.github/workflows/ci.yml`; build validado localmente rodando só com as mesmas env vars fictícias que o workflow usa (sem `.env.local`/`.env` reais) — passou |
| CI rodando testes de integração/RLS automaticamente | **BLOQUEADO** | Exigiria subir Postgres/Supabase no runner do GitHub Actions (Supabase Action ou Docker Compose) — decisão de infraestrutura de CI que não foi tomada nesta rodada (fora do "mínimo" pedido); documentado como próximo passo no P1 se o piloto justificar |
| Testes de permissão (owner/gestor/member, edição/exclusão) | **IMPLEMENTADO NÃO VALIDADO** | Cobertos dentro de `rls-isolamento.test.ts`/`rls-financeiro-owner-only.test.ts` — mesmo impedimento acima |

### 5.2 Observabilidade mínima

| Item | Estado | Evidência |
|---|---|---|
| Logger estruturado (JSON, id de correlação, operação, severidade, contexto sem dado sensível) | **IMPLEMENTADO E TESTADO** | `src/lib/observabilidade.ts`, 5 testes unitários verdes |
| Aplicado nos 3 crons (`disparar-alarmes`, `gerar-contas-fixas`, `reengajamento-lab`) | **IMPLEMENTADO NÃO VALIDADO** | Código compila e builda; execução real só acontece em produção/staging com o cron rodando de verdade (não simulável sem banco nesta sessão) |
| Aplicado em mutations críticas fora dos crons (Kanban, Financeiro, Equipe) | **PROPOSTO** | Fora do escopo mínimo desta rodada — essas Server Actions já lançam `Error` com mensagem específica tratada caso a caso; instrumentar tudo de uma vez era desproporcional ao risco atual (ver Blueprint, decisão registrada) |
| Serviço externo de observabilidade (Sentry ou equivalente) | **PROPOSTO** | Vetado explicitamente nesta rodada pelo prompt de consolidação ("não criar conta/assinatura paga"); ver questão de decisão no relatório do P0 |

### 5.3 Controle de consumo de IA

| Item | Estado | Evidência |
|---|---|---|
| Rate limit atômico em 3 camadas (usuário/workspace/global), no Postgres | **IMPLEMENTADO NÃO VALIDADO** (lógica de janela testada; contagem atômica real não) | `supabase/migrations/0046_rate_limit_ia.sql` + `src/lib/ecc/ia-rate-limit.ts`; 6 testes unitários cobrem `inicioDoMinuto`/`inicioDaHora` (determinístico, sem banco); a função SQL `ia_registrar_tentativa` em si não foi exercitada contra Postgres real nesta sessão (mesmo impedimento do Docker) |
| Aplicado nos 2 pontos reais de chamada de IA (transcrição de voz, explicação de alinhamento) | **IMPLEMENTADO NÃO VALIDADO** | Código integrado em `transcricao-audio.ts`/`explicacao-alinhamento.ts`, compila e builda; validação end-to-end depende do mesmo banco indisponível |
| Fail-closed (bloqueia se a checagem falhar) | **IMPLEMENTADO E TESTADO** (via leitura de código + teste de log) | `verificarRateLimitIA` devolve `permitido: false` em qualquer erro do RPC, registra via `observabilidade.ts` |
| Anthropic/entrevista conversacional ativada | **Deliberadamente NÃO feito** | Prompt de consolidação veda ativar código desconectado nesta rodada |

### 5.4 Metas e onboarding

| Item | Estado | Evidência |
|---|---|---|
| `salvarMetasSmart` — upsert real por `(tenant_id, horizonte)`, preserva id/vínculos | **IMPLEMENTADO NÃO VALIDADO** (compila e builda; upsert real contra Postgres não exercitado) | `src/lib/ecc/actions.ts`; índice único em `supabase/migrations/0045_...sql`; teste de integração pronto em `tests/integration/metas-smart-upsert.test.ts` (não executado, mesmo impedimento) |
| Onboarding reabre preenchido para edição (não mais só uma mensagem estática) | **IMPLEMENTADO NÃO VALIDADO** | `src/app/onboarding/page.tsx` + `FormularioSmart` atualizados, build passa; não testado num navegador real nesta sessão (sem app rodando) |
| "Pular" grava estado persistido (`tenants.onboarding_metas_pulado_em`) | **IMPLEMENTADO NÃO VALIDADO** | `pularOnboarding()` em `actions.ts`; migration 0045; mesmo impedimento de validação end-to-end |
| Dashboard não força mais redirect pra quem já pulou | **IMPLEMENTADO NÃO VALIDADO** | `src/app/page.tsx` — build passa, comportamento não visto rodando |
| Reconciliação de usuários antigos sem apagar dado | **IMPLEMENTADO** (por desenho, não por migração de dado) | Coluna nova é `nullable` sem default — ninguém preexistente teve estado alterado; quem já pulou antes desta migration vê o onboarding uma vez a mais até pular de novo (comportamento aceito, documentado) |

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

---

## P2 — Direção documentada, NÃO implementada nesta sessão

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
