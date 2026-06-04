# Spec: editor writing

## Regra de negócio
O editor da vault desktop deve acelerar a escrita de notas Markdown com comandos inline e atalhos locais, preservando o conteúdo textual do vault como fonte principal.

## Regras
1. O editor deve abrir um menu de slash commands ao detectar `/` em contexto de comando no início da linha atual.
2. Os slash commands devem cobrir pelo menos heading, checklist, lista simples, citação, bloco de código, divisor e inserção de data.
3. O editor deve abrir sugestões de notas ao detectar `@` em contexto de menção dentro da nota atual.
4. A escolha de uma menção deve inserir um link Markdown local para a nota do vault ativo, sem depender de rede.
5. O editor deve permitir navegar pela lista de sugestões com teclado.
6. O editor deve permitir confirmar uma sugestão com `Enter` ou `Tab` e cancelá-la com `Escape`.
7. O editor deve continuar automaticamente listas, listas numeradas e checklists ao pressionar `Enter`.
8. Quando a linha atual contiver apenas o marcador de lista ou checklist vazio, `Enter` deve encerrar a lista em vez de continuar indefinidamente.
9. O editor deve suportar atalhos básicos de formatação como negrito e itálico sobre a seleção atual.
10. A ajuda contextual do editor deve indicar de forma sucinta o uso de `/` e `@`.
11. A superfície principal de escrita no desktop deve operar em um editor DOM real, mantendo o Markdown como representação persistida para salvar no vault.
12. O editor deve destacar visualmente headings, negrito, listas, checklists, citações, divisores e links locais dentro da própria área de edição.
13. O editor deve manter uma toolbar leve para ações frequentes de formatação e estrutura.
14. A toolbar deve permitir ao menos aplicar negrito, itálico, heading, checklist, citação e abertura do seletor de links.
15. A aplicação de heading, checklist, lista e citação sobre seleção multi-linha deve atuar nas linhas selecionadas sem perder a compatibilidade com Markdown salvo.
16. O editor deve preservar uma serialização Markdown estável ao salvar, mesmo após múltiplas edições visuais na superfície DOM.
17. Ao confirmar uma menção por `@`, o editor deve inserir o link local e mover o cursor automaticamente para a próxima linha.
18. Menções visíveis no editor devem poder abrir a nota relacionada por clique ou atalho de teclado.
19. O editor deve permitir navegar entre menções visíveis com teclado e indicar a ação disponível para abertura.
20. O editor deve permitir indentar e desindentar listas, checklists, citações e listas numeradas com `Tab` e `Shift+Tab`.
21. A visualização ao vivo pode permanecer recolhida por padrão quando a superfície principal já reproduzir adequadamente a leitura estruturada.
22. O editor deve manter um histórico local de desfazer e refazer compatível com a superfície DOM e a persistência Markdown.
23. O editor deve suportar `Ctrl+Z` ou equivalente de plataforma para desfazer, e `Ctrl+Y` ou `Ctrl+Shift+Z` para refazer.
24. A ação de código deve tratar seleção multi-linha como bloco cercado por fences Markdown e seleção curta como código inline quando apropriado.
25. O editor deve manter rascunho local por nota enquanto houver alterações não salvas, e reaproveitar esse rascunho ao reabrir a nota.
26. O `Tab` deve continuar útil em texto comum, inserindo recuo textual quando a seleção atual não representar lista ou bloco estrutural equivalente.
27. O editor deve exibir um indicador discreto de estado para rascunho local, salvando ou sincronizado.
28. O editor deve disparar autosave local-first após alguns segundos de inatividade de digitação, sem exigir ação manual do usuário.
29. A camada visual de apresentação do editor pode ser modularizada separadamente da persistência, desde que continue renderizando a mesma estrutura Markdown e preserve os contratos existentes de histórico, rascunho e salvamento.
30. A camada de assistência inline do editor pode ser modularizada separadamente, desde que preserve os mesmos gatilhos de slash command e menção, a mesma navegação por teclado e a mesma aplicação Markdown sobre o conteúdo persistido.
31. A camada de histórico local, rascunho e autosave pode ser modularizada separadamente, desde que preserve a mesma sequência de salvamento, o mesmo controle de concorrência e a mesma fonte de verdade em Markdown persistido.
32. A camada de comandos de formatação do editor pode ser modularizada separadamente, desde que preserve os mesmos atalhos, as mesmas transformações de seleção e a mesma saída Markdown persistida.

## Pontos de atenção
- A superfície DOM do editor não pode romper a persistência atual em Markdown no filesystem.
- A sintaxe inserida deve permanecer compatível com Markdown simples no filesystem.
- As sugestões de `@` devem refletir apenas notas Markdown do vault ativo.
- A UI de assistência deve ficar dentro da superfície do editor, sem abrir fluxos modais aninhados.
- O comportamento de teclado não pode impedir a digitação normal quando nenhum assistente estiver ativo.
- A serialização não pode introduzir HTML salvo na nota como efeito colateral da edição visual.
- A toolbar deve continuar leve e não pode competir visualmente com a área principal de escrita.
- A navegação por teclado entre menções não pode sequestrar atalhos comuns quando não houver links visíveis no editor.
- O histórico local não pode se misturar entre notas diferentes quando o usuário troca de arquivo no workspace.
- O rascunho local não pode sobreviver após um salvamento bem-sucedido da mesma nota.
- O autosave não pode competir com um salvamento manual em andamento nem gerar múltiplas gravações simultâneas da mesma nota.
- A modularização da apresentação visual do editor não pode criar um pipeline paralelo de serialização nem mover a fonte de verdade para fora do Markdown persistido.
- A modularização do editor assist não pode mover a lógica de persistência para fora do fluxo principal nem alterar a prioridade dos atalhos e confirmações já previstas para slash commands e menções.
- A modularização de histórico, rascunho e autosave não pode alterar o bloqueio de gravações simultâneas nem perder o vínculo entre seleção restaurada, estado visual e conteúdo Markdown salvo.
- A modularização dos comandos de formatação não pode alterar a semântica dos atalhos locais nem gerar uma sintaxe Markdown diferente daquela já reconhecida pelo restante do editor.

## Cenários

### Cenário 1: slash command no início da linha
Given uma nota aberta no editor desktop
When o usuário digita `/h2` no início da linha atual
Then o editor mostra sugestões de comando inline
And ao confirmar a opção o sistema transforma a linha em um heading compatível com Markdown

### Cenário 2: menção de nota por arroba
Given um vault ativo com notas Markdown
When o usuário digita `@proj` dentro de uma nota
Then o editor mostra notas compatíveis do vault ativo
And ao selecionar uma delas o sistema insere um link local para essa nota

### Cenário 3: continuação automática de checklist
Given o cursor está em uma linha iniciada por `- [ ] `
When o usuário pressiona `Enter`
Then o editor cria a próxima linha com o mesmo prefixo

### Cenário 4: saída de lista vazia
Given a linha atual contém apenas um marcador de lista vazio
When o usuário pressiona `Enter`
Then o editor remove o marcador atual
And encerra a continuação automática da lista

### Cenário 5: atalho de negrito
Given um trecho de texto está selecionado no editor
When o usuário pressiona o atalho de negrito
Then o editor envolve a seleção com a sintaxe Markdown correspondente

### Cenário 6: ajuda contextual visível
Given uma nota está aberta no desktop
When o usuário observa a área do editor
Then a interface mostra uma ajuda curta para slash commands e menções por `@`

### Cenário 7: toolbar aplica estrutura em seleção de linhas
Given uma nota aberta contém múltiplas linhas selecionadas
When o usuário aplica uma ação de checklist ou citação pela toolbar
Then o editor atualiza as linhas selecionadas na superfície DOM
And o Markdown persistido continua representando essa mesma estrutura ao salvar

### Cenário 8: editor visual salva Markdown estável
Given o usuário edita headings, negrito e listas na superfície visual do editor
When ele salva a nota
Then o sistema persiste Markdown compatível no vault ativo
And a nota reabre com a mesma estrutura reconhecida pelo editor

### Cenário 9: menção confirmada move o cursor para nova linha
Given o editor mostra sugestões para uma menção iniciada por `@`
When o usuário confirma uma nota sugerida
Then o sistema insere o link local correspondente
And move o cursor automaticamente para a linha seguinte

### Cenário 10: menção visível abre a nota relacionada
Given uma nota aberta contém uma menção renderizada no editor
When o usuário clica na menção ou usa o atalho de abertura da menção ativa
Then o sistema abre a nota relacionada no workspace
And a árvore reflete visualmente a nota aberta a partir desse link

### Cenário 11: Tab ajusta indentação de listas
Given o usuário selecionou uma ou mais linhas de lista, checklist, citação ou lista numerada
When ele pressiona `Tab` ou `Shift+Tab`
Then o editor ajusta a indentação dessas linhas
And o Markdown persistido continua compatível após salvar

### Cenário 12: desfazer e refazer no editor visual
Given o usuário fez alterações na superfície visual do editor
When ele usa o atalho de desfazer ou refazer
Then o sistema restaura o conteúdo e a seleção correspondentes
And o Markdown interno permanece consistente com o estado visual resultante

### Cenário 13: seleção multi-linha vira bloco de código
Given o usuário selecionou múltiplas linhas no editor
When ele aplica a ação de código
Then o sistema envolve esse trecho com fences Markdown
And ao reaplicar a mesma ação o bloco pode ser removido sem quebrar o conteúdo interno

### Cenário 14: rascunho local reaparece ao reabrir a nota
Given o usuário editou uma nota e ainda não salvou
When ele sai dessa nota e depois a reabre
Then o editor recupera o rascunho local mais recente dessa nota
And o usuário volta ao conteúdo não salvo em vez do último conteúdo persistido

### Cenário 15: Tab recua texto comum
Given o cursor está em uma linha de texto comum sem estrutura de lista
When o usuário pressiona `Tab`
Then o editor insere um recuo textual coerente nessa posição
And `Shift+Tab` remove esse recuo quando aplicável

### Cenário 16: indicador reflete rascunho e salvamento
Given o usuário altera o conteúdo da nota no editor
When ainda existem mudanças não salvas
Then a interface mostra um indicador discreto de rascunho local
And quando o salvamento acontece o indicador volta para um estado sincronizado

### Cenário 17: autosave após pausa de digitação
Given o usuário está digitando em uma nota aberta
When ele para por alguns segundos sem novas mudanças
Then o editor salva automaticamente a nota no vault ativo
And o rascunho local correspondente é limpo após o salvamento bem-sucedido

### Cenário 18: apresentação visual do editor pode ser extraída sem mudar o comportamento
Given a interface desktop modulariza a camada visual do editor em um módulo dedicado
When uma nota Markdown é aberta, lida ou editada na superfície principal
Then headings, listas, checklists, citações, divisores e links continuam renderizados com a mesma leitura visual
And o conteúdo persistido continua sendo o mesmo Markdown usado por histórico, rascunho e salvamento

### Cenário 19: editor assist pode ser extraído sem mudar o comportamento
Given a interface desktop modulariza slash commands e menções em um módulo dedicado de assistência inline
When o usuário digita `/` no início da linha ou `@` em contexto de menção dentro de uma nota
Then o editor continua exibindo o mesmo menu inline com navegação por teclado e clique
And a opção confirmada continua aplicando o mesmo Markdown persistido no fluxo principal do editor

### Cenário 20: histórico e autosave podem ser extraídos sem mudar o comportamento
Given a interface desktop modulariza histórico local, rascunho e autosave em um módulo dedicado
When o usuário edita, desfaz, refaz ou aguarda o autosave de uma nota aberta
Then o editor continua restaurando seleção e conteúdo compatíveis com a superfície visual atual
And o salvamento continua usando o mesmo fluxo principal e o mesmo Markdown persistido no vault ativo

### Cenário 21: comandos de formatação podem ser extraídos sem mudar o comportamento
Given a interface desktop modulariza os comandos de formatação do editor em um módulo dedicado
When o usuário aplica atalhos de negrito, headings, listas, checklist, código, Enter estrutural ou Tab de indentação
Then o editor continua produzindo as mesmas transformações sobre a seleção atual
And o resultado persistido continua sendo o mesmo Markdown compatível com o restante do fluxo de escrita
