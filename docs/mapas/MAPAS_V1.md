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
| 2 | **Visão de mapa** (desktop e celular: zoom, arrastar, pinça), alternar lista/mapa, desfazer/refazer, reorganizar. Migration 0060 (`pos_x`/`pos_y`) | Feita (falta o botão de compartilhar: fica pra 2b) |
| 3 | Datas e palavras detectadas, **"▶ Executar este ramo"** (vira tarefa do Kanban ou compromisso do Planner, com confirmação, e fica ligado a ela: o ramo mostra a cor de urgência/✓ de lá, e dá pra já iniciar o hiperfoco), botão de **resumo por e-mail** | Pendente |

Decisão de 2026-10-10: o mapa **não ganha timer, prazo ou alarme próprios**. Ele usa os do Kanban/Planner por ligação (`mapa_nos.tarefa_id` / `compromisso_id`, já criados na 0059), para não haver duas verdades. Antes de construir, conferir se o compromisso do Planner tem alarme próprio ou depende do da Agenda.

## Onde está

- Banco: `supabase/migrations/0059_mapas.sql`. A árvore usa uma FK composta, para o pai ser sempre do mesmo mapa, uma só ideia central por mapa e no máximo 500 ramos.
- Regras puras: `src/lib/ecc/mapas/arvore.ts` (testes em `src/lib/ecc/__tests__/mapas-arvore.test.ts`).
- Ações: `src/lib/ecc/mapas/actions.ts`. Leitura: `src/lib/ecc/mapas/dados.ts`.
- Telas: `src/app/mapas/`, `src/components/mapas/`.
- Teste de acesso (precisa de banco de teste): `tests/integration/rls-mapas.test.ts`.

## Visão de mapa (fase 2)

- **Desenho:** HTML para os ramos e SVG para as curvas, numa camada com `transform` (zoom e arrasto da tela). Nenhuma biblioteca nova. A ideia central e os ramos principais aparecem em caixa com a cor do ramo; do nível 2 em diante, o ramo é texto sobre uma linha colorida e a curva continua a linha.
- **Layout** (`src/lib/ecc/mapas/layout.ts`, puro e testado): a ideia central fica em (0,0). Os ramos principais se dividem entre direita e esquerda pelo peso, sem embaralhar a ordem, e cada lado cresce como árvore horizontal em faixas. O resultado não tem sobreposição: o teste confere 500 ramos, calculados em poucos milissegundos. O tamanho de cada ramo é estimado pelo texto, com as mesmas medidas que a tela usa.
- **Posição ≠ hierarquia:** arrastar só grava `pos_x`/`pos_y` (migration 0060), relativas ao pai e só ao soltar. O ramo leva junto o que está dentro dele, com 1 gravação. `pai_id` e `ordem` nunca mudam pelo arrasto. "Reorganizar" zera as posições do mapa. Sem a 0060 aplicada, o mapa abre no layout automático e o arrasto fica desligado, sem quebrar nada.
- **Desfazer/refazer** (`historico.ts`, puro e testado): cobre texto, posição, recolher, criar, excluir (reinsere o ramo e tudo o que estava dentro, com os mesmos ids, pela action `restaurarRamos`) e reorganizar. Vale só para a aba aberta. Se o servidor recusar, a operação volta para o histórico.
- **Gestos:** com um dedo ou o mouse, arrastar no fundo move a tela; num ramo, tocar seleciona e arrastar move o ramo. Arrastar a ideia central move a tela. Dois dedos fazem pinça. No trackpad, rolar move e pinçar (ou Ctrl+roda) dá zoom. Duplo toque ou duplo clique edita. Nenhum gesto de tela edita.
- **Teclado** (com o mapa em foco, fora de campo de texto): setas navegam, Enter/F2 edita, Tab cria ramo dentro, Shift+Enter cria ramo abaixo, Delete exclui (pede confirmação se houver ramos dentro), Espaço recolhe, Esc tira a seleção, Ctrl+Z desfaz, Ctrl+Shift+Z ou Ctrl+Y refaz.
- **Celular:** os botões "+" ficam ao lado do ramo selecionado e a barra de ações embaixo, ao alcance do polegar. O mapa abre na ideia central em tamanho legível, e o ⤢ mostra o mapa inteiro. O zoom fica guardado na aba (`sessionStorage`).
- **Limites conhecidos:** o tamanho do ramo é estimado, não medido, então um texto muito largo pode passar um pouco da caixa. Ramos arrastados podem encostar em outros por escolha da pessoa. Testes de interface (clique e gesto) não são automatizados, porque o repositório não tem biblioteca de teste de componente; foram conferidos por prints. O teste de RLS continua escrito e não executado.
- **Aparência** (pedido do Fabio, 2026-10-10): o botão **Caixas | Linhas** no topo define o padrão do mapa (Caixas = todo ramo com borda; fica guardado por mapa neste navegador). No ramo selecionado, **🎨 Estilo** escolhe a **cor** (8 da paleta ou Automática; os ramos de dentro herdam) e a **borda** (com, sem/linha ou Automática). Fica salvo em `mapa_nos.cor`/`forma` (migration 0060) e entra no desfazer.
