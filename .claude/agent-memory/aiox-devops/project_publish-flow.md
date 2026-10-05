---
name: publish-flow
description: Como publicar o Gaiamum em produção (push + vercel deploy --prod) e a armadilha do hook de push e do .next local
metadata:
  type: project
---

Fluxo de publicação do Gaiamum (validado em várias publicações em 2026-10-05):
1. `git log --oneline origin/main..HEAD` — conferir que só há os commits autorizados; se houver mais, PARAR.
2. `AIOX_ACTIVE_AGENT=devops git push origin main` — o hook `.claude/hooks/enforce-git-push-authority.cjs` bloqueia `git push` sem essa variável ("Current agent: @unknown").
3. `vercel deploy --prod` — CLI já logada e projeto linkado; o domínio gaiamum.com.br é apontado automaticamente para o deploy novo.
4. Verificar com curl em https://www.gaiamum.com.br/auth (a rota `/login` NÃO existe e dá 404; o login fica em `/auth`).

**Why:** o push puro falha no hook; `/login` gera falso alarme de 404; o `.next` local pode estar gerado contra o banco de teste, então não confiar em build local como artefato (a Vercel monta o build do zero).
**How to apply:** em toda publicação, usar o prefixo no push, checar `/auth` e não usar `--prebuilt`.
