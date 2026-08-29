# Handoff: Fundação do Gaiamum Dashboard (Módulo 0-2 + identidade visual)

**Criado:** 2026-08-29
**Branch:** main (repo local, sem remoto ainda)
**Local do projeto:** `c:\Users\proff\Documents\Gaiamum\` (**fora do OneDrive de propósito** — não mover de volta)

---

## Resumo

Novo SaaS **Gaiamum Dashboard** (nome popular "gaiamum"), site futuro `www.gaiamum.com.br`, 100% independente do UltraQuadras (`platform`). É um "Entrepreneur Command Center": onboarding com metas SMART, multi-projetos, kanban de tarefas, e módulos futuros de financeiro/CRM/vendas/relatórios/painel owner. A fundação técnica + Módulo 0 (onboarding SMART), Módulo 1 (projetos) e Módulo 2 (kanban de tarefas) estão implementados, com a identidade visual real da marca (logo de caranguejo azul) já aplicada. Falta criar as contas de infraestrutura (GitHub, Supabase, Vercel) pra sair do "roda só local" pro "existe na internet".

---

## Trabalho concluído

- [x] Repositório Next.js 16 + React 19 + TypeScript strict criado do zero, espelhando os padrões já validados no repo irmão `platform` (padrão de 3 clientes Supabase, `proxy.ts`, Tailwind v4 CSS-first).
- [x] Schema Postgres multi-tenant (`tenants`/`memberships`/`current_tenant_ids()`) + RLS, tabelas `metas_smart`, `projetos`, `tarefas`.
- [x] Módulo 0 — Onboarding: formulário guiado de metas SMART (médio/longo prazo), grava no banco, exporta Markdown com frontmatter em `/ecc-system/metas/` (Obsidian-ready).
- [x] Módulo 1 — Projetos: CRUD completo por workspace.
- [x] Módulo 2 — Kanban de tarefas: 3 colunas, drag-and-drop nativo, prioridade P1-P4, **tags pessoal/ifaz/faculdade/vendas já implementadas** (campo `tag` em `formulario-nova-tarefa.tsx`), indicador visual de prazo (amarelo/vermelho).
- [x] Identidade visual real aplicada: paleta extraída de `C:\Users\proff\Downloads\Gaiamum marca\Gaiamum dashboard.png` (navy `#011f51`, azul `#0069fd`, azul escuro `#0141bc`, ciano `#00cbee`, creme `#f5e9dc`) em `globals.css`, `manifest.json` e `layout.tsx`.
- [x] 3 ícones PWA gerados a partir do glifo do caranguejo (`public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`), via script one-off com `sharp` (chroma-key + recomposição sobre fundo navy).
- [x] Build, typecheck e lint validados (com env vars fictícias — ver "Bloqueios" abaixo).
- [x] Projeto movido de `OneDrive\Documentos\Developer\Sniper` → `Documents\Gaiamum` (fora do OneDrive, por pedido explícito do Fabio) e renomeado de "Sniper" pra "Gaiamum" em todo o código.
- [x] Git local inicializado, identidade configurada (`Fabio Azevedo` / `gaiamumdash@gmail.com`, local a este repo), 2 commits feitos.
- [x] Estudei o PDF de referência "SOW Sales - CRM Sales" (17 telas) e registrei os padrões de UX úteis pros módulos 3-6 em memória (ver `[[projeto_gaiamum_referencia_dashboard_sow]]`) — é só inspiração de funcionalidade, não o visual (o Gaiamum não usa laranja).

### Decisões-chave

| Decisão | Motivo |
|---|---|
| Projeto 100% separado do `platform`, pasta própria, git próprio | Pedido explícito do Fabio: "projeto 100% independente de todos os outros" |
| Fora do OneDrive (`Documents\Gaiamum`, não `OneDrive\Documentos\...`) | Pedido explícito: Obsidian não exige OneDrive, então não há razão pra usar |
| Stack espelha o `platform` (Next 16, `@supabase/ssr` 3 clientes, Tailwind v4 CSS-first) | Mesmo autor/ambiente, padrões já comprovados em produção, evita reinventar |
| Metas SMART em v1 são preenchidas manualmente (sem IA) | O spec original pedia "conversão automática via IA", mas isso é um módulo de IA ainda não arquitetado (custo, prompt, chaves). Ponto de extensão deixado pronto |
| `/ecc-system/` na raiz é só export de Markdown, não substitui o Postgres | Fonte de verdade continua sendo o Supabase; a pasta é destino de exportação pro Obsidian |
| Ícone PWA: extração do glifo por chroma-key + recomposição, não uso direto do PNG pronto | O quadrado pré-pronto da marca tinha bordas pretas residuais e ficava com "borda dupla" ao virar ícone maskable |

---

## Arquivos afetados (principais)

**Config/infra:** `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`, `.env.local.example`, `src/proxy.ts`

**Supabase:** `src/lib/supabase/{client,server,service,middleware}.ts`, `supabase/migrations/0001_schema_inicial.sql`

**Domínio:** `src/lib/ecc/{tipos,workspace,kanban,smart,actions}.ts`, `src/lib/ecc-export/metas.ts`

**UI:** `src/app/{layout,globals.css,page}.tsx`, `src/app/auth/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/projetos/page.tsx`, `src/app/projetos/[id]/tarefas/page.tsx`, `src/components/onboarding/*`, `src/components/projetos/*`, `src/components/kanban/*`, `src/components/register-service-worker.tsx`

**PWA:** `public/manifest.json`, `public/sw.js`, `public/icons/*.png`

**Memória (fora do repo, em `~/.claude/.../memory/`):** `projeto_gaiamum_dashboard_novo_saas.md`, `feedback_evitar_onedrive_novos_projetos.md`, `projeto_gaiamum_referencia_dashboard_sow.md`

---

## Bloqueios / o que só o Fabio pode fazer

Nada disso está bloqueando o código (que já compila e builda), mas bloqueia o projeto **existir na internet**:

1. **GitHub:** Fabio vai criar uma conta nova (`gaiamumdash@gmail.com`) em github.com/signup — o `gh` CLI desta máquina hoje está autenticado como "ultraquadras" e precisa ser trocado. Depois disso, eu crio o repo remoto `gaiamum-dashboard` e dou push.
2. **Supabase:** Fabio vai criar o projeto (supabase.com → New Project, região São Paulo) e colar as 3 credenciais (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) direto em `c:\Users\proff\Documents\Gaiamum\.env.local` (copiar de `.env.local.example`) — a `service_role` é segredo forte, não deve ir pelo chat. Depois eu aplico a migration via `supabase link` + `supabase db push`.
3. **Vercel:** depois do repo no GitHub existir, Fabio importa o projeto em vercel.com (mesma conta GitHub nova) e configura as env vars do Supabase lá.
4. **Resend:** só é necessário no Módulo 7 (ainda não construído) — pode esperar.

O roteiro completo passo a passo já foi dado ao Fabio na mensagem anterior desta sessão.

---

## Coisas a saber

### Pegadinhas

- **Build local precisa de internet** pra baixar a fonte Inter do Google Fonts (`next/font/google`) — já aconteceu uma falha transitória de rede que se resolveu numa segunda tentativa. Se o build falhar com erro de "Failed to fetch `Inter`", é rede, não código — tentar de novo.
- **`npm run build` exige as 3 env vars do Supabase** mesmo sem uso real de dados, porque `/auth` é estaticamente pré-renderizado e instancia o client Supabase no module scope. Sem `.env.local`, usar valores fictícios só pra validar o build (como fiz nesta sessão) — nunca vale confiar nesse build pra rodar de verdade.
- **CRLF warnings do git** ao commitar (arquivos LF virando CRLF) são só avisos do Windows, inofensivos — não é preciso agir.
- **Framer Motion não usa `onDragStart` nativo** — tem prop própria de gesto que colide com drag-and-drop HTML5. O Kanban (`quadro-kanban.tsx`) usa `<div draggable>` nativo puro, sem `motion.div`, de propósito.

### Comandos úteis pra retomar

```bash
cd "/c/Users/proff/Documents/Gaiamum"
npm run dev                      # roda local (precisa de .env.local com credenciais reais do Supabase)
npx tsc --noEmit -p tsconfig.json   # typecheck
npx eslint .                        # lint
git log --oneline                   # ver os 2 commits já feitos
git status                          # confirmar working tree limpo
```

---

## Próximos passos

### Imediato (retomar por aqui)

1. Perguntar ao Fabio se ele já criou a conta GitHub nova (`gaiamumdash@gmail.com`). Se sim: rodar `gh auth login` pra trocar a autenticação desta máquina, criar o repo remoto `gaiamum-dashboard`, dar push nos 2 commits locais.
2. Perguntar se o projeto Supabase já existe. Se sim: pedir confirmação de que `.env.local` foi preenchido, rodar `supabase link` + `supabase db push` pra aplicar `0001_schema_inicial.sql`, testar `npm run dev` de verdade (signup → onboarding → projeto → kanban) num navegador.
3. Se GitHub + Supabase prontos: seguir pro deploy Vercel.

### Depois

- Módulos 3-7 (financeiro, CRM, value engine/vendas, relatórios/IA, painel owner + Resend, pagamentos, criptografia) — nenhum iniciado ainda. Ver `[[projeto_gaiamum_referencia_dashboard_sow]]` na memória pra padrões de UX reaproveitáveis quando chegar a vez de cada um.
- Avaliar se vale evoluir o Módulo 1/2 pra amarrar tarefa↔produto vendido (padrão visto na referência SOW: checklist do projeto gerado a partir dos entregáveis do produto).

### Em aberto

- [ ] Domínio `www.gaiamum.com.br` já está registrado? (necessário só quando chegar em Vercel/Resend de verdade)
- [ ] Username da conta GitHub nova (Fabio ainda vai escolher)

---

## Notas da sessão

O pedido original do Fabio veio como um mega-prompt genérico de "Entrepreneur Command Center" (8 módulos, PWA, multi-tenant, pagamentos) colado junto com material de uma skill não relacionada (`av-value-engine`) e um PDF de design system de outro produto — nada disso pertencia a este projeto, foi identificado e descartado no início da sessão via pergunta direta ao usuário. A escala do pedido original foi negociada pra "fundação real + Módulo 0-2" antes de qualquer código, via `EnterPlanMode`, evitando gerar 8 módulos rasos de uma vez.

---

_Handoff gerado a pedido do Fabio antes de uma pausa de ~20 min (fechamento da tela). Ao retomar, comece pelo item 1 de "Próximos passos"._
