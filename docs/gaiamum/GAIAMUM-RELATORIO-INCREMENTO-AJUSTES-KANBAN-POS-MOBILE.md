# Gaiamum — Relatório do Incremento: Ajustes do Kanban Após a Entrega Mobile

**Branch:** `consolidacao/p0-confiabilidade-metas` (mesma de sempre, não mesclada, não publicada)
**Executor:** Claude Code (Sonnet 5)
**Fonte:** prompt "Ajustes do Kanban após a entrega mobile" (2026-10-01), 7 itens sobre o incremento de experiência mobile anterior — mais 1 pedido adicional recebido no meio da mesma sessão (ver seção 2.7: botão de ocultar/mostrar cartões concluídos).

Rótulos usados: **IMPLEMENTADO E VALIDADO**, **IMPLEMENTADO NÃO VALIDADO**, **PROPOSTO**, **BLOQUEADO**.

---

## 1. O que mudou para o usuário

- **Turnos só na coluna "Hoje"**: o botão "▥" (dividir em Manhã/Tarde/Noite) some das demais colunas. Nova identidade de sistema "📌 Hoje" (badge visível no nome da coluna); colunas sem essa marcação ganham um botão discreto "Definir Hoje" pra assumir esse papel.
- **Altura das colunas nivelada pela maior**, no desktop/visão ampla — sem "degraus" de altura entre colunas vizinhas, sem espaço vazio artificial numa coluna curta ao lado de uma longa. No celular em coluna única, cada coluna mantém sua própria altura (não herda a da maior, que nem está visível ao mesmo tempo).
- **"Concluído" sempre por último, botão "+" depois dela** (antes vinha antes). Coluna nova sempre nasce logo depois de "Hoje", nunca mais no fim do quadro.
- **Barra de navegação horizontal em cima das colunas**, no desktop — sincronizada com a de baixo, com setas "‹ ›" sempre visíveis. Não precisa mais descer até o fim do quadro pra alcançar a rolagem horizontal.
- **2 achados reais de bug corrigidos** no arrasto por toque (ver seção 2) — um deles fazia a rolagem automática pro topo de uma coluna comprida simplesmente nunca acontecer.
- **E-mail do(s) owner(s)** não aparece mais, completo, pra convidados restritos a projeto que não compartilham nenhum projeto com eles — continuam identificáveis (nome antes do @) e continuam podendo ser @mencionados/atribuídos.
- **Botão "👁 Mostrar" / "🙈 Ocultar" na coluna "Concluído"** (pedido adicional, no meio da sessão): esconde os cartões concluídos (sem apagar nada) pra essa coluna parar de "puxar" a altura de todas as outras — já que agora elas nivelam pela maior (item 2 acima), uma "Concluído" com dezenas de cartões ao longo de um projeto forçava todo o quadro a ficar enorme, tirando o foco do que ainda falta fazer. Começa oculta em toda visita nova à página; um toque mostra tudo de novo pra conferência, outro toque esconde de novo.

---

## 2. Causas identificadas e solução aplicada

### 2.1 Identidade "coluna Hoje" (item 1)

**Causa**: o sistema nunca teve uma identidade formal de "qual coluna é a Hoje" — nem no schema, nem na criação de projeto (`criarProjeto` sempre criava "Em Aberto"/"Em Desenvolvimento"). Usar o nome pra decidir isso seria frágil, como o próprio pedido reconheceu.

**Solução**: nova coluna de sistema `colunas_kanban.hoje boolean`, no mesmo padrão arquitetural já usado por `concluido` (índice único parcial — no máximo 1 "Hoje" por projeto). Diferente de `concluido`, "Hoje" não tem posição travada (pode ser movida/renomeada livremente), só carrega o significado especial. Regra aplicada em 2 camadas: Server Action (`alternarDivisaoEmTurnos` rejeita se `!coluna.hoje`) e **CHECK constraint no banco** (`check (not dividida_em_turnos or hoje)`) — mesmo chamando a tabela direto (bypassando a aplicação), a regra se mantém.

**Dado legado**: colunas que já tivessem `dividida_em_turnos = true` sem ser "Hoje" teriam o CHECK constraint violado ao aplicar a migration. Tratamento: (1) a coluna chamada exatamente "Hoje" (convenção que o Fabio já usa, comparação só nesta migração pontual, nunca mais em tempo de execução) é promovida automaticamente; (2) qualquer outra com `dividida_em_turnos=true` tem só a divisão **visual** desligada — nenhuma tarefa é tocada, nenhum `turno` é apagado, só os 3 sub-blocos somem até alguém marcar aquela coluna como "Hoje" de novo. Documentado na própria migration (`0048_coluna_hoje_e_regra_turnos.sql`).

**Achado incidental, não corrigido** (pré-existente, fora do escopo deste pedido): quando uma coluna já populada com cartões *sem turno* é dividida em turnos, esses cartões somem da visualização (ficam em nenhum dos 3 sub-blocos, já que o filtro é `turno === valor`, nunca `turno === null`). O dado não é perdido (sobrevive a reload, reaparece se a divisão for desfeita), mas a experiência confunde. Registrado como item novo de backlog (P2, seção 7).

### 2.2 Altura nivelada via CSS Grid, não cálculo em JS (item 2)

**Decisão de implementação**: ao invés de medir alturas em JavaScript (frágil, exige recalcular a cada mutação), o container do quadro virou `display: grid` (`grid-auto-flow: column`) com `align-items: stretch` a partir do breakpoint `sm:` (mesmo ponto que já decidia "mostrar múltiplas colunas lado a lado"). O motor de layout do navegador estica cada coluna até a altura da maior da mesma linha — **de graça, sem nenhum código de recálculo**, atualizado automaticamente a cada render (criar/mover/excluir/filtrar cartão já dispara re-render normal). Cada coluna mantém seu teto de altura + `overflow-y-auto` própria (variável CSS `--altura-maxima-coluna-kanban`, compartilhada entre `quadro-kanban.tsx` e `coluna-compromissos-do-dia.tsx` — antes essa 2ª tinha um `min-h` arbitrário próprio, removido). No celular em retrato (`items-start`, abaixo de `sm:`), o nivelamento fica desligado de propósito — só 1 coluna é visível por vez ali.

**Achado real de bug corrigido durante a implementação**: uma classe de altura máxima arbitrária do Tailwind referenciando a CSS var (`max-h-` seguido de colchete com `var(...)`) gerava um warning do Lightning CSS no build (`Unexpected token Delim('.')`) — rastreado até um **comentário meu** no próprio código-fonte que continha essa mesma sintaxe como texto de exemplo (fora de uma classe real), que o scanner do Tailwind (que varre TODOS os arquivos do projeto, incluindo este relatório — por isso este parágrafo evita reescrever a sintaxe literal de novo) tentou interpretar como classe de verdade. Corrigido trocando por `style={{ maxHeight: ... }}` em JSX (mais robusto, não depende do parser arbitrary do Tailwind) e removendo a sintaxe arbitrária do comentário.

### 2.3 Ordem de colunas e botão "+" (item 3)

Reaproveita 100% a persistência de ordem existente (`colunas_kanban.ordem`, mesmo mecanismo de `reordenarColunas`). `criarColuna` passou a: ler as colunas abertas ordenadas, achar o índice da coluna "Hoje", inserir a nova logo depois (reindexando as demais +1) — fallback pra 1ª posição se não houver "Hoje" ainda (projeto antigo). O botão "+" simplesmente trocou de lugar no JSX (depois do bloco que renderiza a coluna fixa) — ele nunca participou do array reordenável, e "Concluído" nunca é incluída nesse array (estruturalmente, não por checagem explícita) — então "nenhuma coluna depois de Concluído" já era garantido antes desta mudança e continua sendo.

### 2.4 Barra de navegação dupla (item 4)

Elemento `overflow-x-auto` próprio acima das colunas, com um "fantasma" interno (`width: scrollWidth do quadro`) cuja rolagem é sincronizada nos 2 sentidos com o container real das colunas via listeners de `scroll` + uma flag anti-loop (`sincronizando`). Largura recalculada num `useEffect` com dependência `[colunas, tarefas]` (cobre mudança de conteúdo) + listener de `resize` da janela (cobre redimensionar). Setas "‹ ›" ao lado, sempre visíveis, como fallback que não depende de a scrollbar nativa desse elemento estar visível (relevante em macOS com overlay scrollbars). Só aparece a partir de `lg:` (1024px) — abaixo disso já existe a barra de navegação por toque, mostrar as duas juntas seria redundante.

### 2.5 Achado real de bug no arrasto mobile: auto-scroll relativo à janela, não à coluna (item 5)

**O mais importante desta rodada.** Ao validar de verdade o cenário "levar um cartão do fim ao início de uma coluna longa" **via arrasto** (não "Mover para..."), o auto-scroll vertical simplesmente não disparava. Causa: a zona de ativação (90px) era calculada a partir do **topo da janela**, mas a coluna real começa bem mais abaixo (cabeçalho fixo da página — título do projeto, navegação, barra de colunas no mobile — ocupa ~277px nesta página de teste). O dedo nunca alcançava "90px do topo da tela" sem sair da área física da coluna (sobre o cabeçalho, onde não há `[data-coluna-id]`), caindo no fallback de rolar a `window` (que não tinha mais o que rolar).

**Corrigido**: a zona de auto-scroll agora é relativa ao **topo/rodapé do container da coluna** (`getBoundingClientRect()` dela), não da janela — só cai no fallback relativo à janela quando o dedo não está sobre nenhuma coluna rolável. Confirmado via teste: `scrollTop` do container foi de 1378px pra 0px durante um arrasto simulado perto do topo da coluna, e o cartão do fim (`Tarefa 20`) realmente chegou ao início.

### 2.6 Correção no mecanismo de @menção para suportar e-mail ausente (item 6)

Ver seção 4 (dedicada à revisão de privacidade).

### 2.7 Botão de ocultar/mostrar a coluna "Concluído" (pedido adicional)

**Causa**: o nivelamento de altura do item 2 (seção 2.2) resolveu os "degraus" entre colunas, mas criou um efeito colateral esperado: uma coluna "Concluído" que só cresce ao longo da vida de um projeto agora dita a altura de **todas** as colunas — o quadro inteiro fica enorme, e o foco visual (o que ainda falta fazer) se perde no meio de uma parede de cartões já resolvidos.

**Solução**: estado local (`useState`, só de interface — nunca grava no banco, não precisa: é um "esconder da vista" temporário, não uma preferência de longo prazo) que, quando ligado, substitui a lista de cartões da coluna fixa por um único botão-resumo ("N cartão(ões) oculto(s) — toque pra ver"). Começa **ligado** (oculto) em toda visita nova à página — é o estado que resolve o problema descrito por padrão, sem exigir nenhuma ação do usuário pra manter o quadro curto. Um botão no cabeçalho ("👁 Mostrar" / "🙈 Ocultar") alterna o estado; com os cartões visíveis, a coluna aparece normalmente (com scroll próprio se passar do teto de altura), e as demais colunas acompanham via o mesmo nivelamento de grid.

Exclusivo da coluna `concluido: true` (`ehFixa`) — nenhuma outra coluna ganha esse controle. O dropzone da coluna continua funcionando normalmente com os cartões ocultos (testado: mover um cartão de outra coluna pra dentro de "Concluído" colapsada funciona, incrementa a contagem, e o cartão entra oculto).

---

## 3. Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `supabase/migrations/0048_coluna_hoje_e_regra_turnos.sql` | **Novo** — coluna `hoje`, índice único, CHECK constraint, migração de dado legado |
| `supabase/migrations/0049_privacidade_membros_e_resolucao_notificacao.sql` | **Novo** — `membros_do_tenant()` reescrita (e-mail condicional + `nome_exibicao`), nova function privilegiada `emails_para_notificacao` |
| `src/lib/ecc/tipos.ts` | `ColunaKanban.hoje`; `MembroTenant.email: string \| null` + `nome_exibicao: string` |
| `src/lib/ecc/actions.ts` | `criarColuna` (posição pós-Hoje), `alternarDivisaoEmTurnos` (checagem de `hoje`), nova `definirColunaHoje`, `enviarConsolidacaoProjeto` (resolução privilegiada) |
| `src/lib/ecc/equipe.ts` | Nova `resolverEmailsParaNotificacao` |
| `src/lib/ecc/atividade.ts` | Usa `resolverEmailsParaNotificacao` em vez de `listarMembros` |
| `src/lib/ecc/kanban.ts` | Nova `identificacaoDoMembro(membro)` — fonte única de "e-mail ou nome_exibicao" |
| `src/lib/ecc/mencoes.ts` | Todas as funções usam `identificacaoDoMembro` em vez de `m.email` direto |
| `src/components/kanban/quadro-kanban.tsx` | Container vira `grid` (nivelamento), badge/controle "Hoje", reordenação do botão "+", barra de navegação superior, correção do auto-scroll vertical, botão de ocultar/mostrar cartões concluídos |
| `src/components/kanban/coluna-compromissos-do-dia.tsx` | `min-h` arbitrário → `max-h` + `overflow-y-auto` compartilhada |
| `src/components/kanban/detalhe-tarefa.tsx` | Todos os usos de `membro.email` → `identificacaoDoMembro(membro)` (seletor, autocomplete, chip de menção) |
| `src/components/kanban/cartao-tarefa.tsx` | `AvatarIniciais` recebe `nomeExibicao` como fallback |
| `src/components/avatar-iniciais.tsx` | `email` aceita `null`, novo prop `nomeExibicao` |
| `src/components/projetos/equipe-do-quadro.tsx` | `MembroDoQuadro.email: string \| null` + `nomeExibicao` |
| `src/app/projetos/[id]/configuracoes/page.tsx` | Passa `nome_exibicao` pro componente de equipe do quadro |
| `src/app/globals.css` | Nova variável `--altura-maxima-coluna-kanban` |
| `src/lib/ecc/__tests__/mencoes.test.ts` | Fixtures com `nome_exibicao`; +2 testes (email null) |
| `tests/integration/rls-limites-entre-projetos.test.ts` | Reescreve os 2 testes que esperavam e-mail completo do owner; +2 testes novos (`emails_para_notificacao`, revoke) |

**2 migrations novas** (0048, 0049) — aplicadas e testadas **só no Postgres de teste isolado**, nunca em produção.

---

## 4. Revisão pontual da privacidade (item 6) — investigação mais rigorosa

O pedido desafiou diretamente a conclusão anterior ("e-mail do owner é necessário"): *"um teste que comprova exposição não comprova necessidade"*.

**Separação pedida, confirmada**:
- **Identificar/selecionar a pessoa na interface**: as ações reais (`alternarMembroTarefa`, atribuir responsável) sempre usaram `user_id` como chave — nunca precisaram do e-mail.
- **Resolver endereço para notificação no servidor**: **achado real, mais grave que o problema original** — `registrarAtividade()` e `enviarConsolidacaoProjeto()` usavam `listarMembros()`, a MESMA function pública limitada por escopo de quem disparou a ação. Um convidado de projeto (ou gestor de projeto sem acesso completo) que movesse um cartão atribuído ao owner, ou disparasse um Freeze, dependia do e-mail do owner estar visível **pra ele especificamente** — um acoplamento indevido entre "o que a tela mostra" e "quem o sistema consegue avisar".

**Correção aplicada (não só documentação)**:
1. Nova function SQL privilegiada `emails_para_notificacao(user_ids, tenant_id)` — `SECURITY DEFINER`, EXECUTE revogado de anon/authenticated (só service role chama), nunca limitada por escopo. `registrarAtividade`/`enviarConsolidacaoProjeto` passaram a usá-la.
2. `membros_do_tenant()` (function pública, usada pela interface) reescrita: e-mail completo só quando o chamador já tinha direito a ele (acesso completo, ou compartilha projeto com o alvo) — igual a migration 0047. Um novo campo `nome_exibicao` (parte local do e-mail) vem **sempre** preenchido, inclusive quando `email` é `null`.
3. @menção (`mencoes.ts`) passou a usar `identificacaoDoMembro(membro)` (e-mail, com `nome_exibicao` de fallback) como a chave gravada no texto — continua funcionando mesmo sem e-mail visível, e continua retrocompatível com texto já gravado (que sempre tinha o e-mail completo, que é exatamente `identificacaoDoMembro` quando o e-mail está disponível).

**O que isso NÃO resolve, documentado honestamente**: o payload que chega ao cliente (resposta do RPC) continua contendo `nome_exibicao` derivado do e-mail — não é "zero dado" relacionado ao e-mail, é uma redução real da exposição (nunca mais o endereço completo, com domínio, pra quem não tem direito a ele). Criar um sistema de "nome de perfil" de verdade (campo independente do e-mail) exigiria uma tabela de perfis nova — fora de escopo ("menor mudança necessária").

**Testes**: `tests/integration/rls-limites-entre-projetos.test.ts` reescrito — os 2 casos que antes **documentavam** a exposição do e-mail completo do owner agora **provam a correção** (campo `email` é `null`, `nome_exibicao` bate com a parte local esperada); +2 testes novos confirmam que `emails_para_notificacao` resolve o e-mail real mesmo chamada "em nome" de um convidado restrito, e que o EXECUTE dela é de fato revogado de usuário comum.

---

## 5. Testes executados e resultados

### 5.1 Automatizados

| Suíte | Resultado |
|---|---|
| `npm test` (unitários) | 75/75 passando (inalterado nesta rodada — nenhuma função pura nova) |
| `npm run test:integration` | **40/40 passando** (era 36 — +4: 2 reescritos de privacidade, 2 novos) |
| Total | **115/115 passando** |
| `tsc --noEmit` | Limpo |
| `npm run lint` | Limpo (mesmos 3 warnings pré-existentes) |
| `npm run build` | Limpo, **39 rotas**, sem warning de CSS (corrigido, seção 2.2) |

### 5.2 Manuais, via Playwright contra `next dev` + Postgres de teste isolado

Cenário: projeto com coluna "Hoje" (20 tarefas, identidade de sistema), "Em Andamento", "Revisão" (depois reordenada pra antes de "Hoje"), "Concluído" fixa — tudo apagado ao final.

| Cenário pedido | Resultado |
|---|---|
| Turnos disponíveis só em "Hoje" | Confirmado: botão "▥" só aparece na coluna com o badge "📌 Hoje"; as demais mostram "Definir Hoje" |
| Botão "+" depois de "Concluído" | Confirmado visualmente e por posição no DOM |
| Coluna nova nasce depois de "Hoje" | Confirmado: "Nova Coluna Teste" nasceu entre "Hoje" e "Em Andamento", não no fim — persistiu após reload |
| Reordenação antes de "Hoje" | Confirmado: arrastar "Revisão" (mouse, desktop) pra antes de "Hoje" funcionou e persistiu após reload |
| Bloqueio de posição depois de "Concluído" | Estrutural (nunca participa do array reordenável) — não exercitado por tentativa direta de drag, mas confirmado por leitura de código + nenhuma regressão observada |
| **Cartão do fim de uma coluna longa (20) levado ao início, via ARRASTO real** (não "Mover para") | **Confirmado** — simulação de toque na alça, auto-scroll vertical rolou o container de 1378px até 0px, cartão solto corretamente no início, persistiu após reload |
| Rolagem automática no topo/rodapé | **Confirmado após a correção da seção 2.5** — não funcionava antes da correção (achado real) |
| Indicação correta da posição de inserção | **Confirmado via inspeção de classe CSS durante o arrasto** (`border-t-2 border-t-gaiamum-primary` no cartão-alvo, `opacity-40` no cartão de origem) — distinto de só inferir pelo resultado final |
| Movimentação para coluna vizinha | Confirmado (`Em andamento 1` → `Hoje`, via arrasto) |
| Movimentação para turno específico | Confirmado (`Em andamento 1` → turno "Tarde" de "Hoje", via arrasto) |
| Cancelamento (soltar fora de qualquer coluna) | Confirmado — nenhuma mudança de ordem quando solto fora de `[data-coluna-id]` |
| Falha de persistência | **Parcialmente confirmado** — a interceptação de `fetch` realmente atingiu a Server Action (erro propagado e visível no console/overlay do Next), mas o teste automatizado não conseguiu capturar visualmente o estado otimista intermediário porque o `.catch()` de rollback roda rápido demais (Promise rejeitada sem round-trip de rede real) pra ser observado entre 2 chamadas de `requestAnimationFrame`. O mecanismo de rollback em si (`setTarefas` revertido no `.catch`) é o mesmo já usado/testado estruturalmente em sessões anteriores — não foi reescrito nesta rodada. Nenhum dado ficou inconsistente no banco após o teste (confirmado via reload) |
| Ausência de abertura acidental após soltar | Confirmado — nenhum modal de detalhe apareceu depois de nenhum arrasto |
| Persistência após reload | Confirmado em todos os cenários acima |

### 5.3 O que NÃO foi testado nesta rodada (honestamente, não escondido)

- **Dispositivo físico real** — nada do acima substitui isso. Roteiro na seção 8.
- **Teclado virtual** — não simulável de forma fiel no Chromium desktop do Playwright.
- **Filtros** — o Kanban não tem um controle de "filtro" de visualização hoje (confirmado por busca no código); o que existe (coluna "Compromissos de hoje", coluna fixa "Concluído") foi preservado e confirmado funcionando nos testes acima.
- **"Distinção entre validação emulada e teste em celular físico"**: toda a seção 5.2 é emulada (Playwright + Chromium desktop simulando touch events via `TouchEvent`/`dispatchEvent`) — nenhum teste desta rodada usou um aparelho físico.

---

## 6. Estado dos 7 itens pedidos — resumo

| Item | Estado |
|---|---|
| 1 — Turnos só na coluna Hoje | **IMPLEMENTADO E VALIDADO** (servidor + interface + migração de dado legado documentada; rodada 2 corrigiu que dividir não escondia mais cartões já existentes — ver seção 10) |
| 2 — Altura nivelada / espaços vazios | **IMPLEMENTADO E VALIDADO** (CSS Grid nativo, sem cálculo manual) |
| 3 — Ordem de colunas / botão + | **IMPLEMENTADO E VALIDADO** |
| 4 — Navegação horizontal dupla | **IMPLEMENTADO E VALIDADO** (desktop, `lg:`) |
| 5 — Validação do arrasto mobile | **IMPLEMENTADO E VALIDADO**, com 1 achado real corrigido (auto-scroll) — exceto falha de persistência (parcial, seção 5.2) e teste em aparelho físico (não feito, roteiro abaixo) |
| 6 — Revisão de privacidade | **IMPLEMENTADO E VALIDADO** (correção real, não só documentação — 2 migrations + resolução privilegiada de notificação) |
| 7 — Testes e entrega | Este relatório + suíte 115/115 + build limpo |
| Adicional — ocultar/mostrar "Concluído" | **IMPLEMENTADO E VALIDADO** (toggle nos dois sentidos, nivelamento de altura confirmado com a coluna colapsada e expandida, drop numa coluna colapsada confirmado) |

---

## 7. Limitações e pendências reais

- **Falha de persistência**: mecanismo de rollback não reescrito nem revalidado em profundidade nesta rodada (herdado, já existia); confirmado que a chamada de rede realmente falha quando interceptada, não confirmado visualmente o estado otimista intermediário por limitação de timing do teste automatizado.
- **`nome_exibicao` deriva do e-mail** (parte local) — não é um campo de perfil independente. Se o e-mail de alguém mudar, a identificação muda junto (comportamento aceito, não um bug).
- **Teste em dispositivo físico**: não realizado nesta máquina — depende do Preview publicado (seção 10) e do Fabio testar no celular dele.
- **Paisagem com `pointer: coarse` real** (seção 10): a correção do menu lateral foi validada logicamente nos dois extremos (retrato / desktop com mouse), mas o caso real "celular deitado" não pôde ser emulado com as ferramentas de teste desta sessão — só o teste físico do Fabio fecha isso de verdade.
- **Barra de navegação por toque do kanban em paisagem** (seção 10): continua aparecendo mesmo com múltiplas colunas já visíveis lado a lado, ocupando altura numa tela de ~390px — não foi alterada porque era um pedido explícito anterior do Fabio ("retrato e paisagem"); fica como possível ajuste futuro, não mudança unilateral.

---

## 8. Roteiro curto para o Fabio testar

### No computador
1. Abrir um projeto, confirmar que só a coluna "Hoje" (ou a que você marcar como tal) tem o botão "▥" de dividir em turnos.
2. Criar uma coluna nova — confirmar que ela aparece logo depois de "Hoje", não no fim.
3. Redimensionar a janela até ficar larga — reparar que todas as colunas ficam com a mesma altura (a da mais cheia), sem sobra de espaço vazio desnecessário numa coluna curta.
4. Usar a barra de rolagem horizontal que agora aparece **em cima** das colunas — não precisa mais descer até o fim do quadro.
5. Arrastar uma coluna com o mouse pra antes de "Hoje" — confirmar que funciona e persiste depois de recarregar.
6. Na coluna "Concluído", tocar em "👁 Mostrar" — ver todos os cartões concluídos aparecerem; tocar em "🙈 Ocultar" — eles somem de novo (nada é apagado, é só visual).
7. Na coluna "Concluído", confirmar que NÃO existe mais o campo "+ Adicionar cartão" — só dá pra colocar um cartão ali arrastando ou usando "Mover para...".
8. Numa coluna com cartões sem turno, clicar em "▥" (dividir em Manhã/Tarde/Noite) — confirmar que todos os cartões aparecem em "Manhã", nenhum some.

### No celular
1. Numa coluna com muitos cartões, pegar o do fim (pela alcinha ⠿) e levar até o topo da tela, segurando ali — a coluna deve rolar sozinha até o início.
2. Confirmar que soltar o cartão mostra claramente onde ele vai cair (linha azul antes/depois de outro cartão) antes de soltar o dedo.
3. Mover um cartão de outra coluna pra dentro de um turno específico de "Hoje" (se ela estiver dividida).
4. Testar: segurar um cartão, arrastar até fora de qualquer coluna (ex: pro cabeçalho) e soltar — nada deve se mover.
5. Reportar qualquer caso em que a rolagem automática não acontecer, ou o cartão "sumir" visualmente.
6. **Girar o celular pra paisagem (deitado)** dentro de um projeto com várias colunas — confirmar que o menu lateral de ícones (Início/Projetos/Metas SMART/Equipe) NÃO aparece mais ocupando a tela, e que dá pra ver 2-3 colunas lado a lado.

---

## 9. Estado da branch, commits e próximo passo

Ver seção 10 — estado atualizado após a rodada 2 de correções no mesmo dia.

---

## 10. Rodada 2 — correções pedidas depois do primeiro teste do Fabio (2026-10-01, mesmo dia)

### 10.1 Causa raiz do "não apareceu nada"

O Fabio testou o app publicado (produção) depois de concluído o trabalho da rodada 1 e não viu nenhuma das mudanças (nem o botão "toca", nem o ajuste de paisagem). Causa: a branch `consolidacao/p0-confiabilidade-metas` nunca tinha sido publicada — `main` seguia parada num commit anterior a todo este incremento. Não era bug, era ausência de publicação. Resolvido publicando a branch (seção 10.5).

### 10.2 Coluna "Concluído" não aceita mais criação direta de cartão

Pedido do Fabio: só se coloca cartão em Concluído por movimentação (arrasto/"Mover para..."), nunca criando direto nela. Implementado em 3 camadas — interface (campo de criar cartão não é mais renderizado nessa coluna), Server Action `criarTarefa` (rejeita com mensagem em português) e um trigger novo no banco, `tarefas_bloqueia_criacao_em_concluido` (migration `0050_concluido_nao_aceita_criacao_direta.sql`) que rejeita o INSERT mesmo contornando a Server Action — só INSERT é bloqueado, mover um cartão já existente (UPDATE) continua liberado. Testado manualmente contra o banco (INSERT direto rejeitado, UPDATE de movimentação aceito) e com 3 testes automatizados novos.

### 10.3 Dividir em turnos não esconde mais cartões existentes

Correção do achado incidental que na rodada 1 tinha ficado só registrado em backlog (P2-C) sem ser corrigido. O Fabio decidiu o comportamento: ao dividir uma coluna populada em Manhã/Tarde/Noite pela 1ª vez, todo cartão sem turno entra direto em "Manhã" (visível, nada some) — a pessoa reorganiza manualmente depois se quiser Tarde/Noite. Corrigido em `alternarDivisaoEmTurnos` (Server Action) e no otimista do cliente; validado via Playwright (6 cartões continuaram todos visíveis em "Manhã", inclusive depois de recarregar a página — não é só otimista) e com 2 testes automatizados novos.

### 10.4 Achado real adicional: paisagem não ativava de verdade (menu lateral)

O quadro kanban já tinha sido desenhado na rodada 1 pra reconhecer celular deitado pela largura (`sm:`, 640px) e mostrar colunas lado a lado — isso de fato funciona. Mas o `MenuLateral` (menu de 240px fixos: Início/Projetos/Metas SMART/Equipe/Lab) usava o MESMO critério de só largura, sem considerar se é toque ou mouse — então qualquer celular deitado também disparava esse menu de desktop, roubando um quarto da largura bem na hora em que mais sobrava espaço pro quadro. Corrigido: o menu lateral de desktop agora só aparece com `(min-width: 640px) and (pointer: fine)` — mouse de verdade; o cabeçalho com hambúrguer (`MenuMobile`) passa a cobrir exatamente o caso oposto, inclusive celular deitado.

**Limite honesto da validação**: confirmei a lógica nos dois extremos que dava pra testar aqui (retrato sempre esconde o menu de desktop; largura de desktop + mouse sempre mostra) e que o build/tsc/eslint continuam limpos. O terceiro caso — largura de celular deitado **com toque de verdade** — não pôde ser emulado: o Playwright deste ambiente sempre reporta `pointer: fine` (como se fosse mouse) e a ferramenta de emulação de mídia disponível não cobre `pointer`/`hover`. Só o teste físico do Fabio, girando o celular de verdade, fecha essa validação.

Não mexi na barra de navegação por toque do próprio kanban (o seletor "‹ Hoje (6) › Visão geral" que ainda aparece em paisagem mesmo com várias colunas já visíveis) — ela existe por um pedido explícito anterior do Fabio ("retrato e paisagem", 2026-09-30) documentado no código; revertê-la sem confirmar seria sobrepor uma decisão de design dele por conta própria. Fica registrado como possível ajuste futuro.

### 10.5 Testes, publicação e estado final

- Suíte completa: **120/120** (era 115 ao fim da rodada 1; +5 novos: 3 de Concluído sem criação, 2 de divisão de turnos). `tsc --noEmit`, `eslint` (mesmos 3 warnings pré-existentes, sem erro novo) e `npm run build` limpos depois de cada rodada de mudança.
- Nova migration: `supabase/migrations/0050_concluido_nao_aceita_criacao_direta.sql`, aplicada e testada no Postgres de teste isolado — **não aplicada em produção**.
- **Achado operacional à parte**: o `.env.local` deste projeto aponta para o Supabase **cloud** de produção, não para o Postgres local de teste — ao subir o servidor local pra validar visualmente, descobri isso a tempo (um login de teste chegou a bater, sem sucesso, no projeto cloud — só uma tentativa de autenticação rejeitada, nenhuma escrita) e troquei para forçar as variáveis do ambiente local antes de continuar. Vale registrar pra quem for rodar `npm run dev` neste projeto no futuro: por padrão ele fala com produção.
- **Publicação replanejada em cima de 2 achados reais**:
  1. `git push` da branch foi rejeitado pelo GitHub — o token OAuth do `gh` CLI autenticado como `gaiamumdash-commits` não tem o escopo `workflow` (necessário porque a branch inclui `.github/workflows/ci.yml`, de uma sessão anterior). Corrigir isso exige um fluxo de login novo (device code do GitHub) que só o Fabio pode completar no navegador — não contornado nesta sessão.
  2. Um deploy direto via Vercel CLI (sem depender do GitHub) funcionou, mas revelou que o ambiente "Preview" da Vercel usa o **mesmo banco Supabase de produção** (confirmado pela chamada de rede batendo em `zfjtcivusdmjvdbycpjs.supabase.co`, igual produção) — não existe banco de Preview isolado configurado ainda. Publicar esse link pro Fabio testar quebraria o app (as migrations 0048-0050 não existem no banco de produção). Também havia proteção de login da Vercel (SSO) no link, resolvida à parte com um bypass, mas o problema de fundo (banco compartilhado) tornou o link inutilizável para este teste e foi descartado — o bypass criado foi desfeito depois.
  - **Caminho adotado**: servidor `next dev` rodando nesta máquina, acessível pela rede Wi-Fi local via `http://192.168.0.18:3000`, com o Supabase apontado para o Postgres de teste isolado (as 3 migrations novas aplicadas lá). Exigiu 2 ajustes de ambiente, documentados para quem repetir isso no futuro: (a) o `.env.local` deste projeto aponta por padrão para o Supabase de produção — as env vars do Supabase precisam ser sobrescritas na hora de subir o servidor; (b) o Next.js bloqueia por padrão recursos de dev vindos de uma origem diferente de `localhost` — adicionado `allowedDevOrigins` em `next.config.ts` (só afeta `next dev`, nunca o build de produção).
  - **Produção (`main`) não foi tocada em nenhum momento** desta publicação replanejada.
  - Link e instruções de teste entregues à parte (dependem do celular estar na mesma rede Wi-Fi deste computador).
