# Planner V1 — Checklist de QA manual

Pré-requisito: migration `0057_planner.sql` aplicada no ambiente testado. Use **duas contas** (A e B) no **mesmo workspace**: B convidada por A com acesso completo.

## Menu e navegação
- [ ] "Planner" aparece no menu, logo abaixo de Agenda (desktop e celular).
- [ ] Clicar na setinha abre e fecha o grupo: Meu Planner, Pessoal, Estudos, Casa, Saúde.
- [ ] Em qualquer tela /planner o grupo já vem aberto, e o subitem da tela atual fica destacado ("Meu Planner" não acende em /planner/pessoal).
- [ ] Abas do topo (Visão geral, Pessoal, Estudos, Casa, Saúde) e sub-abas de cada área navegam e marcam a aba ativa.
- [ ] /planner/financeiro mostra "página não encontrada".

## Primeiro acesso (conta sem nada no Planner)
- [ ] Aparece "Seu Planner ainda está vazio." com as 4 áreas para escolher.
- [ ] Os cards de área mostram convite ("Nada aqui ainda"), nunca números inventados.
- [ ] "Criar meu primeiro hábito" cria o hábito, e as boas-vindas somem.
- [ ] Numa conta nova, "Começar sem criar nada" faz as boas-vindas sumirem; as áreas escolhidas vêm primeiro nos cards.

## Meu Planner
- [ ] A saudação muda conforme o horário (Bom dia / Boa tarde / Boa noite) e usa o nome do e-mail da conta logada.
- [ ] O "Foco de hoje" mostra até 3 pendências de hoje (compromisso primeiro). Marcar tira o item do foco.
- [ ] "Hoje" lista rotinas, compromissos do Planner e itens da Agenda (Google, tarefa com prazo, conta) em ordem de horário. Item de outro módulo tem só o link (↗), sem caixinha.
- [ ] "Ver agenda" abre /agenda.
- [ ] "Adicionar atividade de hoje" cria um compromisso, que aparece no "Hoje" e na Agenda.
- [ ] "Meus hábitos": clicar numa bolinha marca e desmarca. Dia futuro não deixa marcar. Ao recarregar, a marcação continua.
- [ ] "Esta semana": dias com itens, placar N/M concluídos atualiza ao marcar.
- [ ] Os cards de área levam à área. O percentual bate com a conta (feitos ÷ planejados até hoje).
- [ ] "+ Adicionar" → Hábito, Rotina e Compromisso abrem o formulário certo.
- [ ] "Planejar com IA" e "Reorganizar minha semana" aparecem desabilitados, com "Em breve".

## Áreas
- [ ] **Pessoal:** criar rotina com horário (aparece no "Hoje" no dia certo); criar, editar, arquivar, reativar e excluir hábito; objetivo com prazo (status muda; prazo vencido em amarelo); Metas SMART aparecem só para leitura; criar, editar e excluir nota.
- [ ] **Estudos:** rotina com duração soma em "estudados na semana" quando marcada; leitura muda de status e o progresso salva ao soltar a barra; curso com link abre em nova aba; idioma com objetivo e frequência.
- [ ] **Casa:** compras (adicionar com categoria, marcar, remover, "Limpar comprados"); cardápio (escrever numa célula e sair do campo salva; apagar o texto limpa); pet + compromisso do pet; manutenção ("Feita hoje" recalcula a próxima pela recorrência; status Atrasada / Em breve / Em dia).
- [ ] **Saúde:** consulta aparece na Agenda (cor lime, rótulo "Planner"); hábitos de bem-estar; objetivos e anotações de bem-estar. Nenhum campo clínico.

## Edição
- [ ] Em cada item (hábito, rotina, compromisso/consulta, leitura, curso, idioma, manutenção, objetivo, pet, nota), "Editar" abre o formulário já preenchido. Salvar atualiza a tela e, ao recarregar, o valor novo continua.
- [ ] Editar data e hora de uma consulta move o item na Agenda.

## Privacidade (obrigatório)
- [ ] B não vê nada do Planner de A: cards, hábitos, compromissos.
- [ ] Na **Agenda** de B, a consulta de A **não** aparece (e vice-versa).
- [ ] O owner (A) não vê o Planner de B.
- [ ] Remover B do workspace: ao voltar, o Planner de B naquele workspace fica vazio.

## Regressão
- [ ] Painel geral, Projetos/Kanban, Agenda (Google, contas, tarefas, decisões), Financeiro, Metas SMART, Marketing, Equipe e Configurações abrem e funcionam como antes.
- [ ] Na Agenda, abrir um item "Planner" não mostra campo de alarme nem botão de excluir e leva à área certa.

## Responsivo e acessibilidade
- [ ] Celular (≈390px): sem rolagem horizontal; abas rolam de lado; ordem saudação → hoje → hábitos → áreas → semana → sugestão.
- [ ] Temas claro, navy e preto legíveis.
- [ ] Teclado: Tab chega nas bolinhas e checkboxes, Espaço marca e desmarca, foco visível.
