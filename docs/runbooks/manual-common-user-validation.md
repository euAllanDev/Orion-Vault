# Orion Vault Manual Common User Validation

## Objetivo
Executar uma validacao manual curta, repetivel e orientada a bugs do fluxo principal do usuario comum, sem depender do modo dev.

## Quando usar
- depois de uma rodada de implementacao do fluxo manual
- antes de chamar a build de `teste fechado com usuario`
- sempre que houver mudancas em setup, workspace, agenda, dashboard ou graph

## Resultado esperado
Ao final desta rodada, o time deve conseguir responder com evidencia:
- o usuario consegue entrar no produto sem ajuda?
- o usuario consegue criar, editar, renomear e mover notas sem friccao grave?
- agenda, dashboard e graph estao usaveis o bastante para teste?
- os bugs restantes ja estao classificados por severidade?

## Preparacao
- usar uma build local atualizada
- garantir que `pnpm typecheck`, `pnpm test` e `pnpm build` passaram antes da rodada
- fechar qualquer terminal ou processo antigo do desktop
- preparar um vault limpo para a rodada

## Vault recomendado para a rodada
Criar ou usar um vault de teste com estes artefatos minimos ao longo da sessao:
- uma pasta `Inbox/`
- uma pasta `Projetos/`
- pelo menos 2 notas markdown comuns
- pelo menos 1 nota de agenda

## Como registrar resultado
Para cada passo, marcar um destes estados:
- `passou`
- `passou com ressalva`
- `falhou`

## Proximo passo explicito
- esta validacao manual existe para substituir suposicao por evidencia de uso real
- ao terminar a rodada, o proximo passo deve ser sempre um destes:
1. corrigir bloqueadores
2. corrigir itens importantes
3. declarar que o fluxo comum esta pronto para teste fechado

## Sugestao da IA
- nao use esta rodada para descobrir novas features
- use esta rodada para descobrir atrito, confusao, perda de confianca e bugs de fluxo
- se um problema nao impedir a tarefa principal, classifique como `importante` ou `pos-teste` em vez de reabrir escopo cedo demais

Para cada falha, registrar:
- passo
- comportamento observado
- comportamento esperado
- severidade

## Severidade
- `bloqueador`: impede o fluxo principal ou passa sensacao de produto quebrado
- `importante`: o fluxo termina, mas com confusao, atrito forte ou risco percebido
- `pos-teste`: detalhe menor, cosmetic ou refinamento sem impacto direto na tarefa

## Bloco 1: Entrada no produto

### Objetivo
Validar que o usuario entende como entrar e abrir/criar um vault.

### Passos
1. Abrir o desktop pelo fluxo normal.
2. Confirmar branding `Orion Vault` no app.
3. Confirmar que a tela inicial deixa claro o estado atual do vault.
4. Se o vault ainda nao existir, confirmar que a UI sugere `Criar vault` ou `Abrir ou criar vault`.
5. Iniciar o vault pelo proprio app.
6. Confirmar que o workspace abre sem parecer quebrado.

### Falhas que sao bloqueadoras
- app nao abre
- vault nao pode ser criado/aberto pelo app
- UI parece pronta mas nada funciona
- mensagem de setup e confusa ou enganosa a ponto de travar a rodada

## Bloco 2: Navegacao basica

### Objetivo
Validar que o usuario entende a estrutura principal sem precisar da IA.

### Passos
1. Verificar se `Home`, `Vault`, `Agenda` e `Relações` aparecem com nomes claros.
2. Entrar no `Vault`.
3. Confirmar que a area de arvore, editor e painel auxiliar aparecem de forma legivel.
4. Trocar entre `Home`, `Vault` e `Agenda` sem quebrar layout.
5. Reduzir a janela e verificar legibilidade minima.

### Falhas importantes
- layout quebra com facilidade
- navegacao fica ambigua
- usuario nao entende onde esta o editor principal

## Bloco 3: Criacao manual de conteudo

### Objetivo
Validar a tarefa mais basica: criar pasta e nota sem friccao grave.

### Passos
1. Criar uma pasta `Inbox/`.
2. Confirmar feedback visual de sucesso.
3. Criar uma nota apenas pelo titulo dentro da pasta ativa.
4. Confirmar que a nota abre automaticamente no editor.
5. Confirmar que o status do editor deixa claro que ha uma nota ativa.
6. Criar uma segunda pasta `Projetos/`.

### Falhas que sao bloqueadoras
- nao consegue criar pasta
- nao consegue criar nota pelo fluxo principal
- nota criada nao aparece no workspace

## Bloco 4: Edicao e salvamento

### Objetivo
Garantir que escrever e salvar nao gera inseguranca.

### Passos
1. Digitar conteudo novo na nota criada.
2. Confirmar que o indicador de rascunho muda de estado.
3. Salvar manualmente.
4. Confirmar feedback claro de sucesso.
5. Editar novamente e esperar autosave.
6. Confirmar feedback claro de autosave concluido.
7. Trocar de nota e voltar.
8. Confirmar que o conteudo foi preservado.

### Falhas que sao bloqueadoras
- perda de conteudo
- salvar parece nao funcionar
- autosave sobrescreve ou perde texto

## Bloco 5: Renomear e mover

### Objetivo
Validar operacoes basicas de organizacao manual.

### Passos
1. Renomear a nota atual.
2. Confirmar que a nota continua aberta apos renomear.
3. Mover a nota para `Projetos/`.
4. Confirmar que a nota continua acessivel apos mover.
5. Confirmar que arvore e breadcrumbs refletem o novo caminho.

### Falhas que sao bloqueadoras
- renomear falha ou perde a nota
- mover falha ou duplica/perde conteudo

## Bloco 6: Estados vazios e mensagens

### Objetivo
Validar que o produto explica o que falta fazer.

### Passos
1. Ir para um estado sem nota selecionada.
2. Verificar se o editor e o painel auxiliar mostram mensagens compreensiveis.
3. Verificar se botoes de nota ficam desabilitados sem contexto.
4. Verificar se backlinks, relacoes e previews pedem selecao de nota quando necessario.

### Falhas importantes
- botoes ativos sem contexto util
- mensagens vazias que parecem bug
- painel auxiliar silencioso demais

## Bloco 7: Agenda

### Objetivo
Validar a superficie de agenda para uso comum.

### Passos
1. Abrir `Agenda`.
2. Criar uma nota de agenda futura.
3. Confirmar que a nota aparece na lista.
4. Confirmar que nao ha notificacao incoerente para item futuro.
5. Alternar filtros da agenda.
6. Abrir a nota de agenda criada.

### Falhas bloqueadoras
- nao consegue criar nota de agenda
- agenda quebra ou nao lista itens
- notificacao local errada para caso simples

## Bloco 8: Dashboard e graph

### Objetivo
Validar se a visualizacao esta usavel o bastante para teste.

### Passos
1. Ir para `Home` e navegar os cards principais.
2. Confirmar que o dashboard nao quebra nem trava.
3. Abrir `Relações`.
4. Abrir o graph local de uma nota.
5. Confirmar que a janela nao crasha e que a leitura geral e possivel.

### Regra pratica
- se o graph estiver funcional mas ainda confuso, classificar como `importante` ou `pos-teste`
- se o graph crashar a janela ou travar a sessao, classificar como `bloqueador`

## Bloco 9: Encerramento da rodada

### Perguntas finais
1. O usuario comum conseguiria repetir esse fluxo sem ajuda do time?
2. Algum passo gerou sensacao de risco sobre perda de conteudo?
3. Algum estado pareceu bug mesmo quando o sistema estava tecnicamente correto?
4. Existe algum bloqueador aberto para teste fechado com usuario?

### Saida esperada
- lista de bugs classificados em `bloqueador`, `importante` e `pos-teste`
- decisao: `pronto para teste fechado` ou `precisa de mais uma rodada`

## Modelo curto de registro

```md
Data:
Build:
Executor:

Bloco 1: passou | passou com ressalva | falhou
Bloco 2: passou | passou com ressalva | falhou
Bloco 3: passou | passou com ressalva | falhou
Bloco 4: passou | passou com ressalva | falhou
Bloco 5: passou | passou com ressalva | falhou
Bloco 6: passou | passou com ressalva | falhou
Bloco 7: passou | passou com ressalva | falhou
Bloco 8: passou | passou com ressalva | falhou

Bugs:
- [severidade] passo - observado - esperado

Decisao final:
- pronto para teste fechado
- precisa de mais uma rodada
```
