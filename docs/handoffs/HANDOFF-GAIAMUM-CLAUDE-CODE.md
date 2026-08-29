# Handoff vivo — Gaiamum Dashboard

**Documento canônico de continuidade.** Ao retomar uma sessão nova sobre o Gaiamum, ler só "Estado confirmado" abaixo + a última entrada de "Checkpoints" no rodapé — não o arquivo inteiro. Ao fim de qualquer sessão relevante, atualizar "Estado confirmado" (se mudou) e acrescentar uma entrada nova em "Checkpoints". Nunca criar um arquivo de handoff novo — este é o único.

**Criado:** 2026-08-29 · **Branch:** main · **Remoto:** https://github.com/gaiamumdash-commits/dashboard
**Local do projeto:** `c:\Users\proff\Documents\Gaiamum\` (**fora do OneDrive de propósito** — não mover de volta)
**Produção:** https://gaiamum-dashboard.vercel.app

---

## Estado confirmado (2026-08-29, fim de tarde)

- **Fundação + Módulo 0-2** implementados: onboarding SMART, projetos (CRUD), kanban de tarefas (com tags pessoal/ifaz/faculdade/vendas). Detalhes de arquitetura na seção "Fundação técnica" abaixo.
- **Infraestrutura 100% pronta e no ar**, independente do UltraQuadras:
  - **GitHub:** conta `gaiamumdash-commits`, repo `gaiamumdash-commits/dashboard`, branch `main`.
  - **Vercel:** time `gaiamum-dash`, projeto `gaiamum-dashboard`, conectado ao GitHub (deploy automático a cada push), env vars do Supabase em Production + Preview.
  - **Supabase:** projeto `gaiamum-dashboard` (ref `zfjtcivusdmjvdbycpjs`, São Paulo), migration `0001_schema_inicial.sql` aplicada — tabelas `tenants`, `memberships`, `metas_smart`, `projetos`, `tarefas` confirmadas.
  - **`gh` e `vercel` CLI desta máquina** foram trocados da conta "ultraquadras" pra `gaiamumdash-commits`/`gaiamum-dash` — ficam assim permanentemente pra este projeto.
- **AIOX instalado** localmente no projeto (framework de agentes/governança, auditado sem achados de segurança). Ver "Convenção de push" abaixo — muda como publicar no repo.
- **Identidade visual completa:** tema escuro (padrão) + tema claro (alternável, botão fixo no canto), favicon, apple-touch-icon e imagem de Open Graph, todos com a paleta oficial da marca.
- **Módulos 3-7** (financeiro, CRM, vendas, relatórios/IA, painel owner, pagamentos) — nenhum iniciado.

### Convenção de push (importante, mudou nesta sessão)

O AIOX ativou um hook (`enforce-git-push-authority.cjs`) que bloqueia `git push`/`gh pr create`/`gh pr merge` por padrão. Pra publicar, prefixar SÓ o comando de push (nunca fixar a variável pra sessão inteira):

```bash
AIOX_ACTIVE_AGENT=devops git push
```

Continua valendo sempre pedir confirmação ao Fabio antes de qualquer push — isso não mudou. Ver [[feedback_gaiamum_aiox_push_devops]].

### Onde encontrar as coisas

- **Marca/logo fonte:** `C:\Users\proff\Downloads\Gaiamum marca\` (`Gaiamum dashboard.png` = versão escura, `Logo Gaimum no branco.png` = versão clara).
- **Paleta:** navy `#011f51` (bg escuro), `#0069fd` (primário), `#0141bc` (hover), `#00cbee` (acento ciano), `#f5e9dc` (texto/creme no escuro), `#002559` (texto no tema claro).
- **Export Obsidian:** `/ecc-system/metas/` dentro do repo — Markdown com frontmatter gerado a cada meta SMART salva. Não substitui o Supabase (fonte de verdade), é só destino de leitura no Obsidian.
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

- Módulos 3-7 (financeiro, CRM, value engine/vendas, relatórios/IA, painel owner + Resend, pagamentos, criptografia) — nenhum iniciado. Ver [[projeto_gaiamum_referencia_dashboard_sow]] pra padrões de UX reaproveitáveis.
- Avaliar se vale evoluir o Módulo 1/2 pra amarrar tarefa↔produto vendido (padrão visto na referência SOW).
- Registrar/confirmar o domínio `www.gaiamum.com.br` e conectar como domínio custom na Vercel quando pronto (hoje o app só responde em `gaiamum-dashboard.vercel.app` — `metadataBase` em `layout.tsx` vai precisar ser atualizado quando isso acontecer).

---

## Checkpoints

### 2026-08-29 (fim de tarde) — infra completa, AIOX instalado, tema claro

Sessão que começou com um mega-prompt genérico de "Entrepreneur Command Center" (8 módulos, PWA, multi-tenant) colado junto com material de uma skill não relacionada e um PDF de outro produto — nada disso pertencia a este projeto, identificado e descartado logo no início via pergunta direta ao Fabio. Escala negociada pra "fundação real + Módulo 0-2" via `EnterPlanMode` antes de qualquer código.

Nesta sessão: fundação + Módulo 0-2 construídos do zero; identidade visual real da marca aplicada (recebida como PNG, cores extraídas via `sharp`, ícones PWA gerados por chroma-key); contas GitHub/Vercel/Supabase criadas do zero e conectadas (CLIs desta máquina trocados de "ultraquadras" pra identidade própria do Gaiamum); AIOX instalado após auditoria de segurança completa (incluindo varredura específica por injeção em 1ª pessoa disfarçada, pedida pelo Fabio — nada encontrado); descoberto e corrigido que a instalação padrão do AIOX traria 51MB de framework vendorizado pro git, resolvido via `.gitignore`/ESLint ignore; tema claro implementado a partir de uma segunda versão da marca (fundo branco) que o Fabio enviou depois, junto com favicon e imagem de Open Graph.

**Decisão permanente do Fabio nesta sessão:** sempre manter este handoff e o export Obsidian (`/ecc-system/`) atualizados conforme o projeto avança — não esperar pausa longa pra fazer isso.
