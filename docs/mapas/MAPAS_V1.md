# Mapas mentais V1

Aprovado pelo Fabio em 2026-10-09, depois do benchmark do MindMeister.

## Decisões

- **Privado por padrão**, como o Planner. O dono pode compartilhar com o workspace, só para leitura.
- **Item próprio no menu** ("Mapas"), visível para todos, inclusive convidados de um quadro só.
- **E-mail de resumo só para a própria pessoa**, com limite de envio.
- **Sem IA paga:** datas pelo `parser-fala-agenda.ts` e palavras por contagem, com stopwords em português e `#tags`.
- **Sem biblioteca nova** para o desenho do mapa: layout próprio, testado, com zoom e arrasto feitos à mão.
- **Fora da V1:** coedição em tempo real, IA generativa, imagens e anexos, exportar PDF/PNG e modelos prontos.

## Fases

| Fase | Entrega | Estado |
|---|---|---|
| 1 | Migration 0059 (`mapas`, `mapa_nos`, RLS), menu, lista de mapas, **modo lista**: editar tudo, recolher/expandir, focar no ramo (`?foco=`), atalhos Enter/Tab/Shift+Tab/Esc/Backspace, colar lista → ramos, nota por ramo | Feita |
| 2 | **Visão de mapa** (desktop e celular: zoom, arrastar, pinça), alternar lista/mapa, botão de compartilhar com a equipe | Pendente |
| 3 | Datas e palavras detectadas, ramo → compromisso do Planner / tarefa do Kanban (com confirmação), botão de **resumo por e-mail** | Pendente |

## Onde está

- Banco: `supabase/migrations/0059_mapas.sql`. A árvore usa uma FK composta, para o pai ser sempre do mesmo mapa, uma só ideia central por mapa e no máximo 500 ramos.
- Regras puras: `src/lib/ecc/mapas/arvore.ts` (testes em `src/lib/ecc/__tests__/mapas-arvore.test.ts`).
- Ações: `src/lib/ecc/mapas/actions.ts`. Leitura: `src/lib/ecc/mapas/dados.ts`.
- Telas: `src/app/mapas/`, `src/components/mapas/`.
- Teste de acesso (precisa de banco de teste): `tests/integration/rls-mapas.test.ts`.
