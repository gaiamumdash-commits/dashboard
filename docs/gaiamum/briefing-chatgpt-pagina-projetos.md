# Briefing: página de Projetos (Kanban) do Gaiamum

Este documento descreve **todas as funcionalidades reais** da página de
Projetos do Gaiamum (`/projetos/[id]/tarefas`), o quadro Kanban central do
app. Use isso como referência completa antes de sugerir qualquer mudança
de design — o objetivo é que nenhuma funcionalidade existente seja perdida
ou ignorada numa proposta visual nova.

## Contexto do produto

Gaiamum é um "centro de comando" para empreendedores solo/pequenas
equipes: projetos, tarefas, metas, financeiro e agenda num só lugar. A
página de Projetos é onde a execução do dia a dia acontece — um quadro
Kanban por projeto, com um menu lateral fixo (Início, Projetos, Metas
SMART, Equipe, Agenda, Configurações, Marketing, Financeiro) e tema
visual escuro (navy) como padrão.

## Estrutura do quadro

- **Colunas padrão** de todo projeto novo, nesta ordem: **Hoje → Tarefas →
  Em Desenvolvimento → Concluído**, mais uma coluna fixa extra à esquerda
  de todas: **Compromissos do dia**.
- Colunas abertas podem ser **renomeadas** (clique no nome), **criadas**
  (sempre nascem logo depois da coluna "Hoje"), **reordenadas** (arrastar
  o cabeçalho) e **excluídas** (só se estiverem vazias). Exceções fixas
  abaixo.
- **"Concluído"** é permanente: não pode ser renomeada, movida nem
  excluída; nunca aceita *criação* direta de cartão (só recebe cartões
  movidos de outra coluna); tem um botão para **ocultar/mostrar** os
  cartões concluídos (ela só cresce ao longo do projeto e "puxa" a altura
  do quadro inteiro se não for escondida).
- **"Hoje"** é uma identidade de sistema (não depende do nome): só ela
  pode ser **dividida em 3 turnos — Manhã / Tarde / Noite** (um botão liga/
  desliga essa divisão); é onde toda coluna nova nasce ao lado.
- **"Em Desenvolvimento"** é a **coluna de foco**, também fixa (não pode
  ser renomeada/excluída, nem a marca de "foco" pode ser movida pra outra
  coluna): mover um cartão pra dentro dela oferece um **cronômetro de
  hiperfoco** opcional (ver seção própria abaixo).
- **Compromissos do dia**: coluna fixa à esquerda, fora do fluxo normal de
  cartões — mostra os **compromissos do Google Calendar** da pessoa
  logada e as **contas a pagar que vencem hoje** (com link direto pro
  Financeiro). Tem uma barrinha **"Hoje · Amanhã"** no rodapé pra espiar
  o dia seguinte sem sair do quadro, útil pra planejar hoje com base no
  que vem depois. Só aparece se houver algo relevante (Google conectado
  ou conta vencendo).

## O cartão de tarefa

Cada cartão, ao abrir, tem:

- **Título** (editável), **descrição** (texto livre).
- **Prioridade** P1/P2/P3 (P1 ganha uma barra vermelha de destaque no
  cartão fechado).
- **Datas**: início e prazo (data limite). Cartões atrasados/vencendo em
  48h são destacados com cor.
- **Marco** (`is_marco`): flag de "isso é um marco importante do
  projeto".
- **"Aguardando de"**: campo estilo GTD — marca que o cartão está parado
  esperando outra pessoa/evento externo pra andar.
- **Valor estimado**: liga o cartão ao Financeiro (gera uma conta a pagar
  a partir dele).
- **Checklist**: itens com check, adicionar/remover.
- **Anexos**: upload de arquivo (até 15MB) ligado ao cartão.
- **Membros/responsáveis**: múltiplos membros por cartão (não só 1
  responsável), atribuídos/removidos por quem tem acesso.
- **Etiquetas** (labels coloridas), configuráveis por workspace.
- **Comentários/atividade**: histórico de comentários com @menção de
  membros, mais um log de atividades do cartão (criado, movido,
  excluído etc.).
- **Tempo estimado x tempo realizado em minutos** (campo de dado, usado
  também pelo timer de hiperfoco — ver abaixo).
- **Turno** (Manhã/Tarde/Noite) — só tem efeito dentro da coluna "Hoje",
  quando ela está dividida.

## Cronômetro de hiperfoco (foco único, 1 por vez)

Pensado pra quem procrastina/tem TDAH — "pegar 1 cartão de cada vez":

- Mover um cartão pra "Em Desenvolvimento" abre um popup perguntando se
  quer um alarme (**opcional** — "Sem alarme, só mover" não ativa nada).
- Se escolher uma duração (atalhos 15min/30min/1h/2h ou minutos
  personalizados): o cartão fica **amarelo** na metade do tempo,
  **borda vermelha** ao esgotar, toca um **bipe** e abre um popup pra
  **renovar** (mesmos atalhos) ou **só parar**.
- **Limite de 1 cronômetro ativo por pessoa** (não por projeto/workspace)
  — a 2ª tentativa da mesma pessoa é rejeitada com aviso amigável.
- Sair da coluna de foco encerra o timer automaticamente.
- O mesmo efeito visual de cor (amarelo na metade, vermelho ao vencer)
  também vale pra cartões com **data limite definida**, independente da
  coluna.

## Criação de projeto assistida por IA

Ao criar um projeto novo, a pessoa escolhe entre:
1. **"Criar por conta própria"** — nome/descrição e pronto, nasce com as
   colunas padrão vazias.
2. **"Planejar com IA"** — descreve o objetivo por **texto ou voz**
   (ex.: "organizar a festa de aniversário do meu filho"), a IA (Gemini)
   sugere de 8 a 20 tarefas candidatas (com checklist cada), a pessoa
   **revisa, edita e seleciona** quais quer (nenhuma chamada de IA nova
   ao editar), confirma e só as selecionadas entram como cartões reais na
   coluna "Tarefas". Tem limite de uso (rate limit) pra controlar custo.

## Movimentação de cartões

- **Desktop**: arrastar e soltar nativo entre colunas/dentro da coluna.
- **Celular**: arrasto por toque customizado — **segurar 300ms** no
  cartão (ou usar a **alça dedicada ⠿** no canto, que arrasta na hora
  sem esperar) e mover o dedo; auto-scroll automático perto das bordas
  (vertical E horizontal, pra alcançar colunas fora da tela enquanto
  arrasta).
- Alternativa sem arrastar: menu **"Mover para..."** em cada cartão,
  escolhe a coluna (e o turno, se for pra "Hoje" dividida) direto.
- Cartões em "Hoje" dividida: arrastar entre os sub-blocos Manhã/Tarde/
  Noite também funciona.

## Navegação do quadro no celular

- Colunas em largura quase total da tela (~85vw), uma de cada vez, com
  "scroll snap" (trava limpo em cada coluna ao deslizar).
- Cabeçalho com **setas ‹ › + seletor de coluna** (dropdown "Coluna X de
  Y") como alternativa ao gesto de arrastar a tela.
- Botão **"Visão geral"**: zoom-out pra ver todas as colunas de uma vez
  (miniaturas), tocar leva direto pra ela.
- No desktop/notebook grande: todas as colunas lado a lado, altura
  nivelada automaticamente pela coluna com mais conteúdo; menu lateral
  pode ser recolhido (clique) pra dar mais espaço ao quadro.

## Cabeçalho da página / ações do projeto

Acima do quadro: nome e descrição do projeto, e botões de atalho:
- **📄 Páginas** — páginas de texto livre ligadas ao projeto.
- **🧭 Visão 360°** — painel de alinhamento estratégico do projeto (só
  dono do workspace).
- **📋 Decisões** / **📊 Indicadores** — registro de decisões tomadas e
  métricas do projeto (só dono).
- **❄️ Freeze** — dispara por e-mail um "ponto de situação" do projeto
  pra todo mundo envolvido (gestor/dono).
- **⚙ Configurações** — renomear, mudar cor do quadro, arquivar,
  convidar/gerenciar membros do projeto, excluir.

## Permissões

- **Dono do workspace**: acesso completo a tudo.
- **Gestor de um projeto**: administra aquele quadro específico (colunas,
  membros do projeto, Freeze), mas não necessariamente vê o workspace
  inteiro.
- **Membro comum**: trabalha nos cartões dos projetos aos quais foi
  convidado; não vê Financeiro nem painéis estratégicos.

## O que pedimos pra você (ChatGPT)

Com esse funcionamento completo em mente, queremos sugestões de **melhoria
de design visual** (hierarquia, densidade de informação, uso de cor,
layout responsivo) para esta página — sem perder nem simplificar demais
nenhuma das funcionalidades acima. Pode sugerir reorganização visual, mas
qualquer sugestão que remova ou esconda uma funcionalidade existente deve
vir acompanhada de uma alternativa clara de como/onde a pessoa ainda
consegue fazer aquilo.
