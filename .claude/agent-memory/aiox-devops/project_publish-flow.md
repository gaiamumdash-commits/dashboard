---
name: publish-flow
description: Como publicar o Gaiamum em produção (push + vercel deploy --prod) e a armadilha do hook de push e do .next local
metadata:
  type: project
---

Fluxo de publicação do Gaiamum (validado em várias publicações em 2026-10-05):
1. `git log --oneline origin/main..HEAD` — conferir que só há os commits autorizados; se houver mais, PARAR.
2. `AIOX_ACTIVE_AGENT=devops git push origin main` — o hook `.claude/hooks/enforce-git-push-authority.cjs` bloqueia `git push` sem essa variável ("Current agent: @unknown").
3. Desde 2026-10-09 o push em main dispara deploy de produção automático pela integração Git da Vercel (alias `gaiamum-dashboard-git-main-...`). Conferir com `vercel ls --prod` e `vercel inspect <url>` em vez de rodar `vercel deploy --prod` (seria duplicado). Usar `vercel deploy --prod` só se nenhum build aparecer após o push. O build leva ~2 min e o domínio gaiamum.com.br é apontado sozinho.
4. Verificar com curl em https://www.gaiamum.com.br/auth (a rota `/login` NÃO existe e dá 404; o login fica em `/auth`). Páginas protegidas (/planner, /mapas) sem login respondem **200** com `NEXT_REDIRECT;replace;/auth;307` no corpo (redirect em streaming), não um 307 HTTP — isso é saudável; conferir o `<title>` para saber se o build novo está no ar.

5. Migrations de produção: o Fabio aplica à mão no SQL Editor (0057+0058 foram assim). O CLI não consegue: `npx supabase migration list` dá 403 `LegacyDbConfigLoginRoleStatusError` (conta sem privilégio, visto em 2026-10-10), e o histórico remoto não registra o que foi pelo SQL Editor, então `db push` tentaria reaplicar coisas antigas. Para conferir se uma tabela existe: GET `$NEXT_PUBLIC_SUPABASE_URL/rest/v1/<tabela>?limit=1` com a anon key do `.env.local` (404 = não existe; 200/400 = existe). Só dar push depois de confirmar a tabela nova.

**Why:** o push puro falha no hook; `/login` gera falso alarme de 404; o `.next` local pode estar gerado contra o banco de teste, então não confiar em build local como artefato (a Vercel monta o build do zero).
**How to apply:** em toda publicação, usar o prefixo no push, checar `/auth` e não usar `--prebuilt`.
