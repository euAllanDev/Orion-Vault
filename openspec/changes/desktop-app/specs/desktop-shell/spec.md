# Spec: desktop shell

## Regra de negócio
O sistema deve fornecer uma aplicação desktop local-first em TypeScript para operar o vault e suas notas sem depender de internet para o fluxo principal.

O shell desktop deve reaproveitar o core local existente e expor a mesma fronteira segura do vault, sem duplicar regras de negócio.

## Regras
1. A aplicação deve ser instalável como app desktop.
2. A aplicação deve funcionar com armazenamento local no dispositivo do usuário.
3. A aplicação deve iniciar no vault padrão local do usuário e validá-lo automaticamente, revelando o workspace como primeira superfície quando o vault estiver disponível.
4. A aplicação deve expor os fluxos de workspace, leitura e organização numa janela desktop.
5. A aplicação não deve exigir banco externo para o MVP.
6. A aplicação não deve exigir internet para criar, abrir, editar ou organizar notas localmente.
7. A aplicação deve preservar a fronteira segura do vault em todas as operações de escrita.
8. O shell desktop deve operar como camada de interface e orquestração sobre a base local existente.
9. O shell desktop deve abrir automaticamente o vault padrão local ao iniciar e reabrir o workspace quando a raiz ainda for válida.
10. A lateral do desktop deve usar ícones minimalistas e mais refinados, sem poluição visual.
11. Os painéis principais do desktop devem usar `#131316` como cor base.
12. A superfície de `Home`/setup deve exibir cartões de métricas do vault, resumos de notas e um card rotativo de novidades do projeto, mas o desktop não deve depender dela como primeira tela quando já existir um vault ativo.
13. Os modais internos devem ter aparência consistente com o desktop, com melhor alinhamento e foco visual.
14. A interface desktop deve expor um botão para listar os comandos disponíveis em uma visão agrupada por intenção.
15. A interface desktop deve expor uma busca global local sobre notas Markdown do vault ativo.
16. A interface desktop deve permitir selecionar modelos para novas notas e salvar notas como modelos.
17. A interface desktop deve exibir backlinks da nota aberta no painel auxiliar.
18. O menu de opções da nota no desktop deve expor uma ação `Linkar` que abre um seletor local de notas do vault ativo.
19. A interface desktop deve permitir fixar notas e manter essa lista localmente.
20. A interface desktop deve abrir a nota diária local do dia em um fluxo rápido.
21. A interface desktop deve mostrar um graph view local do vault ativo em uma superfície global dedicada.
22. O graph view deve permitir zoom e arrastar, exibir todos os nós do vault ativo por padrão e organizar os assuntos principais em ilhas visuais derivadas das pastas top-level.
23. Pastas aninhadas no graph devem aparecer como entidades clicáveis que refocam a rede daquele contexto e podem ser abertas a partir da própria superfície.
24. No graph global, um clique deve priorizar foco visual no nó ou assunto atual, enquanto a abertura de nota ou pasta pode acontecer por duplo clique.
25. A interface desktop deve expor uma ponte local para IA via CLI, permitindo ler contexto, buscar, planejar e propor ações sobre notas.
26. A ponte de IA via CLI deve usar os mesmos contratos de comandos e respeitar a fronteira segura do vault antes de qualquer escrita.
27. A tela inicial deve mostrar um popup amigável de onboarding da IA com atalho para abrir um terminal local visível no diretório certo.
28. O popup de IA deve manter o fluxo de comandos e a lista de comandos dentro do próprio painel, sem depender de modais aninhados.
29. O acesso da IA no desktop deve ficar fixo na sidebar, como ação `Modo dev` no rodapé, sem depender de launcher flutuante.
30. A experiência desktop deve reproduzir um som local de lembrete quando notificações de agenda forem disparadas, sem usar o som padrão do sistema operacional.
31. Notificações nativas de agenda no desktop devem permitir trazer o app principal para frente e abrir a área de agenda quando o usuário clicar nelas.
32. Ao abrir, mostrar ou restaurar a janela desktop, o shell pode emitir um resumo nativo da agenda quando houver itens pendentes, importantes para hoje ou em atraso, evitando repetição contínua em reaberturas muito próximas.
33. O bootstrap do vault padrão no desktop deve usar o mesmo contrato de abertura usado depois pela interface, em vez de um caminho paralelo de inicialização.
34. O vault padrão configurado pelo app deve ser a única raiz autoritativa usada pelo shell desktop durante bootstrap, leitura, criação e atualização da árvore.
35. Enquanto o bootstrap do vault padrão não terminar, a interface desktop não deve permitir criar notas, criar pastas ou disparar outras ações de escrita no workspace.
36. Quando o vault padrão estiver carregando, o workspace deve permanecer em estado de carregamento ou vazio controlado, sem parecer pronto de forma enganosa.
37. Ao criar uma pasta vazia no vault ativo, a árvore do workspace deve refletir a nova pasta imediatamente após o refresh, sem exigir troca de tela.
38. Os diálogos internos usados para criar, renomear, mover, informar conteúdo e selecionar links devem operar com apenas uma sessão ativa por vez, evitando reaproveitar callbacks antigos.
39. A interface desktop deve permitir apagar a nota selecionada ou a pasta ativa por meio do teclado, exigindo confirmação explícita antes da remoção efetiva.
40. Quando houver uma pasta ativa no workspace, a ação de apagar deve priorizar essa pasta acima de uma nota ainda aberta no editor.
41. A pasta raiz `Agenda` deve permanecer fixa no desktop e não pode ser apagada, embora as notas dentro dela possam ser removidas normalmente.
42. A interface desktop deve permitir renomear a nota aberta diretamente pelo título no editor, preservando a extensão Markdown e a validação de caminho do vault.
43. O editor do workspace deve usar fundo unificado `#131316` em toda a área central de leitura e escrita, sem blocos internos mais claros nem traços residuais na superfície principal.
44. A sidebar principal do desktop deve permitir modo recolhido com ícones apenas, preservando a navegação principal e o acesso ao botão de recolher.
45. A Home/Overview desktop deve encaixar métricas, gráficos, atividade e agenda dentro da área útil da janela, evitando vazios laterais ou inferiores desproporcionais em proporções comuns de desktop.
46. O terminal aberto por `Modo dev` deve iniciar na raiz do app e manter o vault ativo por variável de ambiente ou contrato equivalente.
47. O onboarding da IA no desktop deve orientar o uso de `/start` antes de `/guide` e do restante do fluxo.
48. Mudanças feitas no vault ativo por terminal local ou automação externa devem refletir no workspace sem exigir reinício manual do app.

## Pontos de atenção
- Controles opcionais ausentes em uma superfície não devem abortar a inicialização do renderer nem impedir o registro dos handlers do desktop.
- A seleção de pasta do workspace deve ser desfeita apenas ao clicar em uma área vazia do background, sem depender de um botão dedicado.
- O shell desktop deve reaproveitar a lógica atual em vez de reimplementar as regras de negócio.
- A interface deve continuar simples e focada em leitura, organização e ação local.
- A persistência do estado do app deve ser local e mínima.
- Se houver integração com CLI, ela deve ser local e opcional, não uma dependência de rede.
- A IA local deve operar como copiloto de notas via CLI, não como backend remoto.
- O runtime do shell deve ser escolhido sem quebrar a portabilidade da base TypeScript.
- Se o vault padrão não existir mais, a aplicação deve voltar ao setup.
- A interface desktop deve usar diálogos internos para ações como criar, renomear, mover e informar conteúdo inicial.
- O layout desktop deve privilegiar o encaixe da janela, com espaçamento consistente e leitura confortável.
- O estado visual inicial do workspace não pode divergir da raiz realmente aberta no backend local.
- Um bootstrap atrasado não pode permitir que a interface pareça vazia e só revele o conteúdo real depois de uma ação lateral do usuário.
- Se uma escrita for tentada cedo demais, a interface deve esperar o vault ativo ou bloquear a ação com mensagem controlada; nunca deve cair silenciosamente em um estado parcial.
- A atualização da árvore depois de criar uma pasta vazia precisa continuar cobrindo diretórios sem notas, não apenas arquivos Markdown.
- Um controle opcional ausente não pode quebrar o bootstrap do renderer nem impedir os handlers da agenda.
- O atalho de apagamento precisa mostrar confirmação antes de remover pastas recursivamente.
- A limpeza da pasta ativa não pode acontecer ao clicar em botões, menus, editor ou outros controles interativos; apenas no background vazio do workspace.
- O recolhimento da sidebar não pode esconder a navegação principal nem remover o acesso ao atalho fixo de `Modo dev`.
- O rename inline no título da nota continua sujeito às mesmas regras de fronteira do vault; a UI não pode criar caminhos arbitrários fora da pasta da nota atual.
- A superfície principal de escrita deve permanecer visualmente contínua, sem molduras internas competindo com o fundo base `#131316`.
- O terminal da IA precisa expor o contexto do app sem esconder o vault ativo; abrir no vault diretamente dificulta a descoberta do guia e dos comandos do produto.
- O refresh do workspace não pode depender apenas de ações internas da UI quando o vault estiver sendo alterado por terminal local.

## Cenários

### Cenário 1: app abre localmente
Given a aplicação desktop instalada
When o usuário inicia o app
Then a janela desktop é exibida
And o app opera sem internet obrigatória

### Cenário 2: vault padrão é iniciado
Given nenhum vault ativo visível
When a aplicação desktop inicia
Then o sistema busca o vault padrão configurado pelo app
And abre o vault padrão local
And grava o estado localmente
And exibe o workspace como primeira superfície visível
And o fluxo principal não depende de prompt modal do navegador

### Cenário 2c: bootstrap usa o mesmo fluxo de abertura
Given a aplicação desktop inicia com um vault padrão configurado
When o bootstrap automático é executado
Then o shell desktop reutiliza o mesmo contrato local de `open/setup` usado pela interface
And a raiz ativa retornada por esse fluxo vira a única fonte de verdade para o workspace
And o frontend não mantém um vault visual diferente do vault realmente aberto

### Cenário 2d: ações ficam bloqueadas até o vault ficar pronto
Given o desktop ainda está carregando o vault padrão
When o usuário tenta criar uma nota ou pasta antes do bootstrap terminar
Then a interface aguarda a abertura do vault ativo ou bloqueia a ação com feedback claro
And nenhuma escrita ocorre em estado visual parcial
And o workspace não parece pronto antes da árvore real ser carregada

### Cenário 2e: controles opcionais não quebram o bootstrap
Given a interface desktop contém controles opcionais ausentes em uma superfície secundária
When o renderer inicializa
Then o bootstrap do desktop continua normalmente
And os handlers de agenda, workspace e comandos seguem registrados
And a aplicação não aborta o carregamento por causa desse controle ausente

### Cenário 2b: vault padrão ausente
Given o vault padrão não existe mais na máquina
When a aplicação desktop inicia novamente
Then o sistema volta ao setup
And mostra um estado de recuperação sem ação manual obrigatória
And aguarda a restauração ou criação do vault padrão pelo app

### Cenário 5: setup exibe métricas e novidades
Given a superfície de `Home`/setup está aberta
When o vault está disponível para leitura
Then a interface exibe cartões de métricas do vault
And mostra um card rotativo com novidades do projeto

### Cenário 6: comandos ficam visíveis no desktop
Given a aplicação desktop está aberta
When o usuário aciona o botão de comandos
Then o sistema exibe uma lista agrupada dos comandos disponíveis
And cada comando aparece com uso e intenção

### Cenário 6b: onboarding orienta a entrada da IA
Given a aplicação desktop está aberta e o usuário aciona `Modo dev`
When o onboarding da IA é exibido
Then o sistema orienta começar por `/start`
And depois seguir para `/guide`, `/context`, `/search`, `/plan` ou `/preview`
And `apply` aparece condicionado a um `previewId` validado

### Cenário 6c: terminal da IA abre na raiz do app
Given a aplicação desktop está aberta com um vault ativo
When o usuário abre o terminal da IA por `Modo dev`
Then o terminal inicia na raiz do app
And o vault ativo permanece disponível para os comandos do produto

### Cenário 6d: mudanças externas reaparecem no workspace
Given a aplicação desktop está aberta em um vault ativo
When uma nota ou pasta é alterada pelo terminal local da IA
Then o workspace reflete essa mudança sem reiniciar a aplicação

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

### Cenário 8b: diálogos internos não reaproveitam handlers antigos
Given o usuário abriu um diálogo interno de criação ou edição
When um novo diálogo é aberto antes da sessão anterior ser concluída
Then a sessão anterior é encerrada de forma controlada
And apenas o diálogo atual pode confirmar a ação
And callbacks antigos não podem disparar criações extras de nota ou pasta

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
Then a interface mostra a superfície global do vault com seus nós visíveis por padrão
And organiza os assuntos principais em ilhas visuais
And permite focar uma nota clicando em um nó

### Cenário 12a: abrir nota por duplo clique no graph
Given um nó de nota visível no graph global
When o usuário dá duplo clique nesse nó
Then a nota correspondente é aberta no workspace

### Cenário 13: graph de pasta
Given uma pasta selecionada no workspace
When o usuário abre o graph view
Then a interface pode refocar o graph na rede daquele contexto
And o usuário pode arrastar e aplicar zoom no grafo

### Cenário 14: pasta aninhada como nó
Given uma pasta com subpastas no graph view
When o usuário clica em uma subpasta clicável
Then a interface foca ou abre a rede local daquela subpasta
And mostra as notas contidas nela

### Cenário 14a: ilha principal foca assunto
Given uma ilha principal visível no graph global
When o usuário clica nessa ilha
Then a interface foca o assunto correspondente
And mantém a navegação dentro da própria superfície global

### Cenário 14b: vault vazio não bloqueia navegação
Given o vault ativo está vazio ou sem notas navegáveis
When o usuário alterna entre workspace, agenda e relações
Then a interface continua permitindo troca de tela
And a superfície de relações pode mostrar estado vazio sem prender o app
And se o vault ativo ainda não estiver disponível, o shell volta ao setup em vez de travar a navegação

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

### Cenário 17: atalho de IA fica fixo na sidebar
Given a aplicação desktop está aberta
When o usuário procura a entrada da IA
Then a interface exibe a ação `Modo dev` no rodapé da sidebar
And o acesso à IA não depende de launcher flutuante sobre o workspace

### Cenário 18: comandos embutidos no popup
Given o popup de IA está aberto
When o usuário aciona "Ver comandos"
Then a lista agrupada de comandos aparece dentro do próprio painel
And o usuário pode esconder essa lista sem fechar o popup

### Cenário 19: lembrete de agenda com som local
Given um lembrete de agenda é disparado no desktop
When a notificação é exibida
Then o sistema reproduz o som local de lembrete configurado
And não depende do som padrão do sistema operacional

### Cenário 19a: clique na notificação abre a agenda
Given uma notificação nativa de agenda foi exibida no desktop
When o usuário clica nessa notificação
Then o app principal é trazido para frente
And a área de agenda é aberta no renderer

### Cenário 19b: resumo da agenda ao reabrir a janela
Given a janela desktop é aberta, mostrada novamente ou restaurada
And existem itens pendentes, importantes para hoje ou em atraso
When o shell avalia o estado atual da agenda
Then ele pode emitir uma notificação nativa resumida
And evita repetir o mesmo resumo continuamente em reaberturas muito próximas

### Cenário 20: pasta vazia aparece imediatamente na árvore
Given um vault ativo já carregado no workspace
When o usuário cria uma nova pasta vazia por meio da interface interna
Then a pasta é criada dentro do vault padrão ativo
And o refresh seguinte da árvore inclui essa pasta mesmo sem arquivos dentro dela
And o usuário não precisa trocar de tela para enxergar o novo diretório

### Cenário 21: clique em background vazio limpa a seleção
Given uma pasta está selecionada no workspace
When o usuário clica em uma área vazia do background do workspace
Then a seleção de pasta é limpa
And o contexto da próxima criação volta para a raiz ou para outra seleção explícita

### Cenário 21a: apagar item selecionado com confirmação
Given o workspace possui uma nota selecionada ou uma pasta ativa
When o usuário pressiona `Delete` e confirma a ação
Then o item alvo é apagado do vault ativo
And a árvore do workspace é atualizada sem exigir troca de tela

### Cenário 21b: pasta ativa tem prioridade no delete
Given uma pasta está ativa no workspace
And uma nota ainda está aberta no editor
When o usuário pressiona `Delete` e confirma a ação
Then a interface usa a pasta ativa como alvo do apagamento
And não apaga a nota aberta por engano

### Cenário 21c: pasta Agenda é protegida
Given a pasta raiz `Agenda` está visível no workspace
When o usuário tenta apagá-la pela interface desktop
Then a operação é bloqueada com feedback controlado
And a pasta continua disponível
And notas dentro de `Agenda/` ainda podem ser apagadas normalmente

### Cenário 22: título da nota renomeia inline
Given uma nota Markdown está aberta no editor do desktop
When o usuário altera o título diretamente no cabeçalho do editor e confirma a ação
Then o sistema renomeia o arquivo correspondente dentro da mesma pasta
And preserva a extensão Markdown
And atualiza a árvore e o contexto visual para o novo nome

### Cenário 23: editor mantém fundo unificado
Given uma nota está aberta no workspace desktop
When o usuário lê ou escreve na área principal do editor
Then toda a superfície central usa o tom base `#131316`
And a área de escrita não exibe bloco interno mais claro nem traço residual separando o texto do fundo

### Cenário 24: sidebar recolhida mantém só ícones
Given a sidebar principal do desktop está expandida
When o usuário aciona o controle de recolher
Then a sidebar passa para um modo compacto com ícones apenas
And mantém acessíveis a navegação principal e a ação `Modo dev`

### Cenário 25: overview preenche a área útil
Given a Home/Overview está visível em uma janela desktop comum
When os cards principais são renderizados
Then métricas, gráficos, agenda e atividade ocupam a área útil sem vazios desproporcionais
And o menu de ações rápidas continua abrindo acima do conteúdo, sem cair atrás dos cards

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
