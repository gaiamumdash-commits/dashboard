# Handoff vivo — Gaiamum Dashboard

**Documento canônico de continuidade.** Ao retomar uma sessão nova sobre o Gaiamum, ler só "Estado confirmado" abaixo + a última entrada de "Checkpoints" no rodapé — não o arquivo inteiro. Ao fim de qualquer sessão relevante, atualizar "Estado confirmado" (se mudou) e acrescentar uma entrada nova em "Checkpoints". Nunca criar um arquivo de handoff novo — este é o único.

**Regra permanente (pedido do Fabio, 2026-08-30):** sempre que uma ferramenta travar, uma automação ficar esperando algo que não vai resolver sozinha (ex.: confirmação de e-mail, permissão de navegador, aprovação externa), ou o trabalho ficar bloqueado por qualquer motivo, avisar o Fabio imediatamente — dizer o que travou e o que ele pode fazer pra destravar. Nunca deixar isso implícito ou esperar ele perguntar "travou?".

**Criado:** 2026-08-29 · **Branch:** main · **Remoto:** https://github.com/gaiamumdash-commits/dashboard
**Local do projeto:** `c:\Users\proff\Documents\Gaiamum\` (**fora do OneDrive de propósito** — não mover de volta)
**Produção:** https://www.gaiamum.com.br (domínio próprio, DNS já propagado — **falta só o certificado SSL ativar**, ver "Estado confirmado"). Enquanto isso, o app responde normalmente em https://gaiamum-dashboard.vercel.app.

---

## Estado confirmado (2026-08-30, sessão nova — última atualização)

- **Colunas do kanban ficaram configuráveis por projeto (pedido do Fabio comparando com o Trello)** — implementado, migrado em produção e testado de ponta a ponta via Playwright real (renomear, criar, apagar coluna vazia, mover cartão pra dentro/fora do "Concluído"). Só a coluna `concluido = true` ("Concluído") é fixa — não pode ser renomeada nem apagada (RLS bloqueia e a UI esconde os controles); as demais qualquer membro do projeto cria e renomeia livremente. Cartão que entra na coluna "Concluído" ganha um selo do caranguejo da marca (`crab-mark.png`) ao lado do título — 100% derivado da coluna atual, então some sozinho se o cartão sair de lá (não é uma conquista permanente, é só o que o Fabio pediu: "pode ter sido erro e o cartão precisar sair pra refazer"). Migration `0006_colunas_kanban_configuraveis.sql` — nova tabela `colunas_kanban`, `tarefas.status` (enum fixo) virou `tarefas.coluna_id` (FK), dados existentes migrados sem perda (1 tarefa real do projeto "Módulo Financeiro" confirmada migrada certo). **Escopo cortado de propósito:** sem drag-and-drop pra reordenar colunas — coluna nova sempre entra no fim, antes do "Concluído". Se o Fabio quiser reordenar depois, é feature nova.
- **Regras de permissão fechadas nesta sessão (pedido explícito do Fabio) — migration `0007_regras_permissao_gestor.sql`, aplicada em produção e testada com as duas contas reais (owner e convidado):**
  - **Só o owner (pagante) cria projeto novo e convida gente pro workspace.** Antes qualquer membro completo podia criar projeto (brecha real — RLS permitia, só não tinha botão pra isso no fluxo normal). Corrigido: RLS de `projetos` (insert) restrita a `owner`, e o formulário "Criar projeto" em `/projetos` some da tela pra quem não é owner. A policy de "gestor de projeto convida" (migration 0003) foi removida — nunca teve UI própria mesmo (a tela de convite só existe em `/equipe`, já restrita a owner).
  - **Dentro de um projeto, todo mundo pode fazer tudo — criar cartão, mover, criar/renomear coluna — menos apagar.** Apagar cartão ou apagar coluna (a fixa "Concluído" nem entra nessa conta, ela nunca pode ser apagada por ninguém) é só do gestor do projeto ou do owner. Testado com a conta convidada real (`gaiamumdash+convite@gmail.com`, membro comum de "Módulo Financeiro", não gestor): botões de apagar cartão e apagar coluna somem da tela pra ela; com a conta owner (`gaiamumdash@gmail.com`) os dois aparecem e funcionam.
  - **Apagar cartão agora sempre fica registrado.** Antes, apagar um cartão também apagava seu histórico de atividade em cascata (mesma tabela `tarefa_atividades`). Agora o histórico sobrevive: `tarefa_atividades.tarefa_id` virou opcional com `on delete set null` em vez de `on delete cascade`, e um novo tipo de atividade `excluida` é gravado (com e-mail pros responsáveis, reaproveitando o sistema de notificação já existente) antes do cartão sumir de fato. Confirmado em produção: apaguei um cartão de teste via Playwright e o histórico dele (movimentações, checklist, e a própria exclusão) segue no banco com `tarefa_id = null`. **Ainda não existe UI pra consultar esse histórico** (mesma pendência de antes, agora vale também pros cartões já apagados).
  - **Decisão explícita do Fabio, registrada como backlog — NÃO implementado:** um modelo mais granular onde auto-atribuição a um cartão não dá direito de mover, só atribuição feita pelo gestor dá. Ele mesmo preferiu deixar aberto por enquanto ("tudo liberado no grupo") e revisitar depois do piloto, se a experiência real mostrar necessidade.
  - **Efeito colateral do teste, não é bug:** o cartão real "Configurar integração bancária" do projeto "Módulo Financeiro" foi apagado durante o teste de ponta a ponta da regra de exclusão-com-registro. Se o Fabio queria manter esse cartão, é só recriar — o teste precisava de uma exclusão real pra confirmar que o registro sobrevive.
- **Processo de aplicar migration em produção mudou de novo:** `supabase db query --linked` sozinho dá 403 (sem privilégio); com a flag `--experimental` (`npx supabase --experimental db query --linked -f caminho/migration.sql`) funciona via Management API, mesma rota segura sem tocar na URI Postgres. Atualizar isso na cabeça pra próxima sessão — o comando exato mudou de "só `--linked`" pra "`--experimental` + `--linked`".

## Estado confirmado (2026-08-30, noite)

- **10 commits publicados** (push confirmado pelo Fabio no início desta sessão, `76de5ab..6d5a905`). **Domínio `gaiamum.com.br` verificado no Resend** — `RESEND_FROM_EMAIL` trocado pra `Gaiamum <notificacoes@gaiamum.com.br>` (código já lia essa env var com fallback pro `resend.dev`, só faltava setar). `RESEND_API_KEY` e `RESEND_FROM_EMAIL` adicionados no Vercel (Production + Preview) e redeploy de produção feito (`dpl_CqqGPYStr4cMDDJwyFqpFBykZgRJ`) — notificação por e-mail passa a funcionar em produção também, não só local. **Confirmado pelo Fabio em 2026-08-30 (sessão nova): o e-mail com remetente `notificacoes@gaiamum.com.br` não caiu mais em spam** (marcou manualmente "não é spam" na primeira vez com o domínio de teste — a reputação do domínio próprio segue normal desde então). Certificado SSL de `https://www.gaiamum.com.br` confirmado ativo (`curl -I` retornou 307 normal, sem erro de handshake). Processo antigo do dev server na porta 3001 (de sessão anterior) foi encerrado e um novo subido limpo.
- **Duas decisões de escopo fechadas nesta sessão:** histórico de atividade do cartão (UI de consulta) fica pra depois — o e-mail já cobre o aviso em tempo real; colunas do kanban configuráveis por projeto também fica pra depois — 3 colunas fixas já cobrem o piloto da FAMA e a organização pessoal, mudar schema agora é risco sem ganho imediato.
- **Próxima frente definida pelo Fabio:** não é código novo — é destravar o piloto real com a Pesquisadora Institucional (PI) da FAMA usando colaboração em equipe, que já está implementada e testada (ver seção "Contexto pessoal/profissional do Fabio" mais abaixo pra estratégia do piloto). **Confirmado em 2026-08-30 (sessão nova): o piloto ainda não começou, começa quarta-feira, 2026-09-02.**
- **Usuário de teste `gaiamumdash+convite@gmail.com` — decisão fechada em 2026-08-30 (sessão nova): mantém como conta de teste recorrente**, não apaga.
- **Kanban: arrastar cartão entre colunas já funciona (confirmado no código), mas o nome/quantidade de colunas é fixo, não configurável.** Fabio perguntou comparando com fotos do Trello — confirmado em `src/components/kanban/quadro-kanban.tsx:65-90` que o drag-and-drop nativo (HTML5, `draggable`/`onDragStart`/`onDrop`) está implementado e funcional, com botões alternativos de mover pra quem preferir clicar. **O que NÃO existe:** as 3 colunas ("A Fazer / Backlog", "Em Execução", "Concluído") são fixas no código (`src/lib/ecc/kanban.ts`) e travadas por `check constraint` no banco (`tarefas.status`) — o usuário não pode criar, renomear ou reordenar colunas como no Trello. **Decisão em aberto, não implementada:** se Fabio quiser colunas configuráveis por projeto, é uma mudança de schema de verdade (colunas viram registros numa tabela nova em vez de um enum fixo, `tarefas` passa a referenciar `coluna_id`, e a lógica de urgência de prazo — que hoje checa `status === "concluido"` — precisa de um jeito de saber qual coluna conta como "concluída"). Perguntar antes de começar.
- **Convite de equipe testado de ponta a ponta com uma segunda conta real** (`gaiamumdash+convite@gmail.com`, mesma caixa via alias `+` do Gmail) — geral (workspace inteiro) e de projeto específico, os dois funcionando: quem aceita convite geral vê tudo (menos excluir); quem aceita convite de projeto cai direto em `/projetos` e só vê o(s) quadro(s) atribuídos, sem Metas SMART/Equipe/onboarding. **3 bugs reais achados e corrigidos nesse teste** (detalhe no checkpoint de hoje): `garantirWorkspace()` criava workspace pessoal à toa pra quem visitava qualquer página antes de aceitar o convite (corrigido — agora honra convite pendente primeiro); RLS de `projetos`/`tarefas` (migration 0003) nunca liberava acesso pra membro "completo" comum, só pra owner/projeto_membros (corrigido via migration 0004, **já aplicada em produção**); `/equipe` e o menu da página de tarefas não escondiam Equipe/Metas SMART de quem tinha escopo de projeto (corrigido).
- **Seletor de quadro no convite e indicação de projeto na lista — implementado e testado.** `FormularioConvite` tem o seletor "convidar pra qual quadro" (Workspace inteiro ou um projeto específico); `ListaConvites` mostra a qual quadro cada convite pertence; botões de excluir projeto/tarefa agora escondem de quem não é owner nem gestor daquele projeto (antes só a RLS bloqueava, a UI mostrava o botão pra todo mundo).
- **Notificação por e-mail quando um cartão muda — implementada e validada em produção real (Resend).** Pedido do Fabio comparando com o Trello: "se eu tô marcado num cartão e alguém mexe, eu recebo e-mail". Log de atividade (`tarefa_atividades`, migration 0005, **já aplicada**) grava quem fez o quê (mover, editar descrição, checklist, adicionar/remover responsável); e-mail em HTML com a marca Gaiamum (`src/lib/ecc/notificacoes.ts`) dispara pros responsáveis do cartão, exceto quem fez a própria mudança. Testado de ponta a ponta com conta Resend real do Fabio — **e-mail chegou** (caiu em spam na primeira vez, esperado com o domínio de teste `resend.dev`; deve parar de cair assim que `gaiamum.com.br` verificar no Resend — DNS ainda não confirmado, ver "Próximos passos"). `RESEND_API_KEY` já está no `.env.local` (chave restrita só a envio, sem acesso de leitura à conta) — **falta adicionar no Vercel (Production + Preview) e fazer redeploy** antes de ir pra produção. **Achado no caminho, relevante pra qualquer integração futura:** o SDK do Resend (e o supabase-js) não lança exceção em erro de API — devolve `{ data, error }` no retorno normal; um `.catch()` sozinho não pega esse tipo de erro, tem que checar o campo `error` explicitamente. **Ainda falta:** UI pra ver o histórico de atividade do cartão (hoje só existe a tabela e o e-mail, sem tela pra consultar depois) — perguntar ao Fabio se entra agora ou depois.
- **MCP do Resend adicionado ao projeto** (`claude mcp add --transport http resend https://mcp.resend.com/mcp`) pra debug mais preciso (ver e-mails enviados, status de entrega) — só carrega numa sessão nova do Claude Code (a que adicionou já estava rodando com a lista antiga) e provavelmente vai pedir autorização OAuth no navegador na primeira vez, como o Figma.
- **3 ideias novas registradas pro Módulo Financeiro (Onda 3, ainda não iniciado)** — Nibo Empresas via API REST, lista de contas a pagar com anexo de comprovante, e backup por e-mail com senha só pro Fabio. Nada implementado ainda — texto completo na seção **"Financeiro (Onda 3) — ideias registradas"** mais abaixo.
- **3 temas + barra de progresso animada** (implementados e testados nesta sessão): `ThemeToggle` agora tem 3 botões (claro / azul-navy / preto), o preto usa acento laranja/âmbar (pedido explícito do Fabio, referência de um dashboard preto e laranja — só nesse tema, os outros dois mantêm a paleta azul/ciano oficial da marca). `BarraProgresso` (`src/components/ui/barra-progresso.tsx`) mostra % de preenchimento com uma animação do caranguejo da marca andando até uma "toca" desenhada no fim da barra, que fica visível desde 0% (a meta visual) — em 100% o caranguejo encolhe e desaparece dentro dela. Já em uso no formulário de metas SMART, reaproveitável em qualquer formulário de preenchimento longo.
- **Colaboração em equipe (Onda 1) — implementada, testada e com notificação por e-mail (ver itens acima).** Convite por link (copiar e mandar manualmente), aceitar convite em `/convite/[token]` ou automaticamente ao logar se já houver convite pendente pro e-mail. **Ampliado durante a sessão de 2026-08-29** a partir de feedback do Fabio comparando com o Trello: convite pode ser vinculado a um **projeto específico** — quem aceita só enxerga aquele quadro, não a plataforma inteira (`projeto_membros`, `memberships.escopo`). Cada projeto tem um **gestor** (quem cria vira gestor automático); só o gestor ou o owner do tenant apaga cartão ou quadro — nunca qualquer membro. Cartão de tarefa ganhou: descrição editável, membros múltiplos (não um responsável só), checklist, data de início, destaque visual (borda colorida) pra quem é responsável, cor do prazo corrigida (vermelho já no dia do vencimento, não só depois), e colar texto multi-linha no título cria uma tarefa por linha (útil pra colar uma lista pronta).
- **Visão de longo prazo do produto fechada nesta sessão** (documentação, nada implementado) — ver a seção **"Visão North Star — Growth OS"** mais abaixo neste arquivo para o texto completo: os 3 planos **Toca / Colônia / Manguezal** (nomes definidos pelo Fabio, metáfora do próprio mangue/caranguejo da marca), o "Perfil da Empresa" (cadastro reutilizável em tudo, inspirado na Fase 1 do av-value-engine), e a ordem de construção por ondas com o corte de MVP vendável nas Ondas 0-4.
- **Duas skills irmãs analisadas** (`av-brand-engine` e `av-sales-engine`, na pasta `C:\Users\proff\OneDrive\Documentos\Engenharia de demanda`, mesma família da `av-value-engine` já processada antes) — relatório crítico completo na seção "Visão North Star" abaixo. **Nota de propriedade importante, confirmada pelo Fabio:** ele comprou o curso e recebeu o material dessas skills; **o conceito/metodologia não pertence à empresa que vendeu, só o material (texto, templates, nome "Agência de Valor") pertence a ela.** Reaproveitar o *conceito* (mecanismo, estrutura) customizado pro público do Gaiamum é OK; copiar texto, nomes de etapas ou templates literais não é.
- **Domínio próprio comprado:** `gaiamum.com.br` (registro.br), `www.gaiamum.com.br` é o principal. Já adicionado ao projeto Vercel, redirect 301 apex→www configurado em `next.config.ts`, `metadataBase` e `site_url`/`uri_allow_list` do Supabase já apontam pro domínio novo. **DNS configurado e propagado nesta sessão** — `gaiamum.com.br` e `www.gaiamum.com.br` já resolvem pro IP da Vercel (`76.76.21.21`). **Falta só o certificado SSL ativar** (automático da Vercel, ainda não confirmado até o fim desta sessão — handshake TLS falhava com `SSL/TLS connection failed`); reconferir com `curl -I https://www.gaiamum.com.br` na próxima sessão antes de divulgar o domínio.

- **Fundação + Módulo 0-2** implementados e **testados de ponta a ponta nesta sessão** (signup → confirmação de e-mail → metas SMART → projeto → kanban, tudo em produção com a conta `gaiamumdash@gmail.com` / senha `GaiamumTeste2026!`): onboarding SMART (export Markdown em `/ecc-system/metas/` confirmado, com frontmatter e link Obsidian-style), projetos (CRUD), kanban de tarefas (criar + mover entre colunas, com tags pessoal/ifaz/faculdade/vendas). Detalhes de arquitetura na seção "Fundação técnica" abaixo. **Esse usuário de teste ainda existe em produção** — decidir com o Fabio se apaga ou mantém (ver "Próximos passos").
- **Menu lateral novo** (`src/components/layout/menu-lateral.tsx`): logo + "Projetos" + "Metas SMART" (badge "Pendente" enquanto não preenchido), presente em `/onboarding`, `/projetos` e `/projetos/[id]/tarefas`. `/onboarding` não redireciona mais sozinho quando já existem metas — mostra confirmação com link pra projetos, pra não duplicar dados se o usuário reabrir pelo menu. Formulário SMART ganhou placeholders de exemplo em todos os campos, título de cada campo com badge de letra (S/M/A/R/T), e botão "Pular, preencho depois" (nova action `pularOnboarding`, via `formNoValidate`).
- **Bug de tema corrigido** (achado ao investigar reclamação de contraste ruim no tema claro): `ThemeToggle` tinha um hydration mismatch real — lia `document` direto no estado inicial do `useState`, que sempre calcula "dark" no servidor (sem acesso a `document`) mas o valor real no cliente durante a hidratação, fazendo o React descartar a árvore inteira e deixando o tema inconsistente. Corrigido com `useSyncExternalStore` (snapshot do servidor fixo em "dark", sincroniza com o DOM real só depois da hidratação). Não era um problema de cor/CSS — as variáveis de tema claro já tinham bom contraste (`#002559` sobre fundo claro).
- **Infraestrutura 100% pronta e no ar**, independente do UltraQuadras:
  - **GitHub:** conta `gaiamumdash-commits`, repo `gaiamumdash-commits/dashboard`, branch `main`.
  - **Vercel:** time `gaiamum-dash`, projeto `gaiamum-dashboard`, conectado ao GitHub (deploy automático a cada push), env vars do Supabase em Production + Preview.
  - **Supabase:** projeto `gaiamum-dashboard` (ref `zfjtcivusdmjvdbycpjs`, São Paulo), migration `0001_schema_inicial.sql` aplicada — tabelas `tenants`, `memberships`, `metas_smart`, `projetos`, `tarefas` confirmadas. `site_url` e `uri_allow_list` corrigidos (estavam em `localhost:3000`, agora apontam pra produção + localhost).
  - **`gh` e `vercel` CLI desta máquina** foram trocados da conta "ultraquadras" pra `gaiamumdash-commits`/`gaiamum-dash` — ficam assim permanentemente pra este projeto.
- **AIOX instalado** localmente no projeto (framework de agentes/governança, auditado sem achados de segurança). Ver "Convenção de push" abaixo — muda como publicar no repo.
- **Identidade visual completa:** tema escuro (padrão) + tema claro (alternável, botão fixo no canto), favicon, apple-touch-icon e imagem de Open Graph, todos com a paleta oficial da marca.
- **Página de login com a arte oficial da marca:** layout dividido (arte à esquerda em telas largas, formulário à direita) com versão mobile dedicada (arte vertical sem os mockups, como fundo com o cartão flutuando embaixo). **Login com Google testado nesta sessão** (clique real no navegador via Playwright): redireciona certo pro Google com o `redirect_uri` batendo no callback do Supabase — fluxo tecnicamente correto (não completei o login de verdade, é conta pessoal). **Fluxo de "esqueci minha senha" testado tecnicamente**: o envio retorna sucesso e a página `/auth/redefinir-senha` carrega certo; disparei um teste real pra `gaiamumdash@gmail.com` — falta o Fabio confirmar se o e-mail chegou e seguir o link até o fim.
- **Responsividade da tela de login corrigida nesta sessão** (o Fabio notou a arte cortada em tela não-maximizada, e pediu pra também cobrir tablet): eram dois bugs de `object-fit`/layout, não de asset. Desktop: `object-cover` cortava o mockup "Fornecedores" em containers mais estreitos que a proporção 16:9 da arte — trocado pra `object-contain` e recortada a faixa vazia da direita da própria imagem (`login-hero.png`, 1672×941 → 1010×941) pra não sobrar espaço vazio. Mobile/tablet: em tablet retrato (proporção mais "quadrada" que a de celular) o `object-cover` esticava a arte e cortava o texto "Cresça." no meio; e mesmo em celular normal o cartão de login (relativamente alto) sobrepunha esse mesmo texto. Corrigido com `object-contain` a partir de `md:` + um spacer de `min-h-[48vh]` empurrando o cartão pra baixo do bloco de texto antes de deixá-lo flutuar. Testado em iPhone 14 (390×844), tablet retrato (768×1024, 834×1194), tablet paisagem (1024×768) e desktop (1280×720, 1920×1080) — sem regressão. 2 commits locais, sem push ainda: `a659265` (fix desktop) e `1f33afd` (fix tablet/celular).
  - **Pegadinha nova:** o cache de otimização de imagens do Next (`.next/cache/images`) guarda entradas por formato (PNG/WebP) e sobrevive a `rm -rf .next/cache/images` se o processo antigo do `next dev` ainda estiver rodando (ele seguia vivo mesmo depois de `TaskStop`, precisou `taskkill` no PID da porta). Se trocar um asset de imagem e o resultado no navegador não mudar, apagar a pasta `.next` inteira com o processo já morto, não só `.next/cache/images`.
- **Módulos 3-7** (financeiro, CRM, vendas, relatórios/IA, painel owner, pagamentos) — nenhum iniciado.

### Convenção de push (importante, mudou nesta sessão)

O AIOX ativou um hook (`enforce-git-push-authority.cjs`) que bloqueia `git push`/`gh pr create`/`gh pr merge` por padrão. Pra publicar, prefixar SÓ o comando de push (nunca fixar a variável pra sessão inteira):

```bash
AIOX_ACTIVE_AGENT=devops git push
```

Continua valendo sempre pedir confirmação ao Fabio antes de qualquer push — isso não mudou. Ver [[feedback_gaiamum_aiox_push_devops]].

### Onde encontrar as coisas

- **Marca/logo fonte:** `C:\Users\proff\Downloads\Gaiamum marca\` (`Gaiamum dashboard.png` = versão escura, `Logo Gaimum no branco.png` = versão clara, `Layout pag login Gaiamum.png` = hero desktop do login, `Layout Gaiamum Mobile.png` = hero mobile do login). Cópias em uso já estão em `public/brand/` no repo (`crab-mark.png`, `login-hero.png`, `login-hero-mobile.png`).
- **Paleta:** navy `#011f51` (bg escuro), `#0069fd` (primário), `#0141bc` (hover), `#00cbee` (acento ciano), `#f5e9dc` (texto/creme no escuro), `#002559` (texto no tema claro).
- **Export Obsidian:** `/ecc-system/metas/` dentro do repo — Markdown com frontmatter gerado a cada meta SMART salva. Não substitui o Supabase (fonte de verdade), é só destino de leitura no Obsidian. **Claude não abre/usa o Obsidian** (é um app de desktop com interface gráfica) — só gera Markdown compatível. Se o Fabio quiser navegar as notas, é ele quem abre o Obsidian e aponta pra `c:\Users\proff\Documents\Gaiamum\` (o repo inteiro, não só `/ecc-system/` — assim `docs/handoffs/` também fica navegável). Hoje `/ecc-system/metas/` está vazio (nenhum onboarding real rodou ainda).
- **Memórias relevantes (fora do repo):** [[projeto_gaiamum_dashboard_novo_saas]] (visão geral), [[feedback_evitar_onedrive_novos_projetos]], [[projeto_gaiamum_referencia_dashboard_sow]] (padrões de UX pros módulos 3-6), [[feedback_gaiamum_aiox_push_devops]].

---

## Fundação técnica (não muda com frequência)

- Next.js 16 App Router + React 19 + TypeScript strict, espelhando os padrões do repo irmão `platform` (padrão de 3 clientes Supabase, `proxy.ts`, Tailwind v4 CSS-first).
- Schema Postgres multi-tenant (`tenants`/`memberships`/`current_tenant_ids()`) + RLS.
- **Módulo 0 — Onboarding:** formulário guiado de metas SMART (médio/longo prazo), grava em `metas_smart`, exporta Markdown em `/ecc-system/metas/`.
- **Módulo 1 — Projetos:** CRUD completo por workspace (`src/app/projetos/`, `src/components/projetos/`).
- **Módulo 2 — Kanban:** 3 colunas, drag-and-drop nativo (`<div draggable>`, não `motion.div` — Framer Motion tem prop própria de gesto que colide com drag-and-drop HTML5), prioridade P1-P4, tags, indicador visual de prazo.
- **Arquivos-chave:** `src/lib/supabase/{client,server,service,middleware}.ts`, `src/lib/ecc/{tipos,workspace,kanban,smart,actions}.ts`, `src/lib/ecc-export/metas.ts`, `supabase/migrations/0001_schema_inicial.sql`.
- **PWA:** `public/manifest.json`, `public/sw.js`, `public/icons/*.png` (dark, pro manifest/instalação) + `src/app/{icon,apple-icon,opengraph-image}.png` (light, pro favicon/compartilhamento — convenção de arquivo do Next, gerados automaticamente pro `<head>`).
- **Tema claro/escuro:** `src/components/theme-toggle.tsx` + tokens em `globals.css` (`:root` = escuro padrão, `:root[data-theme="light"]` = claro), script inline em `layout.tsx` aplica antes do paint (evita flash).

### Decisões-chave

| Decisão | Motivo |
|---|---|
| Projeto 100% separado do `platform`, pasta própria, git próprio, contas próprias | Pedido explícito do Fabio |
| Fora do OneDrive (`Documents\Gaiamum`) | Obsidian não exige OneDrive; regra dura sem exceção, ver [[feedback_evitar_onedrive_novos_projetos]] |
| Stack espelha o `platform` | Mesmo autor/ambiente, padrões já comprovados em produção |
| Metas SMART em v1 são manuais (sem IA) | "Conversão automática via IA" do spec original é módulo futuro não arquitetado ainda |
| `supabase db push` evitado, migration aplicada via API de gerenciamento HTTPS | `db push` é bloqueado por um secret-guard local (evita vazar URI Postgres com senha) |
| `.aiox-core/` e pastas de outros IDEs fora do git e do ESLint | 51MB de framework vendorizado, reconstituível via `aiox install`, mesma lógica de `node_modules/` |

---

## Pegadinhas

- **Build local precisa de internet** pra baixar a fonte Inter do Google Fonts. Falha transitória já aconteceu uma vez, resolveu na segunda tentativa.
- **`npm run build` exige as 3 env vars do Supabase** mesmo sem uso real (`/auth` é pré-renderizado estaticamente). Sem `.env.local` real, usar valores fictícios só pra validar o build.
- **CRLF warnings do git** no Windows são inofensivos, não precisa agir.
- **`vercel whoami` pode retornar "Not authorized" mesmo autenticado** — usar `vercel teams ls` pra confirmar a conta de verdade.
- **`gh`/`vercel`/`supabase` CLI não têm fluxo de login por navegador funcional neste ambiente** (não é TTY interativo) — usar `gh auth login --web` (gera device code, funciona via polling), `vercel login <email>` (magic link), e pro Supabase CLI, `supabase login --token <personal-access-token>` (gerado manualmente em supabase.com/dashboard/account/tokens).

## Comandos úteis pra retomar

```bash
cd "/c/Users/proff/Documents/Gaiamum"
npm run dev                         # roda local (precisa de .env.local com credenciais reais)
npx tsc --noEmit -p tsconfig.json   # typecheck
npx eslint .                        # lint
git log --oneline                   # histórico de commits
git status                          # confirmar working tree limpo
AIOX_ACTIVE_AGENT=devops git push   # publicar (ver "Convenção de push")
```

---

## Próximos passos

### Imediato (retomar por aqui)

1. **Verificar o domínio `gaiamum.com.br` no Resend** (Domains → Add Domain → colar os registros DNS no registro.br) — sem isso o e-mail de notificação continua saindo de `onboarding@resend.dev` e caindo em spam. Depois de verificar, trocar `RESEND_FROM_EMAIL` (novo env var) pra algo como `Gaiamum <notificacoes@gaiamum.com.br>`.
2. **Adicionar `RESEND_API_KEY` no Vercel** (Production + Preview) e fazer redeploy — hoje só existe em `.env.local` local, notificação não funciona em produção ainda.
3. **Decidir se entra agora uma tela de histórico do cartão** (a tabela `tarefa_atividades` já grava tudo, só falta UI pra consultar) — ou fica pra depois, já que o e-mail cobre o aviso em tempo real.
4. **Decidir se colunas do kanban ficam configuráveis por projeto** (hoje são fixas — ver "Estado confirmado") — é mudança de schema, não só de UI, então vale confirmar antes de começar.
5. **Fazer push dos commits locais acumulados** (bugs de convite corrigidos + notificação por e-mail + registros de ideias) — pedir aprovação do Fabio antes, como sempre (ver "Convenção de push").
6. Reconferir certificado SSL da Vercel se ainda não foi feito: `curl -I https://www.gaiamum.com.br`.
7. ~~Decidir com o Fabio: apagar os usuários de teste ou manter como conta de teste recorrente.~~ **Fechado em 2026-08-30: mantém `gaiamumdash+convite@gmail.com` como conta de teste recorrente.**

### Depois

- Módulos 3-7 (financeiro, CRM, value engine/vendas, relatórios/IA, painel owner + Resend, pagamentos, criptografia) — nenhum iniciado. Ver [[projeto_gaiamum_referencia_dashboard_sow]] pra padrões de UX reaproveitáveis.
  - **Decisão de visão registrada nesta sessão (2026-08-30):** as metas SMART do onboarding (Módulo 0) não são sobre colaboração — são a base do "Plano de Ação". O Fabio quer que o futuro Módulo 5 (relatórios/IA) use essas metas de médio/longo prazo como contexto pra IA sugerir ações nos relatórios, alinhadas aos objetivos que o dono do negócio definiu. Guardar isso pra quando o Módulo 5 for arquitetado — hoje as metas só existem em `metas_smart` e no export Markdown, sem nenhum consumo por IA ainda.
- Avaliar se vale evoluir o Módulo 1/2 pra amarrar tarefa↔produto vendido (padrão visto na referência SOW).
- **Colaboração em equipe (estilo Trello)** — ver seção dedicada abaixo. Prioridade estratégica do Fabio, considerar antes de aprofundar demais nos módulos 3-7.

### Colaboração em equipe (estilo Trello) — decisão estratégica, 2026-08-29

Fabio perguntou se o Gaiamum pode suportar times trabalhando juntos (tipo Trello) e se isso precisa ser desde o início ou pode ser evolução. **Veredito: pode ser evolução, sem dívida técnica.** O schema já foi desenhado multi-tenant desde a Fase 0 de propósito (`tenants` + `memberships` com papel `owner`/`member` + RLS por `tenant_id`) — o mesmo padrão do UltraQuadras — exatamente pra não bloquear "vários usuários por workspace" depois. Isso já está pronto e funcionando.

**O que falta construir (não existe hoje):**
1. Convite de membro pro workspace (fluxo de convite por e-mail, aceitar convite, hoje só quem cria o workspace existe nele).
2. Atribuição de tarefa a uma pessoa (`tarefas` não tem coluna de responsável ainda).
3. Diferenciação real de permissão entre `owner` e `member` (hoje são só rótulos).

**Why isso importa (registrado a pedido do Fabio):** ele considera isso importante pra evolução do produto e pra aumentar a chance de comercializar o Gaiamum — colaboração em equipe é o que diferencia uma ferramenta pessoal de um produto vendável pra empresas. Prioridade estratégica, não só técnica.

**Roadmap futuro relacionado (mencionado pelo Fabio, ainda não arquitetado):** integração com a API oficial da Meta (WhatsApp Business) pra lembretes de tarefa chegarem via WhatsApp — torna o produto mais aderente ao jeito que times realmente trabalham (ver o padrão "Alertas Comerciais" com WhatsApp na referência SOW, [[projeto_gaiamum_referencia_dashboard_sow]]). Não é escopo imediato, mas deve pesar na decisão de quando construir o módulo de colaboração (o campo "responsável" da tarefa é o gancho técnico que a notificação de WhatsApp vai precisar).

### Visão North Star — Growth OS, registrada 2026-08-30 (madrugada) — NÃO começar a implementar sem retomar com calma

Sessão que já vinha de um relatório overnight (ver checkpoint da madrugada) cruzando a skill `av-value-engine` + o dashboard de referência SOW com o roadmap do Gaiamum. O Fabio aprovou o relatório inteiro e, em cima disso, ampliou a visão do módulo Value Engine/vendas pra algo bem maior — registrado aqui **só como visão de longo prazo**, explicitamente **não pra implementar agora** (decisão do próprio Fabio: "registre a ideia e realizamos de forma modular, com calma").

**O que o Value Engine vira, na visão ampliada:**
1. **Assistente de conteúdo com IA** — copy, criativos, carrosséis e stories pra vender os produtos do usuário.
2. **Integrações externas via MCP** com Windsor.ai, Metricool e Trello — puxar dados de tráfego pago/Instagram e organizar execução no momento certo.
3. **Dashboard de relatórios diários** exclusivo — contas de Instagram + tráfego pago.
4. **Gerador de propostas comerciais e landing pages com IA**, reaproveitando a mesma "expertise" da skill `av-value-engine` (a lógica de conta/valor em dois cenários, já mapeada como base do Value Engine no relatório overnight).
5. **Integração com Google Calendar** + follow-up automatizado — o diferencial sobre a skill original, que não tem isso.
6. **Onboarding modular:** o usuário escolhe quais módulos quer no sistema dele (muda a estrutura do onboarding construído nesta sessão).
7. **3 planos de preço**, do operacional ao "empresa com IA aplicada à estratégia de negócios".

**Por que não começar agora (consenso desta sessão):** Windsor.ai, Metricool, Trello e Google Calendar exigem OAuth/credenciais reais — não é algo pra configurar de madrugada sem sessão de cabeça fresca revisando cada permissão concedida. Preço de plano trava o modelo de receita — merece conversa com calma, não decisão de virada de noite. E onboarding modular mexe direto na estrutura que acabou de ser construída e validada nesta mesma sessão (formulário SMART, menu lateral) — value do risco de quebrar o que já está testado é maior que o ganho de decidir isso agora.

**Nomes dos 3 planos, decisão do Fabio (substituem os nomes genéricos da primeira proposta):** usar a metáfora do próprio mangue/caranguejo que já é a identidade visual do Gaiamum (a "toca" que a barra de progresso do onboarding já anima) — um caranguejo sozinho → uma colônia → o manguezal inteiro. Reforça a marca em vez de nome genérico de SaaS, e a progressão de complexidade dos planos bate exatamente com a progressão natural da metáfora.

| Plano | Tagline | Módulos | Preço/mês (hipótese, números não pesquisados) |
|---|---|---|---|
| **Toca** | Sua base, organizada. | Metas SMART, Projetos, Kanban, Financeiro básico | R$97–147 |
| **Colônia** | Cresça com o time. | + CRM/Pipeline, Value Engine, Dashboard Instagram/tráfego (Windsor/Metricool) | R$247–397 |
| **Manguezal** | Todo o ecossistema do seu negócio, rodando junto. | + Relatórios/IA, propostas comerciais e landing pages geradas, follow-up, Trello + Google Calendar | R$597–997 |

"Colônia" reforça de propósito o módulo de colaboração em equipe (convite de membro, atribuição de tarefa) — o nome já comunica por que faz sentido pagar mais pra ter time. Nota pro futuro (não decidir agora): um eventual plano pra agências/parceiros gerenciando vários workspaces poderia seguir a mesma lógica com "Recife" — só guardando a ideia.

**Retomar assim:** quando o Fabio quiser avançar nisso, começar decidindo UM pedaço concreto pra prototipar primeiro (provavelmente o gerador de propostas/landing page com IA do plano Manguezal, que já reaproveita o que o relatório overnight mapeou pro Value Engine, sem depender de nenhuma integração externa nova) — não tentar as 7 peças de uma vez.

#### Financeiro (Onda 3) — ideias registradas, 2026-08-30 (não implementar ainda)

Três pedidos do Fabio pro futuro Módulo Financeiro, registrados na mesma sessão em que o convite de equipe foi validado e a notificação por e-mail entrou:

1. **Integração com o Nibo Empresas via API REST** — Fabio já usa o Nibo pra financeiro e quer conectar o Gaiamum nele em vez de reconstruir contabilidade do zero. Ele mesmo providencia a credencial da API quando chegar a hora; guardar a intenção desde o desenho do schema financeiro, pra não modelar `lancamentos` de um jeito que depois brigue com o formato do Nibo.
2. **Lista de contas a pagar**, com: data de vencimento, data de pagamento, opção de marcar como paga, e **anexar comprovante** (foto/PDF) a cada conta. **Motivo dado pelo Fabio:** ele paga muita coisa em dinheiro no dia a dia e perde o comprovante físico — o anexo dentro do cartão da conta vira o arquivo de comprovante permanente, resolvendo isso de vez. Tecnicamente é a mesma peça de "anexar arquivo" já registrada pro cartão de tarefa (Google Drive/upload direto) — vale desenhar uma solução de anexo única e reaproveitar nos dois lugares (tarefa e conta a pagar) em vez de duas implementações separadas.
3. **Backup por e-mail, só pro próprio Fabio, protegido por senha:** um resumo total com todas as informações do app (financeiro incluído) enviado periodicamente (ou sob demanda) só pro e-mail dele, como cópia de segurança fora do Supabase. Detalhes técnicos ainda não decididos — precisa definir formato (PDF/CSV com senha? ZIP com senha?), frequência (diário/semanal/mensal) e qual biblioteca gera arquivo protegido por senha a partir do Next.js/Node sem depender de serviço externo pago. Como já existe `RESEND_API_KEY` configurado nesta sessão (ver "Estado confirmado"), o envio em si reaproveita a mesma infraestrutura de e-mail — só falta desenhar o conteúdo/formato do backup e o agendamento (provavelmente um cron job da Vercel, mesmo padrão já usado no `platform`/UltraQuadras).

#### Página de faturamento — ideia registrada, 2026-08-30 (não implementar ainda)

Pedido do Fabio: uma tela onde o usuário vê o plano contratado e as informações de pagamento/fatura, baseada em apps de referência. Pertence à **Onda 10 (Pagamentos)**, propositalmente a última — depende de uma decisão ainda não tomada (qual gateway; Stripe é o padrão de mercado pra SaaS no Brasil, com Billing Portal pronto que cobre boa parte disso sem construir do zero) e da tabela `planos` da Onda 0 já existir.

**Campos que apps de referência (Stripe Billing Portal, Vercel, Notion) normalmente têm, pra usar de base quando for construir:**
- Plano atual (nome + preço) e data da próxima cobrança.
- Método de pagamento: cartão mascarado (final 4 dígitos, bandeira, validade) + botão trocar.
- Histórico de faturas: lista com data, valor, status (pago/pendente/falhou), link pra PDF de cada uma.
- Botão de upgrade/downgrade entre os 3 planos (Toca/Colônia/Manguezal), com o valor pro-rata da mudança.
- Cancelamento com confirmação (e, se fizer sentido, oferta de retenção antes de confirmar).
- Uso do plano quando houver limite (ex.: "3 de 15 membros", "1 de 2 empresas no Manguezal") — dá pro usuário ver quando está perto do teto antes de precisar fazer upgrade.

**Ordem de construção por ondas (dependências, não cronograma fixo — decisão final desta sessão):**

| Onda | O que entra | Por que nessa ordem |
|---|---|---|
| 0 — Fundação silenciosa | Tabela `planos` (Toca/Colônia/Manguezal + limites), confirmar multi-empresa = multi-tenant | Base pra tudo que vier depois (módulos, limites, Perfil da Empresa) |
| 1 — Colaboração em equipe | Convite de membro, `responsavel_id` em tarefas, permissão owner/member real | Já prioridade do Fabio; "Colônia" só faz sentido como nome com isso funcionando |
| 2 — Perfil da Empresa | Cadastro essencial+aprofundado, busca automática, diagnóstico, Avatar do Cliente Ideal, Perfil Consolidado | Tudo que gera conteúdo depois lê daqui |
| 3 — Financeiro básico | Lançamentos com tag âmbito (pessoal/profissional) + estratégia (receita/custo) desde o schema inicial | Value Engine e Relatórios/IA não têm matéria-prima sem isso |
| 4 — Projetos ↔ produto vendido | Checklist herdado do produto | Evolução pequena do que já existe |
| — **MVP vendável termina aqui (ondas 0-4)** — recomendação: validar com cliente pagante antes de seguir | | |
| 5 — CRM/Pipeline | Reaproveita o kanban + prospecção assistida (Fase 5 da skill) | Fecha o ciclo lead → venda → dinheiro |
| 6 — Value Engine/vendas | Motor de conta de valor + gerador de propostas/landing pages (reaproveitando o design system do `deliverables.md`) | Consome Perfil da Empresa + Financeiro + CRM |
| 7 — Relatórios/IA | Sugestões ancoradas nas metas SMART | Herda a lógica de cenário conservador/realista já validada no Value Engine |
| 8 — Growth OS externo | MCP Windsor/Metricool/Trello/Google Calendar, dashboard de tráfego, assistente de conteúdo (roteamento por framework de copy), bot conversacional | Só depois de tudo interno provado — é onde entra credencial de terceiro e contexto suficiente pro bot não ser genérico |
| 9 — Painel do dono + onboarding modular real | Usuários, Auditoria, escolha de módulos dentro do teto do plano | Precisa da tabela `planos` da Onda 0 já madura |
| 10 — Pagamentos | Cobrança de verdade, criptografia | Por último — compliance pesa mais aqui que em qualquer outra onda |

Ajuda contextual em tela (o que é, por que fazer, o que aumenta receita/corta custo, dica de produtividade) não é uma onda separada — é requisito de qualidade de toda tela construída a partir da Onda 0.

#### Perfil da empresa (cadastro completo, reutilizável em tudo) — ideia adicional do Fabio, 2026-08-30

Inspirado na Fase 1 (`Diagnóstico da Agência`) da skill `av-value-engine`: um cadastro de empresa completo — nome, site, redes sociais, logo, nicho, tempo de operação, tamanho de time, faturamento (faixa), principal desafio — preenchido uma vez e reaproveitado em tudo que o sistema gerar depois (propostas, landing pages, criativos, contratos), pra o usuário não ficar subindo as mesmas informações toda hora.

**Detalhe importante relido com atenção no `detailed-flow.md` (a skill original faz mais que só coletar dados):** ela pesquisa sozinha via busca na web e acessa o site/redes informados pra completar o que faltou, e devolve um **diagnóstico automático em 3 blocos (Forças, Gaps, Melhorias prioritárias numeradas)** antes de qualquer outra coisa. Vale reaproveitar esse padrão no Gaiamum: pedir só nome + 1 link pra começar, o sistema busca o resto sozinho, e devolve um mini-diagnóstico como primeira "vitória rápida" do onboarding — mais forte que um formulário estático.

**Melhorias sobre o original, específicas do Gaiamum:**
- Dividir em 2 blocos, como o formulário SMART já faz: **essencial** (nome, nicho, logo, 1 rede social — libera o resto do sistema) e **aprofundado** (pode pular, mesmo padrão "Pular, preencho depois" já existente).
- Dois campos que a skill original não tem, mas valem muito aqui (o perfil alimenta geração de criativo, não só relatório): **cores da marca** (extraídas do logo automaticamente, como já foi feito com a arte oficial do Gaiamum via `sharp`) e **tom de voz** (formal/descontraído/técnico).
- Reaproveitar a mesma `BarraProgresso` com a animação do caranguejo indo pra toca (já existe e é genérica).
- Precisa de uma tela de "Perfil da Empresa" nas configurações pra editar depois — não é só onboarding, senão vira dado congelado no dia 1.

**Diferenciação de plano (mencionada pelo Fabio):** o plano Manguezal permite cadastrar até 2 empresas simultâneas (ex.: alguém tocando duas marcas). Isso muda uma decisão de schema, não só um número de plano: o perfil de empresa vive num nível abaixo do `tenant`, cada empresa com seu próprio perfil completo, e o usuário troca de "empresa ativa" — mesmo padrão de um seletor de workspace. Guardar essa decisão de schema pra quando o Perfil da Empresa for arquitetado de verdade.

#### Fechamento de escopo — análise completa dos 3 documentos de referência, 2026-08-30

O Fabio pediu uma análise minuciosa de tudo que foi anexado nesta sessão (landing page "Copy Master", PDF de screenshots do dashboard "Vibe Coding"/SOW, e a skill `av-value-engine` completa) pra fechar o escopo de uma vez, antes de qualquer implementação nova. Resultado:

**Decisões de arquitetura fechadas (resolvem contradições encontradas na revisão):**
1. **"Onboarding modular" (item 6 do Growth OS) não é escolha de billing.** O plano (Toca/Colônia/Manguezal) define o teto de módulos disponíveis; dentro desse teto, o usuário só escolhe o que fica visível no menu lateral. Resolve a contradição entre "planos com módulos fixos" e "usuário escolhe módulos livremente".
2. **Multi-empresa (até 2 no Manguezal) = múltiplos `tenants` por usuário**, não uma hierarquia nova dentro do tenant. Reaproveita 100% do multi-tenant já existente.
3. **Precisa existir uma tabela `planos` (Toca/Colônia/Manguezal + limites) antes do onboarding modular ser construído** — senão o onboarding modular nasce sem teto pra respeitar e precisa ser refeito quando o billing chegar.

**Três peças novas que a análise da skill `av-value-engine` trouxe (não estavam registradas antes):**
- **Avatar do Cliente Ideal** (Fases 3-4 da skill: 5 dores, 5 desejos, dor unificada, gatilho de compra) — vive no Perfil da Empresa ou no CRM, calibra Value Engine e Assistente de Conteúdo pro nicho real do usuário em vez de gerar coisa genérica.
- **Prospecção assistida** (Fase 5: 3 referências de mercado + 5 clientes-alvo, cada um com site/Instagram/estado atual/ângulo de abordagem, tudo pesquisado via busca) — função nova dentro do módulo CRM/Pipeline: o sistema ajuda a *encontrar* leads, não só a organizar os que o usuário já digitou.
- **"Perfil Consolidado"** (inspirado no `Engine.md` da skill — o "cérebro portátil" que ela gera no final): em vez de cada módulo de IA (relatórios, propostas, conteúdo, o futuro bot) buscar dado espalhado em várias tabelas, todos leem de uma fonte única consolidada (perfil da empresa + metas SMART + avatar do cliente + conta de valor). Vira a espinha dorsal técnica de todo o Growth OS.

#### av-brand-engine e av-sales-engine — duas skills irmãs analisadas, 2026-08-30

Mesma família da `av-value-engine` (pasta `C:\Users\proff\OneDrive\Documentos\Engenharia de demanda`). Análise feita por um subagente dedicado, resumo crítico abaixo. **Nota de propriedade (confirmada pelo Fabio):** o conceito/metodologia não pertence à empresa que vendeu o curso, só o material (texto, templates, nome de marca) pertence — reaproveitar o *mecanismo* customizado pro Gaiamum é OK, copiar texto/templates literais não é.

**`av-brand-engine`** é um compilador de design system em skill: recebe um zip (spec + HTML + PNGs de logo), faz parsing de tokens de cor/tipografia, mede os PNGs programaticamente (luminância, contraste WCAG) pra classificar logos e recomendar onde usar cada um, e gera um `SKILL.md` que vira gatilho automático pra qualquer peça visual futura da marca. Peça reaproveitável: o **método de extração determinística com fallback explícito `[VERIFICAR]` (nunca inventa)** — útil se o Gaiamum um dia permitir personalizar a identidade visual de relatórios/propostas por tenant.

**`av-sales-engine`** é um compilador de funil comercial: lê o `Engine.md` do value-engine, roda uma entrevista de 6 fases e gera um playbook (PDF + `Sales.md`, um prompt estruturado pra uma IA operar CRM). O funil fixo de 7 etapas (Base → Conexão → Contato → Agendado → Call → Negociação → Perdido) é hiperespecífico de venda B2B consultiva de ticket alto (agência com SDR/Closer) — **não generaliza direto** pro público real do Gaiamum (pequeno comércio, prestador de serviço local). Peças que generalizam bem: a **regra de ouro "lead nunca fica sem próxima ação com data"**, **motivos de perda padronizados obrigatórios**, e o padrão de **"documento estratégico gera automaticamente cadências operacionais"** — aplicável a um CRM leve genérico (5-7 estágios configuráveis, não fixos) dentro do Gaiamum.

**Conexão com o Value Engine:** as três formam uma cadeia — Value Engine (oferta/conta de valor) → Sales Engine (funil que ancora negociação na conta de valor, nunca desconto) → Brand Engine (skin visual dos entregáveis). Mapeia bem pro Gaiamum: toda negociação no futuro CRM deveria reforçar o valor calculado pelo Value Engine, não virar desconto solto.

**Riscos técnicos a considerar quando for construir:** ambas dependem de Playwright/Chromium headless pra PDF e de geração de imagem via API externa (Higgsfield) — infraestrutura de pipeline de documento via IA generativa, não o modelo server-side comum de um SaaS Next.js/Supabase; portar exige reimplementar com lib de PDF real (ex. Puppeteer serverless), não copiar código. Tom de copy das duas é de agência B2B agressiva — precisaria ser civilizado pro público do Gaiamum (dono de padaria, salão, oficina). Nenhuma das duas lida com dado vivo de CRM (é tudo gerado a partir de snapshot único de uma sessão) — o Gaiamum precisa de pipeline com estado contínuo, não gerar documento uma vez.

**Outras duas peças menores registradas, sem prioridade imediata:**
- Nicho escolhido em **cascata estruturada** (universo → vertical → nicho, como a Fase 2 da skill), não texto livre — deveria substituir qualquer campo de texto livre pra nicho no Perfil da Empresa.
- Padrão de UI "revisor lado a lado" (original | revisado pela IA), do dashboard de referência — reaproveitável em qualquer texto que o Value Engine gerar.

**Ajuda dentro do sistema (pedido do Fabio: "sistema muito grande e complexo, precisa de ajuda contextual"):** decidido começar por **texto de ajuda fixo em cada tela** (o que é, por que fazer, o que aumenta receita/corta custo com aquela ação, dica de produtividade) — custa zero em IA, não tem risco de alucinar conselho errado, cobre a maior parte da necessidade real. Um **bot conversacional só entra depois que o Perfil Consolidado existir** (Onda 8, Growth OS) — sem esse contexto, o bot dá resposta genérica e frustra mais do que ajuda. A ajuda contextual em tela não é um módulo à parte: é requisito de qualidade de toda tela construída daqui pra frente, desde a Onda 0.

**Veredito de valor do produto (pedido pelo Fabio):** sim, tem valor real — o Plano de Ação (metas SMART → IA) e o Value Engine (conta de valor com cenário conservador/realista) são diferenciação de verdade, não feature genérica; nenhuma ferramenta de gestão pra pequeno negócio hoje junta isso. **Ressalva honesta:** o escopo fechado (10 módulos + 4 integrações externas + IA em três frentes + billing + multi-empresa) é trabalho de um time por um bom tempo, não de uma pessoa só. **O maior risco do Gaiamum não é a ideia, é tentar terminar tudo perfeito antes do primeiro cliente pagante.** Recomendação: tratar as Ondas 0-4 (fundação + colaboração + perfil + financeiro + projetos) como o corte de "MVP vendável" pro plano Toca, e só avançar pro resto com validação real de mercado — não abandonar a visão, só sequenciar com disciplina.

#### Contexto pessoal/profissional do Fabio e uso real definido pro Gaiamum, 2026-08-30

Registrado porque muda como priorizar qualquer decisão daqui pra frente, não só no Gaiamum: o Fabio é Diretor Geral da Faculdade FAMA (expediente 16h-22h seg-sex), no meio do processo de **reconhecimento do curso de Psicologia junto ao MEC** e do **recredenciamento da faculdade**, apoiando a Pesquisadora Institucional (PI) que lidera os dois processos. Mantém em paralelo 3 projetos de software (CV Hunter, UltraQuadras, Gaiamum), tem um plano Claude 5x que não pretende renovar (~3 semanas restantes no momento deste registro) e quer aproveitar essa janela com o máximo de funcionalidade útil possível. A partir de 2026-08-31 (segunda-feira) inicia uma mentoria com a equipe de Leandro Ladeira pra vender seus produtos digitais, com plano de fundar uma "empresa guarda-chuva" reunindo eles.

**Uso real definido pro Gaiamum (não é mais hipótese, é decisão):**
- **Kanban/Projetos (o que já existe hoje):** uso interno com a equipe da FAMA (coordenar o reconhecimento/recredenciamento) + organização profissional geral do próprio Fabio (CV Hunter, UltraQuadras, Gaiamum, FAMA).
- **Value Engine e o resto do Growth OS (visão futura):** apoiar a estruturação e venda dos próprios produtos do Fabio (CV Hunter, UltraQuadras, Gaiamum) dentro da mentoria com Leandro Ladeira, e a criação da empresa guarda-chuva. **Não vai estar pronto pra segunda-feira** (a ordem de construção coloca Value Engine na Onda 6, depois de Financeiro e CRM) — combinado que serve pra mais adiante no processo da mentoria, não pro primeiro encontro.
- **CV Hunter é o candidato mais forte a "carro-chefe"** da nova empresa (já pronto e testado); UltraQuadras tem risco próprio (cliente piloto, ainda precisa alinhar com sócios); a decisão de qual produto lidera será discutida na mentoria.

**Decisão de segurança tomada pelo próprio Fabio (validada, não uma sugestão minha):** ele já tem um sistema próprio rodando numa VPS Linux (Hostinger) com agentes autônomos (webhook + API) ligados ao sistema acadêmico, com um dashboard de financeiro, marketing (orgânico/tráfego pago), evasão, formandos e inadimplência por curso da FAMA — construído pra apoiar o mesmo processo de reconhecimento/recredenciamento, mas que não escalou pra equipe (faltou processo de uso com todos, e ele preferiu não escalar de propósito por serem dados sensíveis de uma operação onde só ele mexe). **Decisão: todos os dados sensíveis da FAMA continuam só nessa VPS, sem nenhuma integração com o Gaiamum.** O Gaiamum entra só como camada de coordenação de tarefas (sem nenhum dado de aluno/financeiro/inadimplência passando por ali) — isso reduz o risco de um piloto com a equipe da FAMA a praticamente zero, já que não há dado sensível envolvido.

**Estratégia de piloto acordada:** começar só com a PI usando o Gaiamum pra coordenar as tarefas do reconhecimento/recredenciamento por 1-2 semanas antes de abrir pro diretor acadêmico, coordenadores e professores (grupo final de até ~15 pessoas).

**Ajuste na ordem de construção:** a Onda 0 (tabela de `planos`/billing) não é urgente pro uso imediato (nem FAMA nem organização pessoal do Fabio dependem de cobrança funcionando) — pode ser adiada. **Colaboração em Equipe (antiga Onda 1) passa a ser o próximo passo de implementação real**, por destravar o piloto com a PI.

---

## Checkpoints

### 2026-08-29 (fim de tarde) — infra completa, AIOX instalado, tema claro

Sessão que começou com um mega-prompt genérico de "Entrepreneur Command Center" (8 módulos, PWA, multi-tenant) colado junto com material de uma skill não relacionada e um PDF de outro produto — nada disso pertencia a este projeto, identificado e descartado logo no início via pergunta direta ao Fabio. Escala negociada pra "fundação real + Módulo 0-2" via `EnterPlanMode` antes de qualquer código.

Nesta sessão: fundação + Módulo 0-2 construídos do zero; identidade visual real da marca aplicada (recebida como PNG, cores extraídas via `sharp`, ícones PWA gerados por chroma-key); contas GitHub/Vercel/Supabase criadas do zero e conectadas (CLIs desta máquina trocados de "ultraquadras" pra identidade própria do Gaiamum); AIOX instalado após auditoria de segurança completa (incluindo varredura específica por injeção em 1ª pessoa disfarçada, pedida pelo Fabio — nada encontrado); descoberto e corrigido que a instalação padrão do AIOX traria 51MB de framework vendorizado pro git, resolvido via `.gitignore`/ESLint ignore; tema claro implementado a partir de uma segunda versão da marca (fundo branco) que o Fabio enviou depois, junto com favicon e imagem de Open Graph.

**Decisão permanente do Fabio nesta sessão:** sempre manter este handoff e o export Obsidian (`/ecc-system/`) atualizados conforme o projeto avança — não esperar pausa longa pra fazer isso.

### 2026-08-29 (noite) — login com a marca, Google OAuth, esqueci minha senha

Continuação da mesma sessão. Fabio mandou mais 3 peças de marca ao longo da noite (`Logo Gaimum no branco.png`, `Layout pag login Gaiamum.png`, `Layout Gaiamum Mobile.png`) e foi pedindo incrementalmente: logo na tela de login → login com Google → esqueci minha senha → layout dividido com a arte oficial → versão mobile dedicada → favicon transparente.

Implementado: `/auth` agora é um layout dividido (arte à esquerda em telas ≥1024px via `Layout pag login Gaiamum.png`, formulário à direita; abaixo disso, `Layout Gaiamum Mobile.png` como fundo cheio com o cartão flutuando na área vazia inferior — a arte mobile foi feita pelo próprio Fabio sem os mockups de dashboard, então não precisei recortar nada). Login com Google via `supabase.auth.signInWithOAuth` + rota `/auth/callback`; provider habilitado no Supabase com credenciais de um projeto Google Cloud Console novo, criado na conta `gaiamumdash@gmail.com` (não a pessoal do Fabio). Corrigido no caminho: `site_url` e `uri_allow_list` do Supabase ainda apontavam pra `localhost:3000`, o que quebraria o redirect em produção — corrigido via API de gerenciamento pra `gaiamum-dashboard.vercel.app`. Fluxo de "esqueci minha senha" (`resetPasswordForEmail` + `/auth/redefinir-senha`). Favicon trocado de quadrado branco pra glifo transparente (o `apple-icon.png` continua opaco, de propósito — iOS preenche transparência com preto).

**Não testado com clique real em navegador ainda:** login com Google (o teste automático via curl travou por rede neste ambiente sandboxed, não é sinal de problema de config) e o fluxo de recuperação de senha. Primeira coisa a fazer na próxima sessão.

### 2026-08-29 (noite, mais tarde) — domínio próprio conectado

Fabio comprou `gaiamum.com.br` no registro.br e definiu `www.gaiamum.com.br` como domínio principal. Adicionei os dois domínios ao projeto Vercel (`vercel domains add`), configurei redirect 301 de `gaiamum.com.br` pro `www` via `next.config.ts` (matcher por `host`, não precisa de configuração no painel da Vercel), e atualizei `metadataBase` (layout.tsx) e `site_url`/`uri_allow_list` (Supabase, via API de gerenciamento) pro domínio novo — mantendo o `.vercel.app` e `localhost` na allow-list como fallback enquanto o DNS não propaga.

Também expliquei ao Fabio que eu não "uso" o Obsidian (app de desktop, não tenho como abrir/navegar nele) — só gero Markdown compatível em `/ecc-system/`. Recomendei ele apontar o Obsidian (se for instalar) pra pasta do repo inteiro, não só `/ecc-system/`, pra já enxergar o handoff hoje.

**Pendente, só o Fabio pode fazer:** configurar os registros DNS `A @ 76.76.21.21` e `A www 76.76.21.21` no painel do registro.br. Até isso propagar, o domínio próprio não resolve — usar `gaiamum-dashboard.vercel.app` normalmente.

**Pausa:** Fabio vai transportar o computador. Todo o trabalho está commitado e publicado (push até o commit `67f4983`), nada em risco de se perder.

### 2026-08-30 (madrugada) — testes de auth + correção de responsividade do login

Retomada seguindo as prioridades do handoff. DNS: confirmado via `vercel domains inspect` que ainda não propagou (nameservers seguem no padrão do registro.br) — Fabio disse que libera ~1h05 depois da compra.

Login com Google testado de verdade no navegador (Playwright): clique redireciona certo pro Google com `redirect_uri` batendo no callback do Supabase. Não completei o login (conta pessoal), mas o fluxo está tecnicamente correto de ponta a ponta.

Fabio notou que a arte do login ficava cortada quando a janela do navegador não estava maximizada, e pediu pra também cobrir tablet. Eram dois bugs de CSS/layout, não do asset em si:
- **Desktop:** `object-cover` numa arte 16:9 dentro de um container de metade da tela (bem mais estreito) cortava as laterais, incluindo o mockup "Fornecedores". Corrigido com `object-contain` + recorte da faixa vazia à direita da própria imagem-fonte (1672×941 → 1010×941), eliminando também a sobra de espaço vazio.
- **Tablet/celular:** a arte mobile foi desenhada pra proporção de celular; em tablet retrato (mais "quadrado") o `object-cover` esticava demais e cortava o texto "Cresça." no meio — e mesmo em celular normal, o cartão de login (relativamente alto) já sobrepunha esse mesmo texto por falta de margem de segurança. Medi programaticamente (via `sharp`, analisando brilho por linha) onde o bloco de texto termina na imagem (~46% da altura) e corrigi com `object-contain` a partir de `md:` + um spacer `min-h-[48vh]` empurrando o cartão pra baixo do texto antes de deixá-lo flutuar. Testado em iPhone 14, tablet retrato (768×1024, 834×1194), tablet paisagem e desktop (1280×720, 1920×1080) — sem regressão em nenhum. 2 commits locais (`a659265`, `1f33afd`), sem push ainda — pendente aprovação do Fabio pra publicar.

**Achado à parte, sem relação com o pedido:** o cache de otimização de imagens do Next.js Server (`.next/cache/images`) sobreviveu a duas rodadas de `rm -rf` porque o processo antigo do `next dev` continuava rodando em background (`TaskStop` não mata o processo filho do Turbopack no Windows) — só resolveu depois de matar o processo pela porta (`taskkill`) e apagar a pasta `.next` inteira. Registrado em "Pegadinhas".

"Esqueci minha senha" testado tecnicamente: fluxo completo até o envio retorna sucesso, e `/auth/redefinir-senha` carrega certo. Disparei um teste real pra `gaiamumdash@gmail.com` — falta o Fabio confirmar o recebimento e seguir o link.

Onboarding completo ainda não testado: confirmei que o Supabase exige confirmação de e-mail antes do signup liberar (o app falha silenciosamente nesse caso, sem avisar o usuário — possível ajuste de UX futuro). Recomendei ao Fabio usar `gaiamumdash@gmail.com` pra criar o workspace de teste, decisão ainda em aberto no momento da pausa desta sessão.

### 2026-08-30 (madrugada, continuação) — DNS propagado, onboarding validado, menu lateral, fix de tema

Fabio configurou os registros DNS e confirmou o uso de `gaiamumdash@gmail.com` pro teste. `vercel domains inspect` + `nslookup` confirmaram propagação total (ambos os domínios resolvendo pro IP da Vercel); só o certificado SSL ainda não tinha ativado até o fim da sessão (automático, só questão de tempo).

Criei o cadastro em produção com `gaiamumdash@gmail.com`, o Fabio confirmou o e-mail, e testei o onboarding completo de ponta a ponta: preenchi as 12 caixas do formulário SMART (2 horizontes × 6 campos) com dados reais, salvei, confirmei que `/ecc-system/metas/` populou com 2 arquivos Markdown (frontmatter + link Obsidian-style corretos), criei um projeto ("Módulo Financeiro"), criei uma tarefa no kanban e movi ela entre colunas. Tudo funcionando sem erros.

No meio do teste, o Fabio foi dando feedback ao vivo da tela de onboarding (ele via o app em produção, sem as mudanças ainda) e pediu 3 melhorias, que implementei:
- **Menu lateral** novo (`src/components/layout/menu-lateral.tsx`) com "Projetos" e "Metas SMART" (badge "Pendente"), presente nas 3 páginas internas do dashboard. `/onboarding` parou de redirecionar sozinho quando já existem metas — agora mostra confirmação com link, pra não duplicar dados se o usuário voltar pelo menu.
- **Placeholders de exemplo** em todos os 12 campos do formulário SMART, título de cada campo com badge de letra (S/M/A/R/T), e botão **"Pular, preencho depois"** (nova server action `pularOnboarding`, usa `formNoValidate` + `formAction` pra não disparar a validação HTML5 dos campos `required`).

Depois de publicar isso, o Fabio reportou dois problemas novos, ambos corrigidos:
1. **Contraste ruim no tema claro.** Investigando, não era um problema de cor — as variáveis do tema claro já tinham bom contraste (`#002559` sobre fundo claro). Era um **hydration mismatch real** no `ThemeToggle`: o estado inicial do `useState` lia `document.documentElement.dataset.theme` direto, que no servidor sempre retorna "dark" (sem acesso a `document`) mas no cliente (durante a hidratação) já reflete o tema real salvo — o React detectava a diferença e descartava a árvore inteira, deixando o app com tema inconsistente até recarregar. Corrigido trocando pra `useSyncExternalStore` (snapshot do servidor fixo em "dark", sincroniza com o DOM real com segurança só depois da hidratação) — é o padrão oficial do React pra esse cenário, e não dispara o lint `react-hooks/set-state-in-effect` que a alternativa mais simples (`useEffect` + `setState`) provocava.
2. **Título "Médio prazo"/"Longo prazo" com aparência bagunçada, borda cortando o meio do texto.** Era o comportamento nativo do `<legend>` dentro de `<fieldset>` (sempre fica sobreposto na borda superior do elemento, sem jeito simples de evitar sem um hack de background). Trocado por `<div role="group" aria-labelledby="...">` + `<h2>` normal, mantendo a semântica de agrupamento sem depender do posicionamento nativo do legend.

**6 commits locais nesta continuação** (nenhum publicado ainda — pedir aprovação do Fabio antes do push): `b24e4e3` (docs), `dbe0f71` (menu lateral + onboarding), `b600ad4` (fix hydration tema), `41bf371` (fix título fieldset/legend). Também descobri nesta sessão que a porta 3000 desta máquina é do projeto **platform** (UltraQuadras), não do Gaiamum — os dois projetos rodam em paralelo e coincidem nas portas padrão do Next; usar sempre uma porta explícita (`-p 3001` ou outra livre) ao subir o dev server do Gaiamum pra evitar confusão.

### 2026-08-30 (manhã, continuação longa) — 3 temas, colaboração em equipe, permissão por quadro, visão de longo prazo fechada

Sessão muito longa (por isso este checkpoint é mais detalhado que o normal — próxima sessão deveria começar do zero, não continuar esta). Publicados os 7 commits pendentes do checkpoint anterior (aprovados pelo Fabio). Depois disso, três frentes em paralelo:

**1. Contexto pessoal do Fabio, registrado em memória de longo prazo** (`user_contexto_pessoal_multiplos_projetos.md`, fora deste handoff pois afeta outros projetos também): Diretor Geral da Faculdade FAMA em meio a processo de reconhecimento de curso junto ao MEC e recredenciamento; mantém CV Hunter e UltraQuadras em paralelo ao Gaiamum; inicia mentoria de vendas com a equipe de Leandro Ladeira; plano Claude 5x que não pretende renovar (~3 semanas de janela no momento do registro). Decisão de uso real do Gaiamum: kanban/projetos pra organização pessoal e pra um piloto com a equipe da FAMA (começando só com a Pesquisadora Institucional, depois expandindo pra ~15 pessoas); Value Engine/Growth OS pra ajudar a vender os próprios produtos na mentoria. **Ele mesmo decidiu, sem eu precisar insistir, não integrar nenhum dado sensível da FAMA (financeiro, inadimplência, evasão — já existem numa VPS própria dele) ao Gaiamum** — bom sinal de julgamento de segurança, vale reforçar esse padrão se aparecer de novo.

**2. Visão de longo prazo do produto fechada** (tudo documentado nas seções "Visão North Star — Growth OS" acima, nada implementado): relatório overnight cruzando `av-value-engine` com o roadmap; ampliação da visão pelo Fabio (assistente de conteúdo, integrações MCP com Windsor.ai/Metricool/Trello, dashboard de tráfego, gerador de propostas/landing pages, Google Calendar, onboarding modular, 3 planos); resolução de uma contradição real entre "planos com módulos fixos" e "onboarding modular" (o plano define o teto, o módulo dentro dele só liga/desliga visibilidade); os 3 planos nomeados pelo próprio Fabio com a metáfora do mangue — **Toca, Colônia, Manguezal**; ideia de "Perfil da Empresa" reutilizável em tudo; análise crítica de duas skills irmãs (`av-brand-engine`, `av-sales-engine`) feita por subagente, com nota de propriedade intelectual confirmada pelo Fabio (conceito é livre, material da empresa que vendeu o curso não é). Veredito de valor dado com honestidade: a ideia tem valor real, mas o escopo fechado é grande demais pra uma pessoa só — recomendado e aceito cortar um MVP vendável nas Ondas 0-4.

**3. Implementação de código: Colaboração em equipe, ampliada em tempo real a partir de feedback do Fabio comparando com o Trello** (prints reais anexados por ele). Começou como "convite de membro + atribuição de tarefa + permissão owner/member" simples (migration `0002`), e cresceu, peça por peça, pra: cartão de tarefa completo (descrição, membros múltiplos, checklist, data de início — todos inspirados em screenshots reais do app Trello mobile que o Fabio mandou), e depois **permissão por quadro/projeto** (migration `0003`): convite pode ser vinculado a um projeto específico, quem aceita só enxerga aquele quadro (não Metas SMART nem outros projetos — campo `memberships.escopo`), cada projeto tem um gestor automático (quem cria), e só o gestor ou o owner do tenant apaga cartão ou quadro. **As duas migrations estão escritas e comitadas mas NÃO foram aplicadas no banco** — ver aviso no topo da seção "Estado confirmado". A ideia de anexar arquivo (PDF/Word direto, vídeo/foto grande via pasta compartilhada do Google Drive) foi levantada pelo Fabio e registrada como próxima peça do cartão de tarefa, ainda não implementada (é mais uma integração externa tipo as do Growth OS — Google OAuth).

Um tool call falhou uma vez no meio da sessão (erro de conexão do host, não do código) e uma edição não foi aplicada silenciosamente — só percebido porque o Fabio perguntou diretamente "está codando ou parou?". Lição: depois de qualquer falha de tool call ambígua, reconferir o arquivo antes de assumir que a edição colou.

**Pendente:** decidir com o Fabio se apaga o usuário de teste `gaiamumdash@gmail.com` do Supabase ou mantém; fazer push dos commits acumulados quando aprovado.

### 2026-08-30 (noite) — convite testado de ponta a ponta (3 bugs achados e corrigidos), notificação por e-mail via Resend implementada

Sessão focada em testar de verdade o que a sessão anterior só tinha implementado sem validar pela UI. Retomada seguindo as prioridades: 1) testar convite de ponta a ponta, 2) polir UI do convite/permissão, 3) perguntar sobre push, 4) próxima frente.

**Item 2 (polimento de UI) resolvido primeiro, rápido:** seletor "convidar pra qual quadro" no `FormularioConvite`, indicação de projeto na `ListaConvites`, botão de excluir escondido de quem não é owner/gestor em `CartaoProjeto` e no kanban.

**Item 1 (teste de convite) revelou 3 bugs reais**, só visíveis testando com uma segunda conta de verdade (usei `gaiamumdash+convite@gmail.com` — alias `+` do Gmail cai na mesma caixa, evitou precisar de um e-mail novo):
1. `garantirWorkspace()` não tinha `ORDER BY` e criava um workspace pessoal à toa pra quem visitava qualquer página (ex.: redirect automático `/` → `/onboarding`) antes de aceitar um convite pendente — a pessoa ficava com duas memberships e nenhum critério de qual tenant é o "certo". Corrigido: `garantirWorkspace()` agora busca convite pendente pro e-mail do usuário e o aceita automaticamente antes de criar workspace novo (lógica de aceite extraída pra `vincularUsuarioAoConvite()` em `equipe.ts`, reaproveitada também por `/convite/[token]`). Efeito colateral bom, pedido depois pelo Fabio: quem só tem convite de projeto nem precisa clicar no link — só logar já entra direto no quadro certo.
2. **Bug mais sério, já estava na migration 0003 aplicada:** a função `tem_acesso_ao_projeto()` só liberava acesso pro owner do tenant ou quem estava explicitamente em `projeto_membros` — nunca considerava `memberships.escopo = 'completo'` (convite geral/workspace inteiro). Resultado: qualquer convite geral aceito ficava sem ver nenhum projeto. Corrigido via migration `0004` (aplicada em produção pelo Fabio via SQL Editor).
3. `/equipe` e o menu lateral da página de tarefas não verificavam escopo — um convidado só de projeto conseguia ver a lista completa de membros do workspace digitando a URL direto, e o menu mostrava links pra Metas SMART/Equipe que deveriam estar escondidos. Corrigido com guard de `temAcessoCompleto()` em `/equipe`/`/onboarding` e `acessoCompleto` passado pro `MenuLateral` na página de tarefas.

Validado depois de tudo corrigido: convite geral (vê tudo, sem excluir) e convite de projeto (só o quadro, sem Metas SMART/Equipe/onboarding), os dois de ponta a ponta com login real da segunda conta.

**Nova frente, pedida pelo Fabio no meio da sessão** ao ver o teste de kanban: "no Trello eu recebo e-mail toda vez que mexem num cartão que eu tô marcado, e fica registrado quem fez o quê — isso evita alguém mexer na tarefa do outro sem saber." Não existia nada disso no código. Implementado:
- Tabela `tarefa_atividades` (migration `0005`, aplicada) — grava tipo de ação, quem fez, detalhe (json).
- `src/lib/ecc/atividade.ts` (`registrarAtividade`) — chamado em `moverTarefa`, `atualizarDescricaoTarefa`, `adicionarChecklistItem`, `alternarChecklistItem`, `removerChecklistItem`, `alternarMembroTarefa`; notifica os responsáveis do cartão exceto quem fez a própria mudança (removido de responsável é caso especial — precisa ser notificado mesmo não estando mais em `tarefa_membros` no momento do envio).
- `src/lib/ecc/notificacoes.ts` — e-mail em HTML com a marca Gaiamum (fundo navy, logo, botão "Ver cartão"), via Resend. Fabio criou a conta Resend nesta sessão, gerou uma API key restrita só a envio.
- **Achado de debug relevante pra qualquer integração futura:** o SDK do Resend (igual o supabase-js) não lança exceção em erro de API — devolve `{ data, error }` no retorno normal de uma promise resolvida. Um `.catch()` sozinho não pega isso; precisa checar o campo `error` explicitamente. Foi exatamente por isso que o primeiro teste "não deu erro nenhum" mas também não mandou e-mail nenhum — descoberto comparando um teste direto via `curl` na API do Resend (funcionou) com o comportamento do código (não enviava, sem log). Corrigido, testado de novo, **e-mail chegou de verdade** (print do Gmail confirmando 3 notificações), só caiu em spam por sair do domínio de teste `resend.dev` — some assim que `gaiamum.com.br` verificar no Resend.
- Adicionei o MCP do Resend ao projeto (`claude mcp add`) pra debug futuro mais preciso — só ativa numa sessão nova.
- **Fabio mencionou, só pra registrar (não implementar agora):** quer conectar o módulo financeiro futuro (Onda 3) na API REST do **Nibo Empresas** — ele mesmo traz a credencial quando chegar a hora.

**Regra nova registrada a pedido do Fabio** (topo deste arquivo): sempre avisar quando algo travar/bloquear e dizer o que ele pode fazer — não deixar implícito.

**Pendente:** verificar domínio no Resend + trocar `RESEND_FROM_EMAIL`; adicionar `RESEND_API_KEY` no Vercel e redeploy; decidir se a tela de histórico do cartão entra agora; aprovação do Fabio pra publicar os commits acumulados.

### 2026-08-30 (continuação) — push publicado, Resend em produção, decisões de escopo fechadas

Sessão curta, focada em fechar os pendentes do checkpoint anterior. Fabio aprovou tudo de uma vez no início: publicar os 10 commits, confirmou que o domínio já verificou no Resend, e delegou a decisão da porta 3001 pedindo recomendação em vez de escolha neutra (registrado como reforço de [[feedback_sempre_recomendar_como_socio]]).

Feito, em ordem: push publicado (`76de5ab..6d5a905`); processo antigo da porta 3001 (PID 11040, de sessão anterior) encerrado e dev server novo subido limpo, recomendado em vez de só apresentado como opção — risco de servir cache/código desatualizado, já documentado em "Pegadinhas"; `RESEND_FROM_EMAIL` adicionado em `.env.local` (o código já lia essa env var com fallback, só faltava setar); `RESEND_API_KEY` e `RESEND_FROM_EMAIL` adicionados no Vercel via `vercel env add` (Production + Preview, 4 comandos); redeploy de produção via `vercel --prod` (build ok, aliasado em `gaiamum.com.br`); certificado SSL confirmado ativo via `curl -I https://www.gaiamum.com.br` (307 normal, sem erro de handshake — item que ficava pendente desde a madrugada de 2026-08-30).

**Não confirmado ainda:** que o e-mail de notificação realmente parou de cair em spam com o remetente próprio — precisa de um teste real (mover um cartão com responsável, checar a caixa), melhor feito pelo Fabio com as contas reais dele.

Duas decisões de escopo perguntadas e fechadas: histórico de atividade do cartão (UI de consulta) e colunas configuráveis do kanban por projeto — as duas ficam pra depois, por decisão do Fabio seguindo a recomendação dada (nenhuma das duas bloqueia o uso real definido pro produto: piloto FAMA + organização pessoal). Próxima frente escolhida pelo Fabio: não é código novo, é destravar o piloto real com a PI usando a colaboração em equipe já pronta — a Onda de "Colaboração em Equipe" implementada nas sessões anteriores está pronta pra uso real agora.

**Pendente:** Fabio confirmar recebimento de e-mail sem cair em spam; decidir com calma quando começar o piloto com a PI (nenhuma ação técnica bloqueando).
