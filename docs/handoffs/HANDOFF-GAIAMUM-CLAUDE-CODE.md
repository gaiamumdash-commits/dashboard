# Handoff vivo — Gaiamum Dashboard

**Documento canônico de continuidade.** Ao retomar uma sessão nova sobre o Gaiamum, ler só "Estado confirmado" abaixo + a última entrada de "Checkpoints" no rodapé — não o arquivo inteiro. Ao fim de qualquer sessão relevante, atualizar "Estado confirmado" (se mudou) e acrescentar uma entrada nova em "Checkpoints". Nunca criar um arquivo de handoff novo — este é o único.

**Criado:** 2026-08-29 · **Branch:** main · **Remoto:** https://github.com/gaiamumdash-commits/dashboard
**Local do projeto:** `c:\Users\proff\Documents\Gaiamum\` (**fora do OneDrive de propósito** — não mover de volta)
**Produção:** https://www.gaiamum.com.br (domínio próprio, comprado 2026-08-29 — **DNS ainda não configurado**, ver "Estado confirmado"). Enquanto o DNS não propaga, o app continua respondendo em https://gaiamum-dashboard.vercel.app.

---

## Estado confirmado (2026-08-30, madrugada — última atualização)

- **Domínio próprio comprado:** `gaiamum.com.br` (registro.br), `www.gaiamum.com.br` é o principal. Já adicionado ao projeto Vercel (`gaiamum.com.br` e `www.gaiamum.com.br`), redirect 301 apex→www configurado em `next.config.ts`, `metadataBase` e `site_url`/`uri_allow_list` do Supabase já apontam pro domínio novo (com fallback pro `.vercel.app` e `localhost` durante a transição). **Falta o Fabio configurar os registros DNS no painel do registro.br:** `A @ 76.76.21.21` e `A www 76.76.21.21`. Confirmado via `vercel domains inspect` nesta sessão que ainda não foi feito (nameservers continuam `a/b.auto.dns.br`, os padrão do registro.br) — o Fabio disse que o registro.br libera a configuração ~1h05 depois da compra do domínio.

- **Fundação + Módulo 0-2** implementados: onboarding SMART, projetos (CRUD), kanban de tarefas (com tags pessoal/ifaz/faculdade/vendas). Detalhes de arquitetura na seção "Fundação técnica" abaixo.
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

1. **DNS ainda não propagou** — repetir `npx vercel domains inspect gaiamum.com.br --scope gaiamum-dash` (e `www.gaiamum.com.br`) depois que o Fabio configurar os registros A no registro.br (ele disse que libera ~1h05 depois da compra, feita 2026-08-29 ~21h).
2. ~~Testar login com Google~~ — feito nesta sessão (ver "Estado confirmado").
3. ~~Testar "esqueci minha senha"~~ — testado tecnicamente nesta sessão; falta só o Fabio confirmar o recebimento do e-mail em `gaiamumdash@gmail.com` e seguir o link até definir a nova senha.
4. **Testar o onboarding completo** (signup → metas SMART → projeto → kanban) — ainda pendente. Nesta sessão confirmei que o Supabase exige confirmação de e-mail antes do signup liberar (testei com um e-mail descartável e o app fica preso em `/auth` sem sinalizar isso ao usuário — vale um ajuste de UX futuro: hoje o app não avisa "confirme seu e-mail", falha silenciosamente). **Recomendação:** usar `gaiamumdash@gmail.com` pra criar o workspace de teste — é uma conta que o Fabio já controla e vai checar de qualquer forma (por causa do teste de recuperação de senha acima), e não há risco técnico em reaproveitá-la (a tabela `auth.users` do produto é independente de qualquer credencial de infra). Depois de validar o fluxo, apagar esse usuário/tenant de teste do Supabase pra não sujar produção. Alternativa mais lenta: e-mail descartável à parte, mas aí ninguém consegue confirmar o cadastro.

### Depois

- Módulos 3-7 (financeiro, CRM, value engine/vendas, relatórios/IA, painel owner + Resend, pagamentos, criptografia) — nenhum iniciado. Ver [[projeto_gaiamum_referencia_dashboard_sow]] pra padrões de UX reaproveitáveis.
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
