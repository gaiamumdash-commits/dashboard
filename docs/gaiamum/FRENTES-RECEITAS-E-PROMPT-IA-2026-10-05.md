# Próximas frentes — Receitas e Planejamento por prompt copiável

**Dado pelo Fabio em 2026-10-05** (sessão #71), pra começar numa sessão nova
depois do `/clear`. Proposta refinada abaixo; as **decisões em aberto** no fim
de cada frente precisam da resposta do Fabio antes de codar.

---

## Frente 1 — Receitas no dashboard

**Pedido**: incluir um campo pra receitas, que hoje não existe.

**Estado atual (confirmado no código)**: o Financeiro (`contas_a_pagar`) só
modela SAÍDAS. No Painel geral, `calcularFinanceiroDoMes` (`painel-geral.ts`)
já tem `entradas`, mas ela vale sempre 0 (o valor real, porque não existe
receita cadastrada). "Saldo previsto" e "Comprometido" já usam `entradas` nas
fórmulas. Ou seja, a tela já está pronta pra receber o número; falta a origem
do dado.

**Proposta**:
- Tabela nova `receitas`, espelhando `contas_a_pagar`: descrição, valor,
  data prevista, data recebida, status (`prevista` | `recebida`), projeto
  opcional e categoria opcional. RLS owner-only, igual a `contas_a_pagar`.
- Tela dentro do Financeiro existente: aba ou seção "Receitas", com o mesmo
  padrão visual das contas a pagar. Nada de módulo novo.
- `calcularFinanceiroDoMes` passa a somar as receitas do mês. A regra de
  "Comprometido" (entradas = 0 e saídas > 0 → 100%) continua valendo.
- Receita é rara e variável pro Fabio (fechar trabalho com cliente, venda via
  tráfego pago), então o cadastro tem que ser rápido: 3 campos obrigatórios
  (descrição, valor, data) e o resto opcional.
- Migration nova aplicada pelo Fabio no SQL Editor (mesmo fluxo de sempre),
  com teste de integração da RLS.

**Decisões em aberto**:
1. Receita recorrente (ex.: mensalidade de cliente) entra agora ou depois?
   Sugestão: depois.
2. Ligar a receita a um projeto (pra ver retorno por projeto) entra agora?
   Sugestão: só o campo opcional agora; relatório por projeto depois.

---

## Frente 2 — "Planejar com IA" por prompt copiável

**Pedido do Fabio, resumido**: em vez de a IA rodar dentro do Gaiamum, gerar
um prompt muito bem feito que a pessoa copia com 1 clique e cola na IA
preferida (ou numa gratuita). A IA faz engenharia reversa do objetivo,
pergunta o contexto (indicadores, pessoas, prazos, recursos,
responsabilidades) e devolve tarefas e recomendações (dados sensíveis, quem
convidar, se cria outro quadro, em que momento). A pessoa cola o resultado
num campo do Gaiamum, marca as tarefas que fazem sentido e confirma; elas vão
pra coluna "Tarefas". Recomendações ficam salvas numa página, e os cartões
com lembretes ajustáveis com alarme. Simples, barato, alto valor.

### O que já existe (não refazer)

`src/lib/ecc/planejamento-ia.ts` + `planejamento-ia-actions.ts` +
`formulario-novo-projeto.tsx`: ao criar um projeto, a pessoa descreve o
objetivo, o Gemini devolve JSON com até 20 sugestões (essencial/opcional +
checklist) ou até 3 perguntas, e a prévia permite marcar, editar e confirmar
antes de gravar. Tem rate limit (`ia_registrar_tentativa`, migration 0046) e
validação zod da resposta. **A prévia, a seleção, o saneamento e a criação
em lote são reaproveitados 100%.** Muda só a origem da resposta.

### Decisão do Fabio (mesma sessão, depois da proposta)

> "se não tiver IA ou ficar caro, porque tem dado erro direto, pode só gerar
> o prompt e a pessoa copia e cola em sua IA preferida e você cria um campo
> para colar a resposta e trabalhar ela nos cartões e sugestões no
> calendário e nas colunas etc"

Consequências pra proposta abaixo:
- **O prompt copiável (caminho B) é o caminho PRINCIPAL**, não um extra. Ele
  funciona sem nenhuma IA no servidor.
- O Gemini interno (caminho A) só continua se for barato e estável. A IA
  interna "tem dado erro direto", então **investigar a causa do erro atual
  é parte do início da frente** (rate limit? cota da chave? modelo?). Se
  não houver correção barata, o caminho A sai da tela. Se ficar, qualquer
  erro dele cai automaticamente no caminho B ("A IA daqui não respondeu,
  copie o prompt e use a sua"), nunca num beco sem saída.
- O resultado colado alimenta, além dos cartões:
  - **Calendário**: compromissos sugeridos (reuniões de alinhamento,
    revisões de marco, prazos) aparecem na prévia como itens de Agenda
    selecionáveis, criados só se marcados, pelo fluxo de Agenda que já
    existe (que sincroniza com o Google quando conectado). Data e hora só
    se a pessoa informou na conversa; senão o item vem sem data e a prévia
    pede pra escolher.
  - **Colunas**: a IA pode sugerir colunas extras de fluxo (ex.: "Aguardando
    aprovação"), mostradas como sugestão selecionável. As colunas fixas e
    regras atuais (Concluído, Hoje, Em Desenvolvimento/Foco, nova coluna
    nascendo depois de Hoje) não mudam. Cada tarefa pode indicar a coluna
    sugerida; sem coluna válida, vai pra "Tarefas".
- Com isso o bloco `===GAIAMUM===` ganha `compromissos` e `colunas`
  (opcionais), ao lado de `tarefas`, `marcos` e `recomendacoes`.

### Visão de sócio (produto, gestão de projetos, IA)

**1. Os dois caminhos convivem; não é trocar um pelo outro.**
- **Caminho A, "Fazer aqui mesmo"** (o que já existe): rápido e sem atrito,
  bom pra quem não tem IA nem paciência. Custo: Gemini Flash, já com teto
  por usuário.
- **Caminho B, "Planejar a fundo na sua IA"** (novo): custo zero pro
  Gaiamum, e a pessoa ganha uma **conversa** de verdade (vários turnos,
  ajustes, "e se..."), coisa que o fluxo de 3 perguntas não oferece. É aí que
  entra a parte de alto valor: engenharia reversa, contexto, pessoas e
  riscos.
- Isso protege o usuário iniciante (A) sem limitar o experiente (B), e
  segura o custo: quem quer profundidade usa a própria IA.

**2. O prompt conduz uma entrevista curta antes de planejar.** A IA pergunta
em blocos (no máximo 5 a 7 perguntas por rodada, nunca um formulário de 30
itens): objetivo e como saber que deu certo (indicador), prazo final e
marcos, quem está envolvido e o papel de cada um, recursos e orçamento,
restrições e o que NÃO fazer. Depois faz a engenharia reversa (resultado →
marcos → tarefas → checklist) e só então gera o bloco final.

**3. O resultado volta num formato que o app lê sem erro.** IAs de chat
enfeitam a resposta (markdown, comentários, cercas ```json). O prompt pede
que o bloco final venha entre marcadores fixos:

```
===GAIAMUM-INICIO===
{ ...JSON... }
===GAIAMUM-FIM===
```

O parser pega só o que está entre os marcadores, tolera cerca de código e
texto em volta, e passa pelo MESMO saneamento zod de hoje
(`interpretarRespostaBrutaIA`, estendido). Se a pessoa colar a conversa
inteira, ainda funciona. Se o formato vier quebrado, a mensagem é amigável:
"Peça pra sua IA: *gere de novo só o bloco GAIAMUM*". Fica um botão que copia
essa frase.

**4. O que o bloco traz** (sempre opcional além das tarefas):
- `tarefas`: título, descrição, essencial/opcional, checklist, marco ao qual
  pertence, prazo relativo ("semana 2") ou data **só se a pessoa informou na
  conversa**, e responsável sugerido **só por papel** ("financeiro",
  "designer"), nunca por nome inventado.
- `marcos`: as grandes etapas, que viram cartões marcados como Marco (o
  campo já existe no Kanban).
- `recomendacoes`: dados sensíveis, quem convidar e quando, se vale outro
  quadro, riscos e indicadores sugeridos.

**5. Pra onde vai cada coisa:**
- Tarefas marcadas → coluna "Tarefas", em lote, como hoje.
- Recomendações → uma **Página do projeto** criada automaticamente
  ("Plano inicial — recomendações da IA"). Páginas já existem em
  `/projetos/[id]/paginas`.
- Prazos → o prazo relativo vira data a partir do dia da importação, **e a
  pessoa vê e pode ajustar na prévia antes de confirmar**.
- Lembretes → cada cartão com prazo ganha o alarme padrão (tabela `alarmes`,
  que já existe), ajustável no próprio cartão como hoje. Na prévia, um seletor
  único "Lembrar: 1 dia antes / 2h antes / sem lembrete" vale pra todos.
  Ajuste fino depois, cartão a cartão.
- Convites → **nunca automáticos**. A recomendação "convidar fulano (papel X)
  na fase Y" vira um cartão "Convidar [papel] para o quadro" com link pro
  fluxo de equipe que já existe. Quem decide e envia é a pessoa.

**6. Segurança e privacidade:**
- **Antes de copiar o prompt**, um aviso curto e visível: "Não cole dados
  sensíveis (CPF, senhas, dados bancários, saúde, dados de clientes) na IA
  externa. Use papéis no lugar de nomes, se preferir." O prompt também
  instrui a IA a avisar se a pessoa colar algo sensível.
- O prompt gerado **não leva nenhum dado do banco**, só o que a pessoa
  digitou no campo do objetivo. Nada de nome de membros, e-mails ou finanças.
- O texto colado de volta é **dado não confiável**: tamanho máximo, zod,
  truncamento, renderizado como texto puro (nunca HTML/markdown executável),
  links não clicáveis na prévia. A página de recomendações salva texto, não
  HTML.
- Nada é gravado antes do clique em "Confirmar".

**7. Experiência (UX):**
- Na criação de projeto: abas "Fazer aqui" | "Na minha IA".
- "Na minha IA" em 3 passos numerados na mesma tela:
  ① descreva o objetivo em 1 a 3 frases → **[Copiar prompt]** (com feedback
  "Copiado!"), mais atalhos "Abrir no ChatGPT / Gemini / Claude" (apenas
  links, sem integração);
  ② converse com a IA e responda as perguntas dela;
  ③ cole aqui a resposta final → prévia com seleção.
- A mesma ação também deve existir **dentro de um projeto já criado** (menu
  ⋯ do projeto: "Planejar com IA"), não só no nascimento do projeto. Planejar
  de novo no meio do caminho é um caso comum.
- Estado salvo localmente (rascunho do texto colado), pra não perder ao
  trocar de aba indo copiar da IA, que é o caso mais comum no celular.

**8. Economia**: o caminho B tem custo zero de IA pro Gaiamum. O caminho A
continua com teto. Como bônus, o caminho B não depende do Gemini estar no ar.

### Fases sugeridas
- **Fase 1 (MVP)**: prompt copiável, aviso de dados sensíveis, campo de
  colar, parser com marcadores, prévia/seleção existente, tarefas e marcos na
  coluna Tarefas. Vale na criação e dentro do projeto.
- **Fase 2**: recomendações salvas em Página; prazos relativos → datas
  ajustáveis na prévia; alarme padrão por cartão; compromissos sugeridos na
  Agenda; colunas sugeridas.
- **Fase 3**: cartões de "Convidar [papel]" ligados ao fluxo de equipe;
  sugestão de quadro separado.

### Decisões em aberto (perguntar ao Fabio)
1. ~~Manter o caminho A ao lado do B?~~ **Decidido**: B é o principal; A só
   se a investigação do erro atual mostrar que dá pra mantê-lo barato e
   estável (ver "Decisão do Fabio" acima).
2. Qual IA gratuita indicar nos atalhos? Sugestão: ChatGPT, Gemini e Claude,
   todos com plano gratuito, só como links.
3. Fase 1 sozinha já pode ir pra produção? Sugestão: sim; ela já entrega o
   núcleo de valor.
