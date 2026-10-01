# Gaiamum — Relatório do Incremento: Experiência Mobile do Kanban + Ajustes da Revisão do P0

**Branch:** `consolidacao/p0-confiabilidade-metas` (mesma do P0, não mesclada, não publicada)
**Executor:** Claude Code (Sonnet 5)
**Fonte:** prompt de consolidação "Experiência mobile e ajustes da revisão P0" (2026-09-30/10-01), que substitui qualquer instrução anterior que recomendasse remover o arraste mobile.

Este documento usa os mesmos 4 rótulos do Backlog, sem meio-termo: **IMPLEMENTADO E VALIDADO**, **IMPLEMENTADO NÃO VALIDADO**, **PROPOSTO**, **BLOQUEADO**.

---

## 1. O que mudou para o usuário

- **Celular em pé**: o Kanban agora mostra **uma coluna por vez**, ocupando quase toda a largura da tela (antes mostrava ~1,5 coluna cortada). Deslizar o dedo horizontalmente passa pra próxima coluna (com "encaixe" automático); dentro da coluna, rolar verticalmente percorre os cartões normalmente.
- **Cabeçalho novo** acima do quadro (só no celular): nome da coluna atual, quantas tarefas ela tem, "Coluna X de Y", setas ‹ › e um seletor de coluna (`<select>`) como alternativa a arrastar o dedo.
- **Botão "⊞ Visão geral"**: abre um painel com todas as colunas em miniatura (nome, contagem, 3 primeiros títulos); tocar numa leva direto pra ela. Funciona em pé e deitado.
- **Celular deitado**: a tela mostra mais de uma coluna (como no computador), e o cabeçalho de navegação continua disponível — diferente de antes, em que deitar o celular simplesmente caía no layout de desktop sem nenhuma ajuda de navegação por toque.
- **Arrasto preservado e com 2 formas de iniciar**: segurar o cartão em qualquer lugar continua funcionando (~0,3s), E agora existe uma alcinha "⠿" no canto do cartão que arrasta na hora, sem precisar segurar — útil quando se quer ter certeza de que está arrastando, não rolando.
- **"Mover para..." (⇄)**: botão novo em todo cartão. Abre um menu pequeno pra escolher coluna, turno (se a coluna for dividida) e **Início ou Fim** — resolve de forma direta o caso difícil de "pegar um cartão no fim de uma lista longa e levar pro início", sem precisar arrastar a tela toda.
- **Abrir um cartão no celular** agora usa a tela inteira (antes era uma janela pequena no meio da tela), com um X bem visível pra fechar; fechar volta pra mesma coluna de onde você abriu.
- **Nada mudou no computador**: colunas de 256px lado a lado, arrastar com o mouse, mesmo visual de sempre.

---

## 2. Causas identificadas e solução aplicada

### 2.1 Causa do desconforto relatado ("cartão se move sem querer", "difícil navegar")

Confirmado em código (sessão anterior) e agora corrigido:

1. **Largura fixa de 256px por coluna** num celular de ~390px mostrava coluna e meia — difícil de ler, difícil de saber onde se está. **Solução**: coluna com `85vw` (quase a tela toda) em retrato; `256px` continua valendo a partir de 640px de largura (inclui celular **deitado**).
2. **Ambiguidade entre rolar e arrastar**: o único jeito de iniciar arrasto no celular era segurar ~300ms em qualquer parte do cartão — competia com o início de uma rolagem lenta. **Solução**: alça dedicada (⠿) que arrasta na hora sem ambiguidade nenhuma, mantendo o "segurar em qualquer lugar" como estava (preservado, não removido). Além disso, o temporizador de 300ms agora é cancelado também se o navegador já estiver de fato rolando o container (ouvinte de `scroll` nativo), não só se o dedo tiver andado mais de alguns pixels.
3. **Sem forma rápida de ir do fim ao início de uma coluna longa.** **Solução**: "Mover para..." com Início/Fim, testado especificamente nesse cenário (seção 5).
4. **Altura sem limite**: as colunas cresciam até caber todos os cartões, empurrando a rolagem pra página inteira (que ainda por cima tinha um bug de ultrapassar a tela — item 2.2). **Solução**: coluna com altura limitada e rolagem própria até 1024px de largura (cobre retrato e paisagem de celular/tablet); acima disso (desktop real) continua crescendo livre, como sempre foi.

### 2.2 Achado real de bug, não só desconforto: rolagem horizontal da PÁGINA INTEIRA

Durante o teste em viewport 390px (Playwright), a página inteira tinha rolagem horizontal própria (`scrollWidth: 1152px` contra `innerWidth: 390px`), competindo com a rolagem do próprio quadro. Causa: o `<main>` da página de tarefas é um item `flex-1` dentro de um container `flex-col` (menu lateral empilhado acima dele no celular) — sem `min-width`/`width` explícitos, ele cresceu pra caber o conteúdo largo do Kanban em vez de respeitar a largura do pai. Isso provavelmente já acontecia **antes** desta rodada (as 4 colunas de 256px fixas já somavam mais que 390px), só que menos perceptível.

**Correção** (`src/app/projetos/[id]/tarefas/page.tsx`): `w-full min-w-0` no `<main>` + `overflow-x-hidden` como rede de segurança no container pai. Confirmado antes/depois via `document.documentElement.scrollWidth` em 360px, 390px, 430px e 844px (paisagem) — igual à largura da tela nos quatro casos.

### 2.3 Achado real de bug: *stale closure* no arrasto por toque

Ao testar o arrasto via simulação de eventos de toque, a reordenação simplesmente não acontecia na primeira tentativa. Causa: `moverArrastoToque`/`soltarArrastoToque` liam `arrastoToque.tarefaId` do **estado React** (que é atualizado de forma assíncrona/batched) em vez de receber o id por parâmetro — se um `touchmove` chegasse antes do React ter re-renderizado depois do `touchstart`, a função via o estado ainda como `null` e não fazia nada. **Corrigido**: as duas funções agora recebem `tarefaId` explícito (mesmo padrão que `iniciarArrastoToque` já usava), eliminando a dependência do timing de render. Reproduzido e confirmado corrigido via teste (seção 5).

### 2.4 Achado real, menor: `key` ausente numa lista React

O React avisava "Each child in a list should have a unique key prop" — a coluna de compromissos (`colunaCompromissos`, prop vinda do servidor) era intercalada solta entre colunas de uma lista `.map()`, sem `key`. Pré-existente (confirmado no `HEAD` antes desta rodada, não é regressão), corrigido com um wrapper `key` + `display:contents` (não afeta o layout).

---

## 3. Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `src/components/kanban/quadro-kanban.tsx` | Reescrito: layout mobile (coluna única + scroll-snap), cabeçalho de navegação, "Visão geral", auto-scroll durante arrasto por toque, indicador de destino durante arrasto por toque, "Mover para..." (nova função `moverPara` com parâmetro de extremidade), correção do stale closure, correção da `key`, `min-w-0`/`overflow-x-hidden` |
| `src/components/kanban/cartao-tarefa.tsx` | Alça de arrasto dedicada (⠿), botão "Mover para..." (⇄), cancelamento do long-press por rolagem real detectada, supressão do clique fantasma pós-arrasto, `data-tarefa-id` novo (usado pro indicador de destino) |
| `src/components/kanban/mover-para-menu.tsx` | **Novo** — popover "Mover para" (coluna/turno/posição) |
| `src/components/kanban/detalhe-tarefa.tsx` | Tela cheia no celular (`sm:` preserva o modal centralizado de antes), cabeçalho fixo com botão de fechar sempre visível, `safe-area-inset-top/bottom` |
| `src/app/projetos/[id]/tarefas/page.tsx` | `min-w-0`/`w-full` no `<main>`, `overflow-x-hidden` no container — corrige o overflow horizontal da página (seção 2.2) |
| `src/lib/ecc/kanban.ts` | 2 funções puras novas, testáveis: `encontrarColunaEmFoco` (qual coluna está em foco durante o swipe) e `calcularVelocidadeAutoScroll` (velocidade do auto-scroll perto da borda) |
| `src/lib/ecc/ia-rate-limit.ts` | Ajuste A (ver seção 5) |
| `src/lib/ecc/__tests__/kanban.test.ts` | +10 testes (`encontrarColunaEmFoco`, `calcularVelocidadeAutoScroll`) |
| `src/lib/ecc/__tests__/ia-rate-limit-mock.test.ts` | +2 testes (curto-circuito do rate limit) |
| `tests/integration/rls-limites-entre-projetos.test.ts` | +1 teste (`[DOCUMENTA EXPOSIÇÃO ACEITA]`, ver seção 4) |
| `docs/gaiamum/GAIAMUM-RELATORIO-INCREMENTO-P0.md` | Correção de redação na seção 4 e na matriz (seção 7) — "nenhuma exposição residual" era impreciso |
| `docs/gaiamum/GAIAMUM-BACKLOG-CONSOLIDACAO.md` | Correções de redação (itens 5.2, 5.3, 5.5) + novos itens P1-F (concluído) e P1-G (proposto) |

**Nenhuma migration nesta rodada.** Nenhuma mudança de schema.

---

## 4. Ajuste A — Privacidade de membros (`membros_do_tenant()`)

**Pedido:** mapear consumidores, confirmar campos realmente necessários, preferir identificação suficiente sem divulgar e-mails desnecessários, manter resolução de notificação no servidor, não remover o owner do seletor se puder receber tarefas legitimamente, preparar correção aditiva e testes se necessário, corrigir a afirmação "nenhuma exposição residual".

**Investigação:**

1. **Mapeamento de uso do e-mail** (não só do `user_id`) nos 3 lugares que consomem `MembroTenant.email`:
   - `src/lib/ecc/mencoes.ts` — `aplicarMencao`/`extrairIdsMencionados`/`dividirTextoPorMencoes`: o texto salvo em comentários/descrições/checklist grava **o e-mail literal** (`@fulano@dominio.com`), não um ID opaco. Reconhecer uma menção depois (pra renderizar o chip, pra notificar) depende de reencontrar esse e-mail exato na lista de `MembroTenant`.
   - `src/components/avatar-iniciais.tsx` (via `corAvatarPorEmail`) — cor e iniciais do avatar são derivadas do e-mail.
   - `src/components/kanban/detalhe-tarefa.tsx` — seletor "Membros" mostra `email.slice(0,2)` como iniciais e o e-mail completo no `title` (tooltip).
2. **Conclusão**: nesta arquitetura, o e-mail **não é um dado de exibição opcional** — é a chave funcional da @menção. Trocá-lo por um identificador mascarado quebraria a @menção pra quem só tem acesso ao owner por essa via (ela compararia contra um valor diferente do que está gravado no texto).
3. **Quem realmente aparece hoje pra um convidado de `escopo: 'projeto'`, além dos colegas do próprio projeto**: só o(s) **owner(s)** do tenant — nunca outro `member`. A regra (`or m.papel = 'owner'`, migration 0047) existe porque um owner tem acesso RLS completo a qualquer projeto do tenant, então pode legitimamente ser atribuído/mencionado em qualquer quadro, mesmo um que ele não administra diretamente.

**Decisão (nenhuma mudança de código na function):** a exposição do e-mail do owner para convidados de projeto é **necessária para a funcionalidade existir**, não um descuido — diferente do vazamento original (que expunha **qualquer** membro do workspace, não só owners). Reduzir isso exigiria **mudar a regra de negócio** ("owner só pode ser atribuído em projetos onde está explicitamente listado") ou **redesenhar a @menção pra usar ID em vez de e-mail** — ambos fora do escopo desta rodada ("menor mudança necessária", "não criar sistema novo").

**O que foi feito, então:**
- **Teste novo** (`tests/integration/rls-limites-entre-projetos.test.ts`, caso `[DOCUMENTA EXPOSIÇÃO ACEITA]`): cria um **2º owner sem nenhuma linha em `projeto_membros`** de nenhum projeto e confirma que ele aparece, com e-mail, pra convidados de projeto dos dois quadros — isolando exatamente o cenário da exposição residual, pra ela ficar testada e documentada, não assumida.
- **Correção de redação**: `GAIAMUM-RELATORIO-INCREMENTO-P0.md` (seção 4 e matriz da seção 7) e `GAIAMUM-BACKLOG-CONSOLIDACAO.md` (item 5.5) deixam de dizer "nenhuma exposição residual" e passam a distinguir "acesso necessário" (owner, documentado e testado) de "exposição dispensável" (member de outro projeto — isso sim foi eliminado pela migration 0047, continua corrigido).
- **Resolução de destinatário de notificação continua no servidor**: `registrarAtividade()`/`atividade.ts` resolvem quem notificar inteiramente no servidor, antes de qualquer resposta ao cliente — não mudou nesta rodada.
- **Owner não foi removido do seletor** — continua podendo ser atribuído/mencionado, como já valia antes.

---

## 5. Ajuste B — Rate limit de IA

**Pedido:** documentar que os limites controlam frequência, não garantem orçamento diário/mensal; conferir o comportamento das 3 RPCs paralelas quando uma bloqueia (as outras cotas são consumidas? esgotamento cruzado? falha parcial explícita?); não chamar a operação conjunta de "transacional" se só cada RPC isolada for atômica; corrigir com a menor mudança necessária.

**Achado real, confirmado por teste (não só suposição):** a 1ª versão de `verificarRateLimitIA` (`src/lib/ecc/ia-rate-limit.ts`) chamava as 3 RPCs com `Promise.all` — ou seja, **as 3 incrementavam o contador antes de qualquer uma ser checada**. Uma tentativa bloqueada no limite de **usuário** (o mais restrito, 3/minuto por padrão) ainda consumia 1 unidade da cota de **workspace** e 1 da **global** — cotas compartilhadas com todo mundo. Como o limite de usuário reseta a cada minuto, um único usuário martelando o botão podia, em volume, esgotar a cota de workspace/global sem **nenhuma** chamada real de IA acontecer, derrubando o serviço pra gente legítima.

**Correção** (mesma função pública, mesma assinatura — nenhum call site mudou): a verificação agora é **sequencial, com curto-circuito**, em ordem de granularidade crescente (usuário → workspace → global). Uma tentativa só chega a consumir cota de workspace/global depois de já ter passado pelo limite (mais restrito) do próprio usuário que a fez. Fail-closed preservado (qualquer erro de RPC bloqueia imediatamente, sem chamar as camadas seguintes).

**Validado:** `src/lib/ecc/__tests__/ia-rate-limit-mock.test.ts` — os 6 testes antigos continuam passando (comportamento observável é o mesmo pro caso feliz e pros 3 casos de bloqueio isolado) + 2 testes novos que prOvam o curto-circuito contando quantas vezes o RPC mockado foi chamado: bloqueio por usuário → só 1 chamada (nunca chega a workspace/global); bloqueio por workspace → 2 chamadas (nunca chega a global). 8/8 passando.

**Documentação corrigida** (comentário no código + `GAIAMUM-BACKLOG-CONSOLIDACAO.md` item 5.3): "atômico" se aplica a cada RPC isolada (upsert com lock de linha), nunca à verificação conjunta das 3 (não existe rollback cruzado — nunca foi chamada de "transacional" nos documentos, mas a frase "rate limit atômico em 3 camadas" podia ser mal lida assim). Também documentado explicitamente: os limites são por **minuto** (usuário) e por **hora** (workspace/global) — controlam frequência/rajada, não um orçamento diário ou mensal. Nada impede, hoje, um workspace de ficar no teto da hora 24h por dia (~480 chamadas/dia sem teto algum). Um teto diário real seria uma 4ª camada e uma decisão de produto nova (o que fazer quando o mês acaba) — registrado como P2 futuro, não implementado agora (vetado explicitamente pelo prompt: "não crie sistema de cobrança ou novo módulo").

---

## 6. Ajuste C — Crons e e-mail

**Pedido:** separar "cron processou" de "e-mail foi de fato entregue/tratado em falha"; não repetir os testes de sucesso dos crons.

**Nenhum teste de cron foi repetido nesta rodada** (nenhum endpoint foi chamado de novo). O que mudou é só a documentação, mais um achado de código encontrado ao revisar `notificacoes.ts` pra escrever a correção:

- **`RESEND_API_KEY` ausente ⇒ nenhuma tentativa de envio é sequer feita** (`enviarEmailAlarme`, `enviarEmailReengajamentoLab`, etc. retornam cedo com `if (!apiKey) return;`). Isso já estava documentado corretamente no relatório do P0 (seção 2, linha "Envio real de e-mail (Resend)") — não havia confusão nesse ponto específico.
- **O que faltava** era deixar explícito que "o cron processou" (notificação in-app criada, `disparado_em`/`reengajamento_enviado_em` gravado no banco) **não é a mesma evidência** que "o e-mail chegou na caixa de entrada" — são 2 afirmações diferentes, e só a 1ª foi provada nas sessões anteriores.
- **Achado de código, não corrigido nesta rodada** (fora do escopo mobile, registrado como P1-G no Backlog): quando o envio de e-mail falha de verdade (API fora do ar, e-mail rejeitado), o erro vai só para `console.error` dentro de `notificacoes.ts` — **não** passa pelo logger estruturado (`src/lib/observabilidade.ts`) que o resto do cron usa, então não carrega o mesmo `idExecucao`/`idCorrelacao` da execução. Em produção, isso dificultaria correlacionar "esta execução do cron teve uma falha de e-mail" nos logs.

**Documentação atualizada**: `GAIAMUM-BACKLOG-CONSOLIDACAO.md` item 5.2 e este relatório deixam explícita a distinção; novo item P1-G registra a melhoria de observabilidade (trocar os `console.error` por `registrarErro()`), proposta, não implementada.

---

## 7. Testes executados e resultados

### 7.1 Automatizados

| Suíte | Resultado |
|---|---|
| `npm test` (unitários) | **75/75 passando** (era 65 — +10 de `kanban.test.ts`) |
| `npm run test:integration` (contra Postgres de teste real, Docker local) | **36/36 passando** (era 35 — +1 de `rls-limites-entre-projetos.test.ts`) |
| Total | **111/111 passando** |
| `tsc --noEmit` | Limpo |
| `npm run lint` | Limpo (mesmos 3 warnings pré-existentes, não relacionados a esta mudança) |
| `npm run build` | Limpo, **39 rotas** (mesma contagem de sempre) |

### 7.2 Manuais, via Playwright contra `next dev` conectado ao Postgres de teste isolado (não produção)

Ambiente: usuário de teste descartável, 1 tenant, 1 projeto, 4 colunas (uma com 25 tarefas — "coluna longa" pedida no critério de aceite —, uma com 2, uma vazia, uma fixa "Concluído" vazia), apagados ao final.

| Cenário pedido | Resultado |
|---|---|
| 360px, 390px, 430px (retrato) | Sem rolagem horizontal da página nas 3 larguras (confirmado via `scrollWidth`) |
| Paisagem (844×390) | Menu lateral + múltiplas colunas visíveis, cabeçalho de navegação com "Visão geral" continua aparecendo (não só em retrato) |
| Desktop (1280×800) | Sem a barra de navegação mobile; 4 colunas lado a lado, 256px, crescimento livre — igual a antes |
| Coluna longa (25 cartões) | Scroll vertical interno funcionando, cabeçalho "sticky" dentro da coluna |
| Coluna vazia | Mostra "+ Adicionar cartão" ocupando a altura disponível, sem erro |
| Toque abre detalhes sem mover | Clicar no corpo do cartão abre o modal; nada se move |
| Reordenação fim → início (cenário obrigatório) | **"Mover para..." → Início**: `Tarefa 25` (soltada no fim antes) voltou pro topo da coluna "A Fazer" — confirmado na tela e **após recarregar a página** (persistido no banco, não só otimista) |
| Arrasto por toque (simulado via eventos sintéticos) | Reordenou corretamente ao mover a alça (⠿) ~150px pra baixo — depois de corrigir o achado 2.3 (antes da correção, não fazia nada no 1º movimento) |
| Navegação horizontal (botão "›", seletor) | Rolagem suave até a próxima coluna, cabeçalho atualiza nome/contagem/posição |
| "Visão geral" | Abre com as 4 colunas em miniatura, "Vazia" nas colunas sem cartões, toque leva até a coluna escolhida |
| Fechar o detalhe | Volta ao quadro sem erro, sem navegar embora (não cronometrado pixel a pixel — ver pendências) |
| Arrasto nativo do mouse no desktop | Arrastar "Em andamento 1" (mouse) pra dentro de "Revisão" funcionou — sem regressão |
| Persistência após recarregar | Confirmada (reordenação do teste acima sobreviveu a um reload completo da página) |

### 7.3 O que NÃO foi testado nesta rodada (honestamente, não escondido)

- **Dispositivo físico real** — nada disso substitui testar num celular de verdade. Roteiro na seção 11.
- **Auto-scroll durante arrasto** (perto do topo/rodapé/laterais) — implementado (`src/components/kanban/quadro-kanban.tsx`, efeito de auto-scroll com `requestAnimationFrame`), mas não validado em execução — simular um toque "parado perto da borda por tempo suficiente" de forma confiável via automação exigiria mais engenharia de teste do que o tempo desta rodada permitiu. **IMPLEMENTADO NÃO VALIDADO.**
- **Indicador visual de destino durante arrasto por toque** (borda antes/depois no cartão-alvo) — a lógica foi exercitada indiretamente (o reorder funcionou, o que prova que o cálculo do alvo está correto), mas o indicador visual em si não foi observado numa captura de tela durante o arrasto. **IMPLEMENTADO NÃO VALIDADO VISUALMENTE.**
- **Teclado virtual** abrindo sobre o formulário do detalhe — não simulável de forma fiel no Chromium desktop do Playwright.
- **Coluna dividida em turnos no mobile** — a lógica de turnos é a mesma de antes (preservada), e "Mover para..." já suporta escolher turno; não criei uma coluna dividida no cenário de teste desta rodada para validar visualmente.
- **Cancelamento de arrasto e falha de gravação** — o mecanismo (rollback otimista em caso de erro da Server Action) é o mesmo padrão já existente no código antes desta rodada, reaproveitado sem mudança; não forcei uma falha de rede pra ver o rollback acontecer nesta rodada especificamente.
- **Pinça (zoom) dedicada** — avaliada e **não implementada de propósito** (seção 8).

---

## 8. Pinça para zoom — avaliação, não implementada

O Fabio pediu pra avaliar pinça-pra-afastar como atalho adicional pra ver o quadro inteiro. **Decisão: não implementar.** Um gesto de pinça customizado em cima de um container com `overflow-x-auto`/scroll-snap e arrasto de cartão por toque teria que arbitrar entre 3 gestos concorrentes no mesmo elemento (pinça, rolagem, arrasto) — risco real de interferir com o zoom nativo do navegador (que o usuário já pode usar livremente, sem nenhum código aqui bloqueando) e com a acessibilidade. O botão "⊞ Visão geral" cobre a mesma necessidade (ver o quadro inteiro de uma vez) de forma robusta e já testada. Fica documentado como melhoria futura, não construída agora — "não implementar um gesto frágil apenas para cumprir a ideia", conforme o próprio pedido.

---

## 9. Permissões e segurança do "Mover para..."

Nenhuma checagem de permissão nova foi adicionada no cliente, e nenhuma foi removida: o popover chama a mesma `moverTarefa` (Server Action) que o arrasto sempre chamou, que é autorizada inteiramente no servidor (RLS do Postgres) — quem não tem acesso de escrita àquele projeto recebe erro da Server Action independente do caminho (arrasto ou menu) usado pra chegar nela. "Mover para..." nunca amplia quem pode mover uma tarefa.

---

## 10. Estado dos 3 ajustes da revisão do P0 — resumo

| Ajuste | Estado |
|---|---|
| A — Privacidade de membros | Investigado a fundo; decisão fundamentada de **não alterar o código** (quebraria @menção sem reduzir acesso real); documentação corrigida; teste novo que prova e documenta o comportamento |
| B — Rate limit | **Corrigido** (sequencial com curto-circuito) — achado real de esgotamento cruzado de cota, confirmado e resolvido; documentação de "frequência ≠ orçamento" adicionada |
| C — Crons/e-mail | Documentação corrigida (distinção processou × entregue); achado de observabilidade registrado como P1-G, não corrigido nesta rodada (fora do escopo mobile) |

---

## 11. Roteiro curto para o Fabio testar no celular físico

1. Publicar um deploy de Preview (ver seção 12) ou rodar `npm run dev` numa máquina da mesma rede Wi-Fi do celular e acessar pelo IP local.
2. **Em pé**: abrir um projeto com Kanban → confirmar que só uma coluna aparece por vez, ocupando quase a tela toda; deslizar o dedo pros lados pra trocar de coluna; tentar o seletor de coluna no topo como alternativa.
3. **Pegar um cartão no fim de uma lista longa e levar pro início**: tocar no ⇄ do cartão → Início. Confirmar que foi pro topo.
4. **Arrastar de verdade com o dedo**: tentar primeiro segurando o cartão (sem usar a alça) por ~1 segundo até sentir a vibração — depois tentar usando a alça ⠿ direto. Comparar qual parece mais "preciso".
5. **Rolar a tela devagar** dentro de uma coluna comprida, de propósito tentando "enganar" o sistema — ver se algum cartão entra em modo de arrasto sem você querer.
6. **Tocar simples** num cartão (sem segurar) → deve abrir os detalhes em tela cheia, com um X visível pra fechar.
7. **Deitar o celular**: ver se aparecem mais colunas e se o botão "Visão geral" continua lá.
8. Tocar em "⊞ Visão geral", escolher uma coluna vazia ou distante, confirmar que leva até ela.
9. Reportar qualquer caso em que um cartão pareceu "pular" ou mover sozinho — é exatamente o problema original que esta rodada tentou resolver, e vale saber se ainda acontece em algum gesto específico.

---

## 12. Estado da branch, commits e próximo passo

- Mesma branch de sempre: `consolidacao/p0-confiabilidade-metas`, **ainda não publicada** (sem push, sem PR).
- Esta rodada deve ser commitada como um ou mais commits novos nesta branch (não um commit amend em cima dos 3 commits anteriores do P0).
- **Nada publicado, nenhuma migration aplicada em lugar novo, nenhum e-mail real enviado.**

**Próximo passo pra disponibilizar um preview com banco isolado de homologação** (não produção):
1. Decidir se o Supabase do ambiente de **Homologação** já existe (projeto Supabase Cloud separado) ou precisa ser criado — este relatório não tem visibilidade sobre isso.
2. Se precisar criar: um projeto Supabase Cloud novo, rodar `supabase db push` (migrations 0001-0047, incluindo as do P0 — nunca aplicadas em lugar nenhum fora do Docker local até agora) contra ele.
3. Configurar as env vars desse projeto de homologação (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` se quiser testar e-mail de verdade) como **Preview** (não Production) na Vercel, atreladas a esta branch.
4. Publicar a branch (`git push`) — isso também seria a 1ª vez que o CI do GitHub Actions roda de verdade (pendência conhecida desde o P0, seção 11 item 2 do relatório anterior).
5. Testar o roteiro da seção 11 contra essa URL de Preview, de um celular físico de verdade.

Nenhum desses 5 passos foi executado nesta rodada — nesta sessão não foram feitas alterações no painel da Vercel nem no Supabase Cloud.
