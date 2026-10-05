# Prompt — Redesign visual da página Kanban (`/projetos/[id]/tarefas`)

**Dado pelo Fabio em 2026-10-05**, pra retomar numa sessão nova.

**PENDÊNCIA BLOQUEANTE — reanexar a imagem do mockup antes de começar.** O
Fabio mandou a imagem certa (2ª tentativa — a 1ª tinha vindo, por engano,
idêntica à do Painel geral), mas ela chegou colada direto na mensagem sem
gerar um arquivo no disco desta sessão (achado real: aconteceu só com essa
imagem, as anteriores vinham com "[Image: source: ...]" e um caminho de
arquivo real) — procurei em Downloads/Desktop/OneDrive-Imagens e não achei
nada de 2026-10-05. **Pedir pro Fabio reanexar essa mesma imagem** (ou tirar
um print novo da tela que ele chamou de "Painel Kanban aprovado") assim que
retomar, salvar em
`docs/gaiamum/mockups/kanban-mockup-aprovado-2026-10-05.png` (usar `cp` a
partir do caminho que o anexo indicar, mesmo padrão já usado pro mockup do
Painel geral), e só então comparar pixel a pixel — a descrição textual
abaixo é um apoio de memória, não substitui a imagem real.

## Descrição textual do mockup (apoio — não substitui a imagem real)

Tela "Suor, Insights e Realizações" (nome de um projeto real, dados ilustrativos):

- **Cabeçalho**: "← Projetos" acima; título do projeto + badge verde "● No
  caminho"; subtítulo "Meu projeto de vida para os próximos 3 anos".
- **Ações do projeto** (canto superior direito): botões `[📄 Páginas]`
  `[🧭 Visão 360°]` `[📋 Decisões]` `[📊 Indicadores]` `[···]` (overflow).
- **Progresso**, na mesma linha: "18 de 28 tarefas concluídas" + barra azul
  horizontal + "64%"; depois ícone + "5 tarefas abertas"; depois ícone de
  alvo + "1 em foco".
- **Faixa contextual do dia** (1 linha horizontal, 4 blocos separados por
  divisores): 📅 "HOJE · Domingo, 4 de Outubro" | 🚩 "Próximo compromisso:
  14h Reunião" | ⚠ "1 prazo importante hoje: Pixel nos 4 sites" | 🎯 "Foco
  ativo: Avançar fluxo comercial · 18 min restantes" com barrinha de
  progresso embutida e seta "›" no final.
- **Toolbar operacional**: `[+ Tarefa]` (azul, destaque) `[🔍 Buscar
  tarefas...]` `[▽ Filtros]` `[👤 Minhas tarefas]` `[▦ Visão geral]`.
- **5 colunas lado a lado** (a de Compromissos e a de Concluído visivelmente
  mais estreitas que as 3 centrais):
  1. **"Compromissos do dia (3)"** — "09:00–10:00 Revisão semanal" (badge
     "Hoje" + "Google Calendar"); "14:00–15:00 Reunião" (idem); "Vencimento:
     Assinatura Notion R$ 49,90" (badge amarelo "Hoje"). Rodapé: segmented
     control `[Hoje (3)] [Amanhã (2)]`, aba ativa em azul.
  2. **"Hoje (4)"** — badge azul "Hoje" + menu "⋮" no cabeçalho; dividida em
     turnos: "☀ MANHÃ (0)" + "Adicionar tarefa para manhã"; "☀ TARDE (4)"
     com 4 cards (cada um com alça "⠿" e "⋯"); "🌙 NOITE (0)" + "Adicionar
     tarefa para noite".
  3. **"Tarefas (5)"** — botão "Planejar hoje" + "⋮". Cards variados: uns
     com P3 simples, um P1 com borda vermelha à esquerda, um com marco
     (bandeira "Marco") + checklist "0/7", outro com checklist "1/1".
     Rodapé "+ Adicionar tarefa".
  4. **"Em Desenvolvimento (1)"** — badge laranja "🎯 Foco". 1 card com
     ícone de play, checklist "1/2", e a área do timer: "18:42 restantes" +
     barra de progresso.
  5. **"Concluído (18)"** — "🎉 18 tarefas concluídas" + botão "Mostrar
     cartões ⌄" (recolhido por padrão).

---

PROMPT PARA CLAUDE CODE — REDESIGN COMPLETO DA PÁGINA KANBAN DO GAIAMUM COM FIDELIDADE AO LAYOUT APROVADO

Você atuará como engenheiro de produto sênior, especialista em React/Next.js/TypeScript, UX/UI SaaS, design systems, drag-and-drop, acessibilidade e arquitetura de front-end no projeto Gaiamum.

Sua missão é transformar visualmente a página atual do Kanban do Gaiamum:

/projetos/[id]/tarefas

para que ela fique o mais fiel possível ao MOCKUP APROVADO que estou anexando junto com este prompt.

IMPORTANTE:

ESTA É PRINCIPALMENTE UMA TAREFA DE REDESIGN DE INTERFACE, HIERARQUIA VISUAL, USABILIDADE E EXPERIÊNCIA.

NÃO quero reinventar a funcionalidade existente.

NÃO quero mudar regras de negócio.

NÃO quero simplificar recursos.

NÃO quero remover funcionalidades.

NÃO quero criar um novo Kanban.

NÃO quero alterar comportamentos funcionais que já estejam validados.

Quero preservar integralmente a lógica atual e reorganizar sua apresentação visual para atingir o layout aprovado.

A imagem aprovada é a principal referência visual.

==================================================
OBJETIVO PRINCIPAL
==================================================

Transformar a página atual do Kanban numa experiência visual equivalente ao mockup aprovado, mantendo integralmente:

- funcionalidades;
- regras de negócio;
- permissões;
- movimentação de cartões;
- comportamento mobile;
- cronômetro;
- turnos;
- compromissos;
- integração com Google Calendar;
- integração financeira;
- cartões;
- anexos;
- checklists;
- comentários;
- membros;
- labels;
- prioridades;
- marcos;
- datas;
- coluna Hoje;
- coluna Em Desenvolvimento;
- coluna Concluído;
- criação e gestão de colunas;
- Freeze;
- Visão 360°;
- Decisões;
- Indicadores;
- Páginas;
- Configurações;
- todas as demais funcionalidades atualmente existentes.

A regra é:

MUDAR A APRESENTAÇÃO.
PRESERVAR O COMPORTAMENTO.

==================================================
1. ANTES DE ALTERAR QUALQUER CÓDIGO
==================================================

Faça uma auditoria da implementação atual de:

/projetos/[id]/tarefas

Mapeie:

1. componente da página;
2. componentes das colunas;
3. componentes dos cartões;
4. componentes de drag-and-drop;
5. lógica de toque mobile;
6. modais;
7. formulários;
8. cronômetro;
9. divisão Hoje em turnos;
10. Google Calendar;
11. contas a pagar;
12. permissões;
13. criação/renomeação/exclusão/reordenação de colunas;
14. coluna Concluído;
15. coluna Em Desenvolvimento;
16. criação de cartões;
17. edição de cartões;
18. Páginas;
19. Visão 360°;
20. Decisões;
21. Indicadores;
22. Freeze;
23. Configurações;
24. progressos;
25. menus;
26. responsividade;
27. design system;
28. tokens;
29. hooks;
30. stores;
31. queries/mutations;
32. APIs utilizadas.

Antes de implementar, apresente apenas um resumo curto:

- principais arquivos encontrados;
- componentes que poderão ser reaproveitados;
- principais mudanças visuais previstas;
- qualquer risco técnico encontrado.

Depois disso, prossiga com a implementação.

Não pare esperando aprovação intermediária.

==================================================
2. FONTE DE VERDADE VISUAL
==================================================

Use o mockup aprovado anexado como especificação visual principal.

Quero alta fidelidade em:

- disposição;
- proporções;
- espaçamentos;
- alturas;
- larguras;
- alinhamentos;
- hierarquia;
- cards;
- densidade;
- bordas;
- tipografia;
- cores;
- contraste;
- áreas de respiro;
- tamanhos;
- organização das ações;
- aparência das colunas;
- aparência dos cartões;
- destaque do foco;
- visual da barra superior;
- toolbar;
- status.

Não faça uma interpretação livre.

Não crie outro layout "inspirado".

Implemente o layout aprovado.

==================================================
3. IDENTIDADE VISUAL
==================================================

Preservar a identidade do Gaiamum.

Direção:

- fundo navy profundo;
- sidebar escura;
- superfícies em diferentes níveis de azul;
- cards mais claros que as colunas;
- azul/cyan como cor principal;
- verde para sucesso;
- âmbar para atenção;
- vermelho para risco real;
- branco/off-white para texto;
- texto secundário em azul acinzentado.

Evitar:

- excesso de glow;
- aparência gamer;
- excesso de gradientes;
- neon exagerado;
- animações inúteis;
- visual de dashboard genérico;
- poluição visual.

A interface precisa parecer:

premium;
profissional;
moderna;
estratégica;
usável diariamente.

==================================================
4. SIDEBAR
==================================================

Preservar a sidebar existente e suas rotas.

Manter:

- Gaiamum;
- Estrategista;
- Início;
- Projetos;
- Metas SMART;
- Equipe;
- Agenda;
- Configurações;
- Marketing;
- Financeiro;
- usuário conectado;
- sair.

Na página atual:

Projetos deve aparecer visualmente selecionado.

Não alterar navegação.

Não alterar permissões.

Não alterar lógica de recolhimento se já existir.

Apenas refiná-la visualmente conforme o mockup.

==================================================
5. NOVO CABEÇALHO DO PROJETO
==================================================

Reconstruir a parte superior da página conforme o mockup aprovado.

Estrutura:

← Projetos

Suor, Insights e Realizações       [● No caminho]

Meu projeto de vida para os próximos 3 anos

18 de 28 tarefas concluídas
[barra de progresso]                64%

5 tarefas abertas        1 em foco

IMPORTANTE:

Todos os valores devem continuar vindo dos dados reais do projeto.

Nada hardcoded.

O status "No caminho" só deve ser mostrado se isso puder ser derivado ou já existir.

Caso não exista hoje uma regra para saúde do projeto, NÃO invente nova regra de negócio nesta tarefa.

Nesse caso, omita o status ou use algum status já existente no sistema.

Não transforme o redesign em implementação de uma nova funcionalidade estratégica.

==================================================
6. PROGRESSO DO PROJETO
==================================================

Mover a barra de progresso que hoje fica praticamente escondida na parte inferior para o cabeçalho superior.

Mostrar:

X de Y tarefas concluídas

barra horizontal

percentual

Utilizar exatamente a mesma fonte de dados e fórmula atual.

Não alterar o cálculo.

Não alterar conceito de conclusão.

A mudança é apenas de posição e design.

Depois de mover a barra para o cabeçalho:

remover visualmente a barra redundante do rodapé.

==================================================
7. AÇÕES DO PROJETO
==================================================

Organizar visualmente as ações conforme o mockup.

Manter em destaque:

[Páginas]

[Visão 360°]

[Decisões]

[Indicadores]

Adicionar um botão:

[…]

Nesse menu de overflow podem ficar visualmente:

Freeze
Configurações

e eventualmente outras ações administrativas já existentes.

IMPORTANTE:

Isso é reorganização visual.

As permissões existentes permanecem exatamente iguais.

Se determinada função hoje só aparece para dono:

continua só aparecendo para dono.

Se aparece para gestor:

continua seguindo a regra atual.

Não mude nenhuma regra de autorização.

==================================================
8. FREEZE
==================================================

Freeze continua funcionando exatamente como hoje.

Pode sair da linha principal e entrar no menu de overflow […]

Mas:

- não remover;
- não alterar envio de email;
- não alterar destinatários;
- não alterar permissões;
- não alterar confirmação;
- não alterar backend.

==================================================
9. CONFIGURAÇÕES
==================================================

Configurações continuam contendo todas as funções atuais:

- renomear;
- cor;
- arquivar;
- membros;
- excluir;
- demais opções existentes.

Pode ser acessada pelo menu de overflow visual.

Nenhuma função deve ser removida.

==================================================
10. FAIXA CONTEXTUAL DO DIA
==================================================

Adicionar abaixo do cabeçalho uma faixa visual horizontal igual ao mockup.

Essa faixa NÃO deve criar novas regras de negócio.

Ela deve reaproveitar informações já existentes.

Estrutura visual:

HOJE · {data}

Próximo compromisso:
{hora + título}

{N} prazo importante hoje
{tarefa}

Foco ativo:
{tarefa}
{tempo restante}

IMPORTANTE:

Se determinada informação não existir:

não inventar.

Exemplo:

Se não houver próximo compromisso:

mostrar estado vazio elegante ou omitir aquele item.

Se não houver foco:

mostrar "Nenhum foco ativo" ou equivalente.

A faixa deve funcionar como resumo contextual.

==================================================
11. COMPROMISSOS DO DIA
==================================================

Preservar integralmente a funcionalidade atual.

Ela continua mostrando:

- Google Calendar;
- contas a pagar vencendo hoje;
- links;
- Hoje;
- Amanhã;
- todas as regras existentes.

Porém redesenhar visualmente conforme mockup.

A coluna/painel deve ficar mais compacta visualmente que as colunas do Kanban.

Não deve dominar horizontalmente a página.

Visual desejado:

Compromissos do dia (N)

09:00 – 10:00
Revisão semanal
Google Calendar

14:00 – 15:00
Reunião
Google Calendar

Vencimento
Assinatura Notion
R$ 49,90

[Hoje] [Amanhã]

IMPORTANTE:

Não alterar fontes de dados.

Não alterar Google Calendar.

Não alterar Financeiro.

Não criar nova integração.

==================================================
12. HOJE / AMANHÃ
==================================================

Preservar exatamente a funcionalidade atual de visualizar Hoje e Amanhã.

Redesenhar como segmented control conforme o mockup.

Exemplo:

[ Hoje (3) ] [ Amanhã (2) ]

A aba ativa tem destaque azul.

A informação continua vindo da implementação existente.

==================================================
13. TOOLBAR OPERACIONAL
==================================================

Criar visualmente uma toolbar abaixo da faixa contextual.

Conforme mockup:

[ + Tarefa ]

[ Buscar tarefas... ]

[ Filtros ]

[ Minhas tarefas ]

[ Visão geral ]

ATENÇÃO:

Se Buscar/Filtros/Minhas tarefas já existirem, apenas reorganizar.

Se algum desses recursos NÃO existir atualmente, NÃO implementar nova lógica complexa sem necessidade.

Neste caso:

- primeiro verificar se já há infraestrutura existente;
- se houver, expor visualmente;
- se não houver, não criar grandes novos sistemas nesta tarefa.

O objetivo principal continua sendo reproduzir a UX aprovada sem ampliar escopo de backend.

A funcionalidade "Visão geral" já existente deve ser reaproveitada.

==================================================
14. BOTÃO + TAREFA
==================================================

O botão principal:

+ Tarefa

deve utilizar exatamente a lógica atual de criação de cartão.

Não criar novo fluxo paralelo.

Não criar modal duplicado.

Use a ação existente.

==================================================
15. KANBAN
==================================================

Preservar integralmente o funcionamento atual do Kanban.

Continuam existindo:

Compromissos do dia

Hoje

Tarefas

Em Desenvolvimento

Concluído

mais todas as colunas customizadas do projeto.

Não transformar o layout em um Kanban estático.

As colunas continuam:

- criáveis;
- renomeáveis quando permitido;
- ordenáveis;
- excluíveis quando permitido.

Respeitar integralmente todas as exceções de sistema.

==================================================
16. COLUNA HOJE
==================================================

Hoje continua sendo identidade de sistema.

Não usar o nome da coluna como única forma de identificá-la.

Preservar o ID/flag/lógica existente.

A coluna Hoje deve ganhar destaque visual sutil.

No mockup:

borda azul mais evidente;
cabeçalho mais destacado;
badge "Hoje".

Quando a divisão em turnos estiver ativa:

MANHÃ (N)

TARDE (N)

NOITE (N)

Preservar integralmente:

- divisão;
- criação;
- movimentação;
- drag;
- drop;
- turno;
- menu "Mover para...";
- lógica existente.

==================================================
17. TURNOS
==================================================

Não alterar a funcionalidade.

Manter:

Manhã
Tarde
Noite

Somente dentro de Hoje.

Se o toggle atual para ativar/desativar turnos existir no cabeçalho/menu:

mantê-lo acessível.

Pode ser reposicionado visualmente no menu da coluna.

Mas não esconda a ponto de ficar impossível encontrá-lo.

==================================================
18. COLUNA TAREFAS
==================================================

Redesenhar visualmente conforme mockup.

Cabeçalho:

Tarefas (N)

[Planejar hoje]   […]

Se "Definir Hoje" já existe:

pode ser renomeado visualmente para "Planejar hoje" SOMENTE se isso não alterar a compreensão ou quebrar testes.

Caso a terminologia seja importante em outras partes do sistema:

mantenha "Definir Hoje".

Não altere funcionalidade por estética.

==================================================
19. EM DESENVOLVIMENTO
==================================================

Essa coluna deve receber identidade visual mais clara como zona de foco.

Cabeçalho:

Em Desenvolvimento (N)

Badge:

🎯 Foco

Use ícone do design system, não necessariamente emoji.

Não alterar:

- regras;
- bloqueios;
- comportamento;
- timer;
- movimentação;
- limite de foco.

O objetivo é apenas tornar visualmente evidente que esta coluna representa execução ativa.

==================================================
20. CRONÔMETRO DE HIPERFOCO
==================================================

ESSA FUNCIONALIDADE DEVE SER PRESERVADA INTEGRALMENTE.

Não alterar:

- popup ao mover para Em Desenvolvimento;
- opção sem alarme;
- 15min;
- 30min;
- 1h;
- 2h;
- minutos personalizados;
- apenas um timer por pessoa;
- regra global por pessoa;
- amarelo na metade;
- vermelho ao vencer;
- bip;
- renovação;
- encerramento;
- término ao sair da coluna;
- integração com tempo realizado;
- qualquer regra atual.

A mudança será apenas visual.

Quando houver timer ativo:

o cartão pode apresentar a área visual do mockup:

18:42 restantes

[progress bar]

com ícone apropriado.

Não crie um novo timer.

Exiba o estado do timer atual.

==================================================
21. ALERTA DO TIMER
==================================================

Preservar:

50% → amarelo

tempo esgotado → vermelho

bipe

modal

renovar

parar

Não alterar thresholds.

Não alterar áudio.

Não alterar persistência.

Não alterar regras.

==================================================
22. PRAZOS DE CARTÕES
==================================================

Preservar exatamente:

- atraso;
- vencimento;
- alerta em 48 horas;
- cores;
- regras existentes.

Apenas adaptar a representação visual ao novo card.

==================================================
23. COLUNA CONCLUÍDO
==================================================

Preservar integralmente:

- permanente;
- não renomeável;
- não removível;
- não movível;
- não aceita criação direta;
- recebe cartões movidos;
- mostrar/ocultar cartões.

Visual conforme mockup:

Concluído (18)

18 tarefas concluídas

[Mostrar cartões]

Quando expandido:

mostrar normalmente os cartões atuais.

Quando recolhido:

não deixar a coluna crescer inutilmente.

A funcionalidade existente de ocultar concluídos deve ser reaproveitada.

Não criar segunda regra.

==================================================
24. COLUNAS CUSTOMIZADAS
==================================================

NÃO esquecer colunas criadas pelo usuário.

O mockup mostra apenas as principais.

Mas na aplicação real:

todas as colunas customizadas existentes devem continuar sendo renderizadas.

Elas continuam:

- arrastáveis;
- editáveis;
- excluíveis quando permitido;
- ordenáveis.

O redesign deve funcionar para número variável de colunas.

==================================================
25. ORDEM E REORDENAÇÃO
==================================================

Preservar integralmente:

- criação de nova coluna;
- nascer após Hoje;
- reordenação;
- drag do cabeçalho;
- regras de colunas fixas.

Não alterar algoritmos.

Não alterar persistência.

==================================================
26. CARTÕES — DESIGN
==================================================

Redesenhar visualmente os cartões conforme mockup.

Diferenciar claramente:

fundo da página;
coluna;
cartão.

O cartão deve continuar compacto.

Mostrar visualmente, quando aplicável:

- título;
- prioridade;
- marco;
- prazo;
- checklist;
- responsável;
- labels;
- indicadores de anexo/comentário.

Não é necessário mostrar todos os metadados ao mesmo tempo.

Use progressive disclosure.

Mas todos continuam acessíveis ao abrir o cartão.

==================================================
27. PRIORIDADE
==================================================

Preservar:

P1
P2
P3

P1 mantém destaque visual forte.

Preferência conforme mockup:

barra superior vermelha discreta no P1.

Não alterar significado.

Não alterar regras.

==================================================
28. MARCO
==================================================

Preservar is_marco.

Mostrar pequena identificação visual:

Marco

com ícone de bandeira ou equivalente.

Não alterar lógica.

==================================================
29. AGUARDANDO DE
==================================================

Preservar integralmente.

Quando preenchido:

pode ganhar representação visual discreta no cartão.

Exemplo:

Aguardando João

Mas não alterar:

- campo;
- persistência;
- edição;
- lógica.

==================================================
30. VALOR ESTIMADO / FINANCEIRO
==================================================

Preservar integração atual.

Não alterar:

- geração de conta;
- dados;
- valores;
- Financeiro;
- relacionamentos;
- permissões.

Apenas manter o acesso dentro do cartão como atualmente.

==================================================
31. CHECKLIST
==================================================

Preservar:

- criar;
- editar;
- remover;
- marcar;
- desmarcar.

No cartão fechado:

pode exibir apenas:

0/7

1/2

etc.

==================================================
32. ANEXOS
==================================================

Preservar:

- upload;
- tamanho máximo;
- storage;
- download;
- remoção;
- permissões.

No cartão fechado:

mostrar apenas pequeno indicador se necessário.

==================================================
33. MEMBROS
==================================================

Preservar múltiplos membros por cartão.

Não transformar em responsável único.

Exibir avatares/chips de forma compacta quando apropriado.

Todas as regras atuais continuam válidas.

==================================================
34. ETIQUETAS
==================================================

Preservar labels existentes.

Não alterar sistema de configuração do workspace.

Exibir no cartão de maneira compacta.

Evitar excesso de cor.

==================================================
35. COMENTÁRIOS E ATIVIDADE
==================================================

Preservar:

- comentários;
- @menção;
- histórico;
- log de movimentação;
- criação;
- exclusão;
- todas as atividades existentes.

Não alterar backend.

Não remover histórico.

==================================================
36. TEMPO ESTIMADO E REALIZADO
==================================================

Preservar os campos e integração com timer.

Não mudar unidade.

Não mudar cálculo.

Não mudar armazenamento.

==================================================
37. ABERTURA DO CARTÃO
==================================================

Manter a funcionalidade atual do card detail.

Se o sistema usa modal:

não substituir por drawer se isso exigir refatoração significativa ou arriscar regressão.

O mockup é principalmente do quadro fechado.

Priorize segurança funcional.

Podemos redesenhar detalhes depois em tarefa separada.

==================================================
38. DRAG AND DROP DESKTOP
==================================================

PRESERVAR COMPLETAMENTE.

Não trocar biblioteca sem necessidade.

Manter:

- drag entre colunas;
- drag dentro da coluna;
- drag entre turnos;
- reordenação;
- regras de destino;
- restrições;
- estados.

O novo CSS não pode quebrar hitboxes.

==================================================
39. DRAG MOBILE
==================================================

PRESERVAR COMPLETAMENTE.

Manter:

- segurar 300ms;
- alça dedicada;
- drag imediato pela alça;
- auto-scroll vertical;
- auto-scroll horizontal;
- movimentação entre colunas;
- turnos.

Não modificar thresholds sem necessidade.

Não substituir por HTML5 drag padrão no celular.

==================================================
40. MOVER PARA...
==================================================

Preservar alternativa ao drag.

Menu:

Mover para...

continua funcionando.

Se destino for Hoje dividido:

continua pedindo/permitindo turno.

==================================================
41. MOBILE
==================================================

Preservar integralmente a estratégia mobile existente:

- colunas ~85vw;
- uma coluna por vez;
- scroll snap;
- setas;
- seletor de coluna;
- Visão geral;
- touch drag;
- auto-scroll.

Adapte apenas o novo design.

Não sacrificar usabilidade mobile para copiar desktop.

==================================================
42. VISÃO GERAL
==================================================

Preservar a funcionalidade existente.

Apenas atualizar estilo do botão e da visualização, se necessário.

Não recriar lógica.

==================================================
43. MENU LATERAL RECOLHÍVEL
==================================================

Preservar comportamento atual.

No desktop/notebook:

continua podendo ser recolhido para ampliar o espaço do Kanban.

O novo layout precisa funcionar nos dois estados.

==================================================
44. PERMISSÕES
==================================================

PRESERVAR 100%.

DONO DO WORKSPACE

Acesso completo conforme hoje.

GESTOR DO PROJETO

Mantém exatamente os poderes atuais.

MEMBRO

Mantém exatamente as limitações atuais.

Não fazer autorização apenas por esconder botão.

Backend/server/RLS continuam sendo fonte real de segurança.

==================================================
45. CRIAÇÃO DE PROJETO COM IA
==================================================

Não alterar.

Embora não esteja diretamente nesta tela:

não quebrar o fluxo que cria cartões no projeto.

Preservar:

- manual;
- Planejar com IA;
- texto;
- voz;
- Gemini;
- revisão;
- seleção;
- checklist;
- rate limit;
- criação em Tarefas.

Nenhuma mudança necessária nesta tarefa.

==================================================
46. DENSIDADE VISUAL
==================================================

A tela atual é muito densa.

No redesign:

aumente hierarquia sem desperdiçar espaço.

Use:

- espaçamento consistente;
- gaps menores dentro da coluna;
- gaps maiores entre grandes áreas;
- padding consistente;
- tipografia em níveis claros.

O quadro ainda precisa caber bem em notebooks.

Não aumentar tudo indiscriminadamente.

==================================================
47. CARDS
==================================================

Use aproximadamente:

border-radius moderado;
borda sutil;
background mais claro que a coluna;
hover discreto;
active state claro.

A alça deve continuar visível.

Menus continuam acessíveis.

==================================================
48. CORES DE ESTADO
==================================================

Cor deve significar algo.

AZUL

interface / neutro / ação.

VERDE

concluído / sucesso.

ÂMBAR

atenção / próximo de vencer / metade do foco.

VERMELHO

P1 crítica / vencido / timer expirado.

Não usar vermelho como decoração.

==================================================
49. THEME SWITCHER
==================================================

Preservar controles de tema existentes.

Não quebrar tema claro se existir.

O mockup representa tema escuro.

Implemente primeiro com alta fidelidade no tema escuro, preservando compatibilidade com os demais temas já existentes.

==================================================
50. RESPONSIVIDADE DESKTOP
==================================================

A referência visual é aproximadamente 16:9.

O layout deve funcionar em:

1280px
1366px
1440px
1600px
1920px+

As colunas devem poder realizar scroll horizontal quando necessário.

Não espremer cinco colunas em larguras inúteis.

==================================================
51. ALTURA DO QUADRO
==================================================

O cabeçalho redesenhado não pode consumir tanta altura a ponto de prejudicar o Kanban.

Compacte cuidadosamente:

título;
progresso;
ações;
context strip;
toolbar.

O quadro deve continuar sendo protagonista.

==================================================
52. SCROLL
==================================================

Revisar:

scroll horizontal do quadro;
scroll vertical;
scroll interno de coluna;
scroll durante drag.

Não permitir que a nova estrutura quebre auto-scroll.

==================================================
53. PERFORMANCE
==================================================

Não adicionar dependências pesadas apenas para estilização.

Não refazer o Kanban inteiro.

Não adicionar animações custosas.

Evitar re-render das colunas inteiras sem necessidade.

Preservar otimizações existentes.

==================================================
54. ESTADOS DE LOADING
==================================================

Adaptar visualmente os estados atuais.

Se houver skeleton:

redesenhar para combinar.

Não criar spinner que bloqueie a página inteira se não for necessário.

==================================================
55. ESTADOS VAZIOS
==================================================

Melhorar apenas visualmente.

Exemplo Hoje/Manhã:

Nenhuma tarefa para manhã

+ Adicionar tarefa para manhã

Não alterar regras.

==================================================
56. ACESSIBILIDADE
==================================================

Preservar e melhorar:

- navegação por teclado;
- focus-visible;
- contraste;
- aria-label;
- botões reais;
- tooltips;
- hit area adequada.

Não fazer cards clicáveis usando div sem semântica quando já houver componente apropriado.

==================================================
57. NÃO CRIAR NOVAS MIGRATIONS
==================================================

Este redesign não deveria exigir mudança de banco.

Não criar migration apenas para layout.

Se você achar que precisa mudar schema:

PARE.

Revise a solução.

Só seria aceitável se encontrar uma necessidade funcional preexistente indispensável, o que não é objetivo desta tarefa.

==================================================
58. NÃO ALTERAR BACKEND SEM NECESSIDADE
==================================================

Esta tarefa deve ser predominantemente:

- JSX/TSX;
- componentes;
- CSS/Tailwind/design system;
- layout;
- organização visual.

Não modificar APIs se não for estritamente necessário.

Não alterar lógica de negócio para facilitar o layout.

==================================================
59. NÃO REFAZER O DESIGN SYSTEM INTEIRO
==================================================

Use o que existe.

Se necessário:

crie poucos tokens adicionais de superfície e estado.

Não transforme essa tarefa em redesign global do Gaiamum.

==================================================
60. NÃO INVENTAR DADOS
==================================================

Os dados exibidos na imagem são ilustrativos.

A aplicação deve continuar usando os dados reais.

Não hardcode:

18;
28;
64%;
5;
1;
18:42;
eventos;
tarefas;
compromissos;
valores.

==================================================
61. FIDELIDADE AO MOCKUP
==================================================

Depois de implementar:

abra a página real.

Compare lado a lado com a imagem aprovada.

Revise:

- largura sidebar;
- posição do título;
- barra de progresso;
- botões;
- strip;
- toolbar;
- largura Compromissos;
- largura Hoje;
- largura Tarefas;
- largura Em Desenvolvimento;
- largura Concluído;
- cards;
- cores;
- tipografia;
- gaps;
- bordas;
- alturas.

Não aceite o primeiro resultado apenas porque "funciona".

Faça ajustes visuais até ficar realmente próximo.

==================================================
62. TESTES DE REGRESSÃO OBRIGATÓRIOS
==================================================

Após o redesign, testar manualmente e/ou automaticamente:

1. abrir projeto;
2. criar cartão;
3. editar cartão;
4. mover cartão entre colunas;
5. mover dentro da mesma coluna;
6. Hoje → Manhã;
7. Hoje → Tarde;
8. Hoje → Noite;
9. ativar/desativar turnos;
10. criar coluna;
11. renomear coluna;
12. reordenar coluna;
13. excluir coluna vazia;
14. impedir excluir coluna com cartão;
15. impedir alterar Concluído;
16. mostrar/ocultar Concluído;
17. mover cartão para Em Desenvolvimento;
18. escolher Sem alarme;
19. escolher timer;
20. timer 50%;
21. timer expirado;
22. renovar timer;
23. encerrar timer;
24. tentar segundo timer;
25. sair de Em Desenvolvimento;
26. abrir cartão;
27. prioridade;
28. datas;
29. marco;
30. aguardando;
31. financeiro;
32. checklist;
33. anexo;
34. membros;
35. labels;
36. comentários;
37. menções;
38. histórico;
39. desktop drag;
40. mobile drag;
41. long press;
42. alça;
43. auto-scroll;
44. Mover para;
45. Visão geral;
46. scroll snap;
47. setas mobile;
48. seletor mobile;
49. Páginas;
50. Visão 360°;
51. Decisões;
52. Indicadores;
53. Freeze;
54. Configurações;
55. Google Calendar;
56. contas a pagar;
57. Hoje/Amanhã;
58. permissões de dono;
59. permissões de gestor;
60. permissões de membro.

Nenhuma regressão funcional é aceitável.

==================================================
63. CRITÉRIO PRINCIPAL DE ACEITE
==================================================

A comparação final deve ser:

ANTES:

mesmas funcionalidades + interface atual.

DEPOIS:

mesmas funcionalidades + interface aprovada.

Não quero:

"ficou parecido".

Quero:

"o mockup aprovado virou a interface real".

==================================================
64. PRINCÍPIOS DE PRODUTO
==================================================

O Kanban é o ambiente de execução do Gaiamum.

Ele não deve parecer uma cópia do Trello.

A interface deve enfatizar:

contexto;
prioridade;
foco;
execução;
progresso.

A hierarquia visual deve ajudar o usuário a responder rapidamente:

O que tenho hoje?

O que está na fila?

No que estou trabalhando agora?

O que já concluí?

Existe compromisso ou vencimento hoje?

==================================================
65. RESTRIÇÕES DE ESCOPO
==================================================

NÃO:

- implementar novo motor de IA;
- alterar Financeiro;
- alterar Agenda;
- redesenhar outras páginas;
- mudar banco;
- trocar biblioteca DnD sem necessidade;
- alterar autenticação;
- alterar permissions model;
- criar novo sistema de tarefas;
- criar novo timer;
- reescrever backend.

SIM:

- reorganizar layout;
- componentizar melhor quando seguro;
- melhorar hierarquia;
- melhorar responsividade;
- melhorar legibilidade;
- melhorar estados visuais;
- melhorar consistência;
- aproximar exatamente do mockup.

==================================================
66. ENTREGA FINAL
==================================================

Ao concluir, entregue um resumo objetivo contendo:

1. arquivos alterados;
2. componentes criados;
3. componentes reaproveitados;
4. funcionalidades testadas;
5. qualquer ajuste necessário para mobile;
6. confirmação explícita de que as regras de negócio não foram alteradas;
7. screenshot final da tela desktop;
8. screenshot final mobile;
9. comparação visual com o mockup;
10. quaisquer limitações reais encontradas.

==================================================
67. FLUXO DE EXECUÇÃO
==================================================

Execute nesta ordem:

AUDITAR
↓
MAPEAR COMPONENTES EXISTENTES
↓
PRESERVAR LÓGICA
↓
REORGANIZAR ESTRUTURA VISUAL
↓
APLICAR DESIGN
↓
TESTAR DESKTOP
↓
TESTAR MOBILE
↓
TESTAR DRAG
↓
TESTAR TIMER
↓
TESTAR PERMISSÕES
↓
TESTAR TODAS AS FUNCIONALIDADES
↓
COMPARAR COM MOCKUP
↓
REFINAR VISUAL
↓
ENTREGAR

==================================================
REGRA FINAL
==================================================

Use o mockup anexado como contrato visual.

Use o código atual como contrato funcional.

Não sacrifique um pelo outro.

O resultado correto é:

Fidelidade visual ao novo layout
+
100% de preservação funcional do Kanban atual
+
nenhuma regressão de desktop ou mobile.

Implemente, rode, valide, teste e refine antes de considerar a tarefa concluída.
