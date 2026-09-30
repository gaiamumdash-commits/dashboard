# Testes de integração/RLS — como rodar

Estes testes validam **isolamento real entre tenants** e **permissões reais**
direto contra um Postgres com as migrations do Gaiamum aplicadas — não
mockam o Supabase, porque RLS só prova alguma coisa quando testada contra o
banco de verdade (um mock que sempre autoriza não prova isolamento nenhum).

## Por que não rodaram nesta sessão (P0, 2026-09-30)

Este ambiente tem a CLI do Supabase (`npx supabase`) mas **não tem o Docker
Desktop em execução** (nem o binário no caminho padrão do Windows) — sem
ele, `supabase start` não sobe o Postgres local, e não há como validar RLS
de verdade. Isso está registrado como impedimento externo no
`docs/gaiamum/GAIAMUM-RELATORIO-INCREMENTO-P0.md`. Os testes abaixo estão
prontos e revisáveis, só não foram *executados*.

## Como rodar (assim que houver um Postgres de teste disponível)

**Opção A — Supabase local (recomendado):**

```sh
# 1. Docker Desktop precisa estar rodando.
npx supabase start
# 2. Copie a Service Role Key e a URL que o comando acima imprime.
SUPABASE_TEST_URL="http://127.0.0.1:54321" \
SUPABASE_TEST_SERVICE_ROLE_KEY="<a que o supabase start imprimiu>" \
npm run test:integration
```

**Opção B — projeto de homologação isolado no Supabase Cloud** (nunca o de
produção): definir as mesmas duas variáveis apontando pra ele.

Sem as duas variáveis de ambiente definidas, cada suíte abaixo é pulada
(`describe.skip`) com uma mensagem explicando o motivo — `npm test` (só os
testes unitários) continua funcionando normalmente sem nenhuma delas.

## O que cada arquivo cobre

- `rls-isolamento.test.ts` — usuário de um tenant não lê/edita/apaga dado
  de outro tenant (projetos, tarefas, páginas livres) mesmo sabendo o UUID
  exato, direto pela API do Supabase com o token JWT de um usuário comum
  (não service role). Também cobre um membro de escopo "projeto" não
  enxergando um projeto de outro tenant.
- `rls-financeiro-owner-only.test.ts` — um member (não-owner) do MESMO
  tenant não lê `contas_a_pagar`/`contas_fixas_modelo`/`decisoes`/
  `indicadores`, mesmo tendo acesso ao projeto que originou a despesa.
- `metas-smart-upsert.test.ts` — o upsert real de `salvarMetasSmart`
  (migration 0045 + `onConflict: "tenant_id,horizonte"`): criar → editar
  preserva o `id`; dois `upsert`s concorrentes pro mesmo horizonte nunca
  duplicam a linha (o índice único garante isso no banco).

## Fixtures

Todo teste cria seus próprios tenants/usuários descartáveis via Admin API
(`service.auth.admin.createUser`) e apaga tudo no `afterAll` (o
`on delete cascade` do schema cuida do resto a partir do tenant). Nenhum
teste usa conta real nem lê/escreve fora dos dados que ele mesmo criou.
