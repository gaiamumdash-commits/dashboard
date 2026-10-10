# Mapas mentais V1

Aprovado pelo Fabio em 2026-10-09, depois do benchmark do MindMeister.

## Decisões

- **Privado por padrão**, como o Planner. O dono escolhe na hora com quem compartilhar, sempre só para leitura: **🔒 Só eu**, **👥 Equipe** (membros com acesso completo) ou **👥 Equipe e convidados** (inclui quem foi convidado só para um quadro, `memberships.escopo = 'projeto'`). Migration 0063 (`mapas.inclui_convidados` + RLS via `tem_acesso_completo`).
- **Item próprio no menu** ("Mapas"), visível para todos, inclusive convidados de um quadro só.
- **E-mail de resumo só para a própria pessoa**, com limite de envio.
- **Sem IA paga:** datas pelo `parser-fala-agenda.ts` e palavras por contagem, com stopwords em português e `#tags`.
- **Sem biblioteca nova** para o desenho do mapa: layout próprio, testado, com zoom e arrasto feitos à mão.
- **Fora da V1:** coedição em tempo real, IA generativa, imagens e anexos, exportar PDF/PNG e modelos prontos.

## Fases

| Fase | Entrega | Estado |
|---|---|---|
| 1 | Migration 0059 (`mapas`, `mapa_nos`, RLS), menu, lista de mapas, **modo lista**: editar tudo, recolher/expandir, focar no ramo (`?foco=`), atalhos Enter/Tab/Shift+Tab/Esc/Backspace, colar lista → ramos, nota por ramo | Feita |
| 2 | **Visão de mapa** (desktop e celular: zoom, arrastar, pinça), alternar lista/mapa, desfazer/refazer, reorganizar. Migration 0060 (`pos_x`/`pos_y`) | Feita |
| 2b | Botão **Compartilhar** no cabeçalho do mapa (`botao-compartilhar.tsx`, action `definirCompartilhamento`, regra em `compartilhamento.ts`), selo na lista. Migration 0063. Sem a 0063 o botão fica desligado, e a action sempre grava as duas colunas, então nunca compartilha pela regra antiga, que incluía convidados | Feita |
| 3 | Datas e palavras detectadas, **"▶ Executar este ramo"** (vira tarefa do Kanban ou compromisso do Planner, com confirmação, e fica ligado a ela: o ramo mostra a cor de urgência/✓ de lá, e dá pra já iniciar o hiperfoco), botão de **resumo por e-mail**. Migration 0062 (`mapa_envios`) | Feita |

Decisão de 2026-10-10: o mapa **não ganha timer, prazo ou alarme próprios**. Ele usa os do Kanban/Planner por ligação (`mapa_nos.tarefa_id` / `compromisso_id`, já criados na 0059), para não haver duas verdades. Conferido em 2026-10-10: o compromisso do Planner **não tem alarme próprio**. Ele aparece na Agenda e no resumo das 7h. Alarme e hiperfoco existem só na tarefa do Kanban, por isso o "Executar" oferece a tarefa com foco opcional.

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

## Auditoria de segurança (2026-10-10)

- **Acesso:** a página e todas as ações passam por `garantirWorkspace()`. O `tenant_id` vem da sessão e o `user_id` vem do banco (`auth.uid()`), nunca do navegador. Toda escrita filtra pelo tenant e passa pela RLS: só o dono escreve, e a equipe só lê mapas compartilhados. Na tela, o modo "só leitura" é só visual; quem garante a regra é o banco.
- **Entradas:** ids são validados como UUID; textos têm limite (200 por ramo, 2000 por nota, 50 mil por lista colada); coordenadas aceitam só números finitos dentro de ±100000; cor e borda aceitam só valores da paleta (com CHECK no banco); o limite de 500 ramos é garantido por trigger. `restaurarRamos` exige o pai antes do filho, o pai no mesmo mapa (FK composta) e não aceita ligação com tarefa nem compromisso.
- **Tela:** não há `dangerouslySetInnerHTML`, `innerHTML` nem `eval`; todo texto é escapado pelo React. Nenhuma chave privilegiada (service role) é usada no módulo.
- **Teste anônimo em produção:** leitura devolve vazio, o insert é recusado pela RLS e as funções `security definer` são negadas.
- **Reforço opcional:** a migration 0061 tira o privilégio de tabela do papel `anon` (defesa em profundidade).
- **Pendente:** `tests/integration/rls-mapas.test.ts`, que cobre dono × equipe × outro workspace, está escrito mas não foi executado, porque falta banco de teste (Docker ou projeto de homologação).
- **Liberação:** o módulo não tem trava própria. Quem entra no Gaiamum, ou seja, os e-mails autorizados em `acesso-beta`, já vê o Mapa mental, sempre com os próprios mapas privados.

## Fase 3 (2026-10-10)

- **Datas** (`datas.ts`, puro e testado): leitor próprio por regra, sem IA. Entende hoje, amanhã, depois de amanhã, dd/mm(/aa), "dia 20 de novembro", "dia 5", dias da semana e o horário ("14h", "14:30", "às 9", "meio-dia"). Trabalha só com datas do Brasil no formato "AAAA-MM-DD" e devolve `null` quando o ramo não cita data. Não reaproveita o `parser-fala-agenda` porque aquele sempre devolve uma data.
- **Palavras-chave** (`palavras.ts`, puro e testado): conta palavras sem acento e sem maiúscula, ignora as palavras comuns do português e mostra a grafia mais usada. As `#tags` sempre aparecem. O filtro `?palavra=` apaga os ramos que não citam a palavra.
- **▶ Executar este ramo:** cria uma **tarefa no Kanban** pelas próprias actions do Kanban (criar, prazo em UTC a partir do horário de Brasília, hiperfoco opcional) ou um **compromisso no Planner** (com a mesma validação de `lerCompromisso`), e liga ao ramo (`tarefa_id`/`compromisso_id`). O estado mostrado no ramo é calculado no servidor com as regras de lá (`urgenciaDoPrazo`, `estadoHiperfoco`): concluída, atrasada, perto do prazo (48h), sem prazo, ou sem acesso. "Desligar" desfaz só o vínculo. Desfazer uma exclusão de ramo não refaz o vínculo.
- **📬 Resumo por e-mail** (`resumo-email.ts`, puro e testado): o mapa inteiro em tópicos (inclusive os ramos recolhidos), com datas em ordem e palavras-chave. Todo texto é escapado no HTML. O e-mail vai **só** para o endereço da sessão. O limite é de 1 envio por minuto e 20 por dia por pessoa (tabela `mapa_envios`, migration 0062, com RLS da própria pessoa); o envio é registrado antes de sair, então clique duplo não manda dois.
- **Painel** embaixo do mapa: datas (no Mapa, tocar seleciona e centraliza o ramo; na Lista, foca nele), palavras-chave e o botão de e-mail.
