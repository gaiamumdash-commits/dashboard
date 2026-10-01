# Gaiamum — Blueprint de Produto v1

**Criado:** 2026-09-30, como parte da Consolidação Inteligente P0.
**Escopo deste documento:** decisões permanentes de produto/arquitetura/segurança/governança. Detalhe de execução de uma sessão fica no relatório de incremento (`GAIAMUM-RELATORIO-INCREMENTO-P0.md`) ou no handoff histórico, não aqui.

---

## 1. Objetivo do produto

Combinar, de forma simples, Projetos + Tarefas + Páginas (conhecimento) + Calendário + Financeiro + Metas + inteligência artificial — sem virar uma cópia do Notion/Trello/ClickUp. Princípio central: **o Gaiamum ajuda a executar e decidir, não cria mais trabalho de organização.**

Público-alvo do piloto: empreendedores individuais, consultores, prestadores de serviço, profissionais com múltiplos projetos, gestores de pequenas equipes.

## 2. Princípios canônicos (valem para toda mudança futura)

1. Cada mudança precisa economizar tempo, evitar erro, melhorar decisão ou favorecer execução.
2. Não pedir de novo uma informação que já pode ser obtida com qualidade dos dados existentes.
3. Priorizar integração e confiabilidade antes de adicionar módulo novo.
4. SQL/cálculo/regra produz fato; LLM interpreta ou redige só quando acrescenta valor real — nunca onde determinismo resolve com a mesma qualidade e menor custo.
5. Progresso operacional (tarefas concluídas) ≠ resultado de negócio (meta atingida) — os dois são medidos e mostrados separadamente, nunca um em nome do outro.
6. Interface simples, em português, responsiva, consistente com os componentes existentes.
7. Limites entre tenant, projeto, usuário e o Gaiamum Lab (fictício) são invioláveis — nunca misturar dado do Lab com dado real.
8. Financeiro é owner-only — nenhuma integração nova concede acesso a quem não tinha permissão antes dela.
9. Gaiamum é um projeto independente — nada aqui toca UltraQuadras, FAMA, CV Hunter ou qualquer outro projeto do mesmo desenvolvedor.

## 3. Arquitetura atual confirmada (2026-09-30)

Reconfirmado nesta sessão, em cima da auditoria de código de 2026-09-30
(`GAIAMUM-HANDOFF-CANONICO-ESTADO-ATUAL.md`, que continua sendo a fonte
detalhada — este Blueprint resume só o que é permanente):

- **Stack:** Next.js 16 (App Router) + TypeScript + Supabase/Postgres com Row Level Security como autoridade de autorização + Tailwind/Mantine + BlockNote (editor de páginas livres).
- **Lógica de negócio:** inteira em `src/lib/ecc/*.ts` (Server Actions `"use server"`) — não há API REST própria além dos crons e do callback OAuth.
- **Multi-tenant:** `tenants` + `memberships` (papel owner/member × escopo completo/projeto) + `projeto_membros` (gestor/usuario dentro de um projeto) — 3 dimensões de permissão compostas, não uma hierarquia única.
- **IA:** dois provedores no projeto — Gemini (`gemini.ts`), realmente usado em 2 pontos (transcrição de voz, explicação do score de Alinhamento); Anthropic (`ia.ts`), código pronto para uma entrevista conversacional que **não está no fluxo real de produção** (o fluxo real cola texto de uma conversa feita fora do Gaiamum e faz parsing determinístico).
- **"Alinhamento Gaiamum" (Visão 360°):** score 100% determinístico (fórmula com pesos redistribuídos conforme dado disponível), com uma explicação textual opcional gerada por IA — nunca o contrário.
- **Sem rede de testes/CI antes do P0** — corrigido nesta sessão (seção 5).
- Detalhe completo, tabela por tabela e módulo por módulo: ver o handoff canônico.

## 4. Arquitetura proposta (o que este P0 mudou)

- **Testes:** Vitest para lógica pura + integração/RLS (estrutura pronta, ver `tests/integration/`); CI no GitHub Actions rodando lint/tipos/testes/build em todo push/PR.
- **Observabilidade:** `src/lib/observabilidade.ts` — log estruturado (JSON, id de correlação, operação, severidade, contexto sem dado sensível) aplicado nos 3 crons por enquanto; sem serviço externo pago.
- **Rate limit de IA:** `src/lib/ecc/ia-rate-limit.ts` + `ia_rate_limit`/`ia_registrar_tentativa` (migration 0046) — contagem atômica no Postgres, 3 camadas (usuário/workspace/global), fail-closed.
- **Metas SMART:** upsert real por `(tenant_id, horizonte)` (índice único, migration 0045) — `salvarMetasSmart` substitui o antigo `criarMetasSmart` (insert puro). Onboarding reabre preenchido para edição.
- **Onboarding:** `tenants.onboarding_metas_pulado_em` (migration 0045) — "pular" agora é um estado persistido, não só um redirect.

## 5. Decisões tomadas nesta rodada (P0)

| Decisão | Alternativas consideradas | Por quê |
|---|---|---|
| Update explícito por `id` (não upsert genérico) por `(tenant_id, horizonte)`, com índice único como backstop de corrida — corrigido na validação, ver `GAIAMUM-RELATORIO-INCREMENTO-P0.md` seção 2 | 1ª versão usava `.upsert()`; versionar cada edição numa tabela de histórico separada | O prompt de consolidação pediu explicitamente "update explícito autorizado, não upsert genérico"; update por `id` é a expressão mais direta de "preservar esta meta"; histórico de versão fica fora de escopo do P0 (não é módulo OKR) |
| Rate limit em 3 camadas (usuário/workspace/global) no Postgres | Rate limit só em memória do processo | Serverless não compartilha memória entre instâncias — só banco garante atomicidade real entre instâncias concorrentes |
| Fail-closed no rate limit (bloqueia se não conseguir checar) | Fail-open (deixa passar se a checagem falhar) | Custo de uma tentativa bloqueada é sempre zero; fail-open poderia deixar passar uma rajada sem limite justo quando o controle está com problema |
| Observabilidade só nos 3 crons nesta rodada, não em toda Server Action | Instrumentar tudo de uma vez | Proporcional ao risco: crons são o ponto mais silencioso (ninguém vê a resposta HTTP deles); as ~90 Server Actions já lançam `Error` com mensagem específica, tratado caso a caso |
| Sem serviço de observabilidade externo (Sentry etc.) nesta rodada | Integrar Sentry free tier | Prompt de consolidação veda criar conta/assinatura nova nesta rodada; fica como decisão explícita pro P1/P2 (ver Backlog) |
| CI só com testes unitários, sem integração/RLS rodando automaticamente | Subir Postgres/Supabase no runner do GitHub Actions | Escopo mínimo desta rodada; os testes de integração/RLS já rodam de verdade LOCALMENTE (Docker foi localizado e usado na sessão de validação), só não estão automatizados no CI remoto ainda — ver Backlog |
| Corrigir `membros_do_tenant()` (vazamento de e-mail pra escopo='projeto') DENTRO do fechamento do P0, não adiar para P1 | Deixar para P1-E como planejado inicialmente na validação | Achado de segurança real e confirmado (não hipotético) — mapeamento completo dos 4 consumidores mostrou que a correção era pequena e segura (filtro dentro da própria function, sem tocar em nenhum call site); reclassificado como pendência de fechamento do P0, não item de produto novo |
| Correção no banco (função SQL), não só na aplicação | Filtrar em `listarMembros()`/`equipe.ts` na camada de aplicação | Mesmo padrão já usado no resto do projeto (RLS/função é a autoridade, aplicação é defesa em profundidade) — um filtro só na aplicação não impede a chamada direta à RPC, que era exatamente o vetor do vazamento |

## 5.1 Decisões permanentes adicionadas no incremento de Experiência Mobile (2026-09-30/10-01)

| Decisão | Alternativas consideradas | Por quê |
|---|---|---|
| @menção/atribuição continua usando o e-mail como identificador (gravado literal no texto); o(s) owner(s) do tenant sempre aparecem, com e-mail, pra qualquer membro do workspace (mesmo escopo='projeto') | Mascarar o e-mail do owner na exibição; migrar @menção para usar `user_id` opaco | O e-mail é a chave funcional da @menção nesta arquitetura — mascará-lo ou trocá-lo quebraria menções já salvas e exigiria migração de dado; o owner pode legitimamente ser atribuído/mencionado em qualquer projeto do tenant (acesso RLS completo), então mostrar seu e-mail é exposição necessária, não dispensável (ver `GAIAMUM-RELATORIO-INCREMENTO-MOBILE-E-AJUSTES-P0.md` seção 4) |
| Layout mobile do Kanban usa breakpoint de LARGURA (`sm`=640px pra largura de coluna, `lg`=1024px pra altura/scroll interno) combinado com `pointer: coarse` (toque) pra decidir quando mostrar a barra de navegação — não só largura | Decidir só por largura (`sm:hidden`) | Um celular deitado facilmente ultrapassa 640-900px de largura e cairia no layout "desktop" só por isso, embora continue sendo touch, não mouse — "largura da tela e capacidade de entrada são coisas diferentes" (dito explicitamente no pedido); a combinação evita essa regressão sem esconder a barra em notebooks/tablets touch |
| "Mover para..." (coluna/turno/posição Início-Fim) como alternativa ao arrasto, nunca substituto | Substituir o arrasto por "Mover para..." como interação padrão | Decisão revertida nesta rodada por pedido explícito do Fabio: o arrasto mobile funciona e deve ser preservado/melhorado; "Mover para..." resolve só o caso difícil (fim→início de coluna longa) sem remover a forma como as pessoas já usam o quadro |
| Pinça (zoom) para ver o quadro inteiro não foi implementada; "Visão geral" cobre essa necessidade | Implementar gesto de pinça customizado | Pinça customizada competiria com zoom nativo do navegador e com rolagem/arrasto já existentes no mesmo elemento — risco de regressão desproporcional ao ganho; ver seção 8 do relatório do incremento |

## 6. Fora de escopo nesta rodada (documentado, não implementado)

Ver `GAIAMUM-BACKLOG-CONSOLIDACAO.md` para P1/P2 completos com critérios de aceite. Registro rápido do que foi deliberadamente NÃO tocado:

- Módulo OKR / ciclo completo de metas (criar, revisar, concluir, abandonar).
- Pulso Gaiamum (dashboard com alertas determinísticos + síntese opcional por IA).
- Ações a partir da Página livre (BlockNote → criar tarefa/decisão).
- Evolução do Freeze/consolidação de projeto (baseline, "o que mudou").
- Financeiro por projeto (agregação com `projeto_id`).
- Ativação do código de entrevista conversacional via Anthropic.
- Renomeação de papéis para linguagem mais simples (Administrador/Gestor/Participante).
