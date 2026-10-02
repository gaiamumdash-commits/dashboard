# Gaiamum — Relatório: Criação de projeto com planejamento assistido por IA

**Data:** 2026-10-02. **Branch:** main. **Pedido:** Fabio, handoff canônico checkpoint #62, item 2 das pendências.

---

## 1. Comportamento entregue

Ao criar um projeto, a pessoa agora escolhe entre dois caminhos (modal "Novo projeto", substitui o form inline anterior):

- **"Criar por conta própria"** — exatamente como antes, nenhuma chamada de IA.
- **"Planejar com IA"** — descreve o objetivo por texto ou voz (reaproveita `GravadorVozAgenda`, voz→texto via Web Speech API ou transcrição Gemini no Safari/iOS, igual à Agenda), toca em "Gerar sugestões", revisa uma prévia de 8-20 cartões (título/descrição editáveis, recomendação essencial/opcional, checklist interno expansível e editável), seleciona o que quer (com atalhos "Selecionar essenciais"/"Selecionar todas"/"Limpar seleção", contador "Você selecionou N tarefas", e pode adicionar tarefas manualmente), e confirma. Se o contexto for vago demais, a IA pode responder com até 3 perguntas curtas antes de gerar a prévia.

Ao confirmar: cria o projeto, as 4 colunas padrão de sempre (Hoje → Tarefas → Em Desenvolvimento → Concluído — **inalteradas**, essa estrutura já era a de fábrica desde a sessão anterior) e só os cartões selecionados, todos na coluna "Tarefas", não concluídos, com os checklists internos também não concluídos. Abre o quadro do projeto novo em seguida.

A coluna "Compromissos" já era (antes desta rodada) uma visualização derivada renderizada à parte (`ColunaCompromissosDoDia`), nunca uma coluna persistida — nada mudou aí, confirmado durante a inspeção.

Nenhuma chamada de IA acontece ao editar, selecionar ou navegar entre as etapas da prévia — só ao tocar explicitamente em "Gerar sugestões" ou "Regenerar" (que avisa antes que vai substituir a prévia atual).

## 2. Arquivos alterados/criados

**Novos:**
- `supabase/migrations/0051_planejamento_assistido_ia_projetos.sql` — tabela `projeto_criacao_idempotencia` + função `criar_projeto_planejado_ia` (RPC, SECURITY INVOKER, atômica e idempotente).
- `src/lib/ecc/planejamento-ia.ts` — lógica pura (sem rede, sem banco): tipos, schema zod de validação/saneamento da resposta da IA, construção do prompt, funções de seleção da prévia, schema de validação da confirmação.
- `src/lib/ecc/planejamento-ia-actions.ts` — Server Actions `gerarSugestoesProjetoIA` e `criarProjetoComPlanejamentoIA`.
- `src/lib/ecc/__tests__/planejamento-ia.test.ts` (18 testes) e `src/lib/ecc/__tests__/planejamento-ia-actions.test.ts` (10 testes, com stub de IA).
- `tests/integration/criar-projeto-planejado-ia.test.ts` (5 testes contra Postgres real — ver seção 5 sobre execução).

**Alterados:**
- `src/lib/ecc/gemini.ts` — nova função `gerarJsonComGemini` (modo JSON do Gemini, `responseMimeType`/`responseSchema`), mesmo padrão de `gerarTextoComGemini`/`transcreverAudioComGemini` já existentes.
- `src/lib/ecc/actions.ts` — `criarProjeto` agora retorna `{ id }` (antes não retornava nada) — usado pelo caminho "Criar por conta própria" do novo modal pra navegar direto ao quadro; não quebra o uso existente como `<form action={criarProjeto}>` (que sempre ignorou o retorno).
- `src/components/projetos/formulario-novo-projeto.tsx` — reescrito por completo: era um form inline de 2 campos, agora é o modal com os dois caminhos (manual/IA) e os passos de contexto → esclarecimento (se preciso) → prévia. Mesmo nome de export (`FormularioNovoProjeto`), `src/app/projetos/page.tsx` não precisou mudar.
- `docs/gaiamum/GAIAMUM-BACKLOG-CONSOLIDACAO.md` — novo item P1-Q.
- `docs/gaiamum/GAIAMUM-BLUEPRINT-PRODUTO-v1.md` — atualizada a contagem de pontos reais de uso do Gemini (seção 3).

## 3. Migration necessária

`0051_planejamento_assistido_ia_projetos.sql` — **não aplicada em produção nesta rodada** (pedido explícito do Fabio). Precisa ser aplicada (SQL Editor do Supabase, mesma rotina das migrations 0048-0050) antes do deploy do código desta feature — senão a RPC `criar_projeto_planejado_ia` não existe e a confirmação do planejamento com IA falha (o caminho "Criar por conta própria" continua funcionando normalmente, não depende da migration nova).

Conteúdo: tabela `projeto_criacao_idempotencia` (idempotência de clique duplo/retry) + função `criar_projeto_planejado_ia` (cria projeto + colunas padrão + tarefas selecionadas + checklists, tudo numa transação). `SECURITY INVOKER` (não `SECURITY DEFINER`) — roda com os mesmos privilégios RLS de quem chama, não abre nenhum acesso que `criarProjeto` já não desse.

## 4. Testes e resultados

- `npm test`: **108 passando**, 50 pulados (os de integração/RLS, que exigem Postgres local — Docker Desktop indisponível nesta sessão, mesma limitação já documentada em `tests/integration/README.md`). Nenhuma regressão nos testes pré-existentes.
- `npx tsc --noEmit`: limpo.
- `npx eslint` nos arquivos novos/alterados: limpo.
- `npm run build`: limpo, todas as rotas geradas normalmente.

**Testes unitários novos (stub de IA — nunca chamam o Gemini de verdade):**
- Validação/saneamento da resposta da IA: JSON inválido, fora do schema, sugestão sem título descartada, corte de quantidade (>20) e de tamanho de texto, corte de checklist (>15 itens/tarefa), resposta de "precisa esclarecimento" (até 3 perguntas).
- Funções de seleção da prévia (selecionar essenciais/todas, limpar, adicionar manual).
- Validação da confirmação (schema zod): payload válido aceito, tarefa sem título rejeitada, excesso de tarefas rejeitado, idempotencyKey ausente rejeitada.
- Server Actions: usuário sem permissão (não-owner) nunca chama o Gemini nem a RPC; rate limit bloqueado nunca chama o Gemini; contexto vazio nunca chama o Gemini; resposta malformada do Gemini vira erro recuperável (nunca lança exceção, por causa da redação de erros do Next em produção — `src/lib/erro-cliente.ts`); falha do provedor registra consumo como falha; confirmação chama a RPC com `tenant_id` resolvido no servidor, nunca do input.

**Testes de integração novos (prontos, não executados nesta sessão — mesma pendência de infraestrutura do restante do projeto):**
- Criação atômica: projeto + 4 colunas + só os cartões enviados (com checklist) na coluna "Tarefas", gestor = quem criou.
- Idempotência: duas chamadas com a mesma chave nunca criam um 2º projeto.
- Quem não é owner do tenant é rejeitado (não cria projeto nem tarefa).
- `tenant_id` de um workspace onde o chamador não é owner é rejeitado (isolamento entre tenants).
- Mais de 20 tarefas é rejeitado pela função (defesa em profundidade, além do limite já aplicado em TypeScript).

**Não coberto por teste automatizado (avaliação de qualidade real, não é prova de qualidade de um stub):** qualidade das sugestões para os 5 cenários pedidos (aniversário de 8 anos/30 pessoas, orçamento baixo + exclusão explícita "não quero DJ", projeto profissional com prazo, contexto incompleto, execução individual) — depende de uma chamada real ao Gemini, que só o Fabio pode avaliar em uso real (roteiro de teste na seção 6).

## 5. Limites de consumo de IA (reaproveitados, nenhum novo criado)

- Rate limit (`ia-rate-limit.ts`, já existente): por usuário/minuto, por workspace/hora, por global/hora — os mesmos limites de sempre, sem trocar as 3 camadas nem os valores default.
- Log de consumo (`ia-consumo.ts`, já existente): cada geração de sugestões registra sucesso/falha, provedor, modelo e tokens — nunca o conteúdo do contexto digitado/falado pela pessoa.
- Uma chamada de IA por ação explícita ("Gerar sugestões"/"Regenerar") — nunca disparada ao editar, selecionar ou navegar.
- Contexto enviado ao Gemini é só o texto descrito pela pessoa (+ eventuais respostas de esclarecimento) — nunca o banco inteiro nem dado de outros projetos.
- Se a IA estiver indisponível (rate limit, erro do provedor, resposta malformada), a prévia anterior (se houver) é preservada e o caminho manual continua disponível a qualquer momento.

## 6. Pendências reais

- Migration 0051 precisa ser aplicada manualmente em produção antes do deploy (mesma rotina já usada pras migrations 0048-0050) — não feito nesta rodada, por pedido explícito.
- Testes de integração da RPC estão prontos mas não executados (falta Postgres de teste local/Docker) — mesma pendência já registrada pro resto do projeto.
- Qualidade real das sugestões da IA não avaliada com chamada real (só com stub) — depende do teste do Fabio em uso real.
- Fora de escopo desta rodada (não tocado): temporizador de hiperfoco (pendência seguinte, já registrada no handoff).

## 7. Roteiro curto de teste (Fabio, celular)

1. Abrir `/projetos`, tocar em "+ Novo projeto".
2. Preencher nome (ex.: "Aniversário do João"), tocar em "✨ Planejar com IA".
3. Descrever o contexto por voz ou texto: *"Quero organizar o aniversário de oito anos do meu filho para 30 pessoas. Vou organizar sozinho, quero fazer em um salão e tenho orçamento de R$ 3.000."*
4. Tocar em "Gerar sugestões" — conferir que aparece uma prévia com ~8-15 tarefas, todas desmarcadas.
5. Tocar em "Selecionar essenciais", revisar, desmarcar/editar o que não fizer sentido, abrir um checklist pra conferir os passos internos.
6. Tocar em "Criar projeto com as tarefas selecionadas" — conferir que o quadro abre com exatamente as tarefas escolhidas, todas em "Tarefas", nenhuma em "Hoje"/"Em Desenvolvimento"/"Concluído".
7. Repetir o fluxo dizendo explicitamente "não quero DJ" em algum ponto do contexto — conferir que a prévia não sugere DJ.
