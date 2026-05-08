# Spec: desktop shell

## Regra de negócio
O sistema deve fornecer uma aplicação desktop local-first em TypeScript para operar o vault e suas notas sem depender de internet para o fluxo principal.

O shell desktop deve reaproveitar o core local existente e expor a mesma fronteira segura do vault, sem duplicar regras de negócio.

## Regras
1. A aplicação deve ser instalável como app desktop.
2. A aplicação deve funcionar com armazenamento local no dispositivo do usuário.
3. A aplicação deve permitir criar, abrir e validar um vault local.
4. A aplicação deve expor os fluxos de workspace, leitura e organização numa janela desktop.
5. A aplicação não deve exigir banco externo para o MVP.
6. A aplicação não deve exigir internet para criar, abrir, editar ou organizar notas localmente.
7. A aplicação deve preservar a fronteira segura do vault em todas as operações de escrita.
8. O shell desktop deve operar como camada de interface e orquestração sobre a base local existente.
9. O shell desktop deve lembrar o último vault ativo em armazenamento local e reabrir o workspace quando a raiz ainda for válida.
10. A lateral do desktop deve usar ícones minimalistas e mais refinados, sem poluição visual.
11. A tela inicial deve exibir cartões de métricas do vault, resumos de notas e um card rotativo de novidades do projeto.
12. Os modais internos devem ter aparência consistente com o desktop, com melhor alinhamento e foco visual.
13. A interface desktop deve expor um botão para listar os comandos disponíveis em uma visão agrupada por intenção.
14. A interface desktop deve expor uma busca global local sobre notas Markdown do vault ativo.
15. A interface desktop deve permitir selecionar modelos para novas notas e salvar notas como modelos.
16. A interface desktop deve exibir backlinks da nota aberta no painel auxiliar.
17. A interface desktop deve permitir fixar notas e manter essa lista localmente.
18. A interface desktop deve abrir a nota diária local do dia em um fluxo rápido.
19. A interface desktop deve mostrar um graph view local das conexões da nota ativa.
20. O graph view deve permitir zoom e arrastar, e ao selecionar uma pasta deve exibir uma rede local das notas contidas nela.
21. Pastas aninhadas no graph devem aparecer como nós azuis clicáveis que abrem a rede daquele nó.
22. A interface desktop deve expor uma ponte local para IA via CLI, permitindo ler contexto, buscar, planejar e propor ações sobre notas.
23. A ponte de IA via CLI deve usar os mesmos contratos de comandos e respeitar a fronteira segura do vault antes de qualquer escrita.
24. A tela inicial deve mostrar um popup amigável de onboarding da IA com atalho para abrir um terminal local visível no diretório certo.
25. O popup de IA deve manter o fluxo de comandos e a lista de comandos dentro do próprio painel, sem depender de modais aninhados.
26. O launcher de IA deve ficar como um botão flutuante arrastável, começando no canto inferior da tela.

## Pontos de atenção
- O shell desktop deve reaproveitar a lógica atual em vez de reimplementar as regras de negócio.
- A interface deve continuar simples e focada em leitura, organização e ação local.
- A persistência do estado do app deve ser local e mínima.
- Se houver integração com CLI, ela deve ser local e opcional, não uma dependência de rede.
- A IA local deve operar como copiloto de notas via CLI, não como backend remoto.
- O runtime do shell deve ser escolhido sem quebrar a portabilidade da base TypeScript.
- Se o vault lembrado não existir mais, a aplicação deve voltar ao setup.
- A criação e abertura de vault devem usar o campo de caminho da interface como entrada principal.
- A interface desktop deve usar diálogos internos para ações como criar, renomear, mover e informar conteúdo inicial.
- O layout desktop deve privilegiar o encaixe da janela, com espaçamento consistente e leitura confortável.

## Cenários

### Cenário 1: app abre localmente
Given a aplicação desktop instalada
When o usuário inicia o app
Then a janela desktop é exibida
And o app opera sem internet obrigatória

### Cenário 2: vault local é criado
Given nenhum vault ativo
When o usuário informa um caminho local válido
Then o sistema cria ou abre o vault
And grava o estado localmente
And exibe o workspace
And o fluxo principal não depende de prompt modal do navegador

### Cenário 2b: vault lembrado é restaurado
Given um vault foi aberto anteriormente
When a aplicação desktop inicia novamente
Then o sistema restaura o último vault ativo localmente
And abre o workspace se a raiz ainda for válida
And volta ao setup se a raiz não existir mais

### Cenário 5: setup exibe métricas e novidades
Given a aplicação está na tela inicial
When o vault está disponível para leitura
Then a interface exibe cartões de métricas do vault
And mostra um card rotativo com novidades do projeto

### Cenário 6: comandos ficam visíveis no desktop
Given a aplicação desktop está aberta
When o usuário aciona o botão de comandos
Then o sistema exibe uma lista agrupada dos comandos disponíveis
And cada comando aparece com uso e intenção

### Cenário 7: busca global encontra notas
Given um vault ativo com notas Markdown
When o usuário aciona a busca global e informa critérios
Then o sistema lista os resultados localmente
And permite abrir uma nota diretamente a partir do resultado

### Cenário 8: modelos aceleram a criação
Given o vault possui modelos salvos em `Templates/`
When o usuário escolhe um modelo para uma nova nota
Then a nova nota usa o conteúdo do modelo como base
And o usuário pode salvar a nota aberta como novo modelo

### Cenário 9: backlinks aparecem no painel auxiliar
Given uma nota aberta com links de entrada
When a nota é carregada no workspace
Then o painel auxiliar exibe as notas que apontam para ela

### Cenário 10: notas fixadas ficam disponíveis
Given uma nota aberta no workspace
When o usuário a fixa
Then a nota aparece na lista local de fixadas
And o estado permanece após reabrir o desktop

### Cenário 11: nota diária abre rápido
Given o usuário quer registrar a captura do dia
When ele aciona a nota diária
Then o sistema abre ou cria a nota local do dia
And leva o usuário diretamente para edição

### Cenário 12: graph view local
Given uma nota ativa com conexões
When o usuário abre o graph view
Then a interface mostra os nós relacionados localmente
And permite abrir uma nota clicando em um nó

### Cenário 13: graph de pasta
Given uma pasta selecionada no workspace
When o usuário abre o graph view
Then a interface mostra as notas contidas na pasta em uma rede local
And o usuário pode arrastar e aplicar zoom no grafo

### Cenário 14: pasta aninhada como nó
Given uma pasta com subpastas no graph view
When o usuário clica em uma subpasta azul
Then a interface abre a rede local daquela subpasta
And mostra as notas contidas nela

### Cenário 15: IA via CLI acessa notas
Given uma IA local operando via CLI
When ela pede contexto de uma nota ou executa uma busca/planejamento
Then o sistema entrega dados locais da nota e do vault
And qualquer escrita proposta passa pela validação de segurança

### Cenário 16: onboarding da IA na tela inicial
Given a aplicação inicia na tela inicial
When o usuário vê o popup de IA
Then a interface explica o fluxo slash-command
And o usuário consegue abrir um terminal local visível pronto para uso

### Cenário 17: launcher flutuante
Given a aplicação desktop está aberta
When o usuário arrasta o launcher de IA
Then o botão flutuante pode ser reposicionado livremente
And o estado visual permanece simples e acessível

### Cenário 18: comandos embutidos no popup
Given o popup de IA está aberto
When o usuário aciona "Ver comandos"
Then a lista agrupada de comandos aparece dentro do próprio painel
And o usuário pode esconder essa lista sem fechar o popup

### Cenário 3: notas são salvas no dispositivo
Given um vault ativo
When o usuário cria ou edita uma nota
Then o conteúdo é salvo no filesystem local
And o usuário não depende de armazenamento remoto

### Cenário 4: fronteira do vault é preservada
Given uma operação de escrita no desktop
When o usuário tenta sair da raiz do vault
Then a operação é rejeitada
And nenhum arquivo fora do vault é alterado
