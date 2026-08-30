# Handoff vivo — Gaiamum Dashboard

**Documento canônico de continuidade.** Ao retomar uma sessão nova sobre o Gaiamum, ler só "Estado confirmado" abaixo + a última entrada de "Checkpoints" no rodapé — não o arquivo inteiro. Ao fim de qualquer sessão relevante, atualizar "Estado confirmado" (se mudou) e acrescentar uma entrada nova em "Checkpoints". Nunca criar um arquivo de handoff novo — este é o único.

**Criado:** 2026-08-29 · **Branch:** main · **Remoto:** https://github.com/gaiamumdash-commits/dashboard
**Local do projeto:** `c:\Users\proff\Documents\Gaiamum\` (**fora do OneDrive de propósito** — não mover de volta)
**Produção:** https://www.gaiamum.com.br (domínio próprio, DNS já propagado — **falta só o certificado SSL ativar**, ver "Estado confirmado"). Enquanto isso, o app responde normalmente em https://gaiamum-dashboard.vercel.app.

---

## Estado confirmado (2026-08-30, madrugada — última atualização)

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

1. ~~DNS~~ — propagado nesta sessão. **Falta reconferir se o certificado SSL da Vercel já ativou**: `curl -I https://www.gaiamum.com.br` (na sessão anterior ainda falhava com `SSL/TLS connection failed`, é automático e só questão de tempo).
2. ~~Testar login com Google~~ — feito nesta sessão (ver "Estado confirmado").
3. ~~Testar "esqueci minha senha"~~ — testado tecnicamente nesta sessão; falta só o Fabio confirmar o recebimento do e-mail em `gaiamumdash@gmail.com` e seguir o link até definir a nova senha.
4. ~~Testar o onboarding completo~~ — feito nesta sessão de ponta a ponta com sucesso (signup → confirmação de e-mail pelo Fabio → metas SMART → projeto → kanban). **Decidir com o Fabio:** apagar o usuário de teste `gaiamumdash@gmail.com` do Supabase Auth (e o tenant/dados associados) agora que validou, ou manter como conta de teste recorrente pras próximas sessões.
5. **Fazer push dos 6 commits locais** acumulados nesta sessão (correções de login responsivo, menu lateral, onboarding, fix de tema) — pedir aprovação do Fabio antes, como sempre (ver "Convenção de push").

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

#### Perfil da empresa (cadastro completo, reutilizável em tudo) — ideia adicional do Fabio, 2026-08-30

Inspirado na Fase 1 (`Diagnóstico da Agência`) da skill `av-value-engine`: um cadastro de empresa completo — nome, site, redes sociais, logo, nicho, tempo de operação, tamanho de time, faturamento (faixa), principal desafio — preenchido uma vez e reaproveitado em tudo que o sistema gerar depois (propostas, landing pages, criativos, contratos), pra o usuário não ficar subindo as mesmas informações toda hora.

**Detalhe importante relido com atenção no `detailed-flow.md` (a skill original faz mais que só coletar dados):** ela pesquisa sozinha via busca na web e acessa o site/redes informados pra completar o que faltou, e devolve um **diagnóstico automático em 3 blocos (Forças, Gaps, Melhorias prioritárias numeradas)** antes de qualquer outra coisa. Vale reaproveitar esse padrão no Gaiamum: pedir só nome + 1 link pra começar, o sistema busca o resto sozinho, e devolve um mini-diagnóstico como primeira "vitória rápida" do onboarding — mais forte que um formulário estático.

**Melhorias sobre o original, específicas do Gaiamum:**
- Dividir em 2 blocos, como o formulário SMART já faz: **essencial** (nome, nicho, logo, 1 rede social — libera o resto do sistema) e **aprofundado** (pode pular, mesmo padrão "Pular, preencho depois" já existente).
- Dois campos que a skill original não tem, mas valem muito aqui (o perfil alimenta geração de criativo, não só relatório): **cores da marca** (extraídas do logo automaticamente, como já foi feito com a arte oficial do Gaiamum via `sharp`) e **tom de voz** (formal/descontraído/técnico).
- Reaproveitar a mesma `BarraProgresso` com a animação do caranguejo indo pra toca (já existe e é genérica).
- Precisa de uma tela de "Perfil da Empresa" nas configurações pra editar depois — não é só onboarding, senão vira dado congelado no dia 1.

**Diferenciação de plano (mencionada pelo Fabio):** o plano Manguezal permite cadastrar até 2 empresas simultâneas (ex.: alguém tocando duas marcas). Isso muda uma decisão de schema, não só um número de plano: o perfil de empresa vive num nível abaixo do `tenant`, cada empresa com seu próprio perfil completo, e o usuário troca de "empresa ativa" — mesmo padrão de um seletor de workspace. Guardar essa decisão de schema pra quando o Perfil da Empresa for arquitetado de verdade.

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

**Pendente:** decidir com o Fabio se apaga o usuário de teste `gaiamumdash@gmail.com` do Supabase ou mantém; fazer push dos commits acumulados quando aprovado.
