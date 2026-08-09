# Spec: knowledge graph

## Regra de negócio
O sistema deve oferecer um graph global local-first para explorar notas e pastas relacionadas por meio de ilhas temáticas, permitindo navegação direta pelo vault e foco visual por assunto.

## Regras
1. O graph deve conseguir representar notas e pastas do vault ativo em uma visão global navegável.
2. O graph global deve ser uma superfície própria e diferenciada do produto, não apenas uma expansão do graph local já existente.
3. A visão global deve abrir o vault inteiro por padrão, ainda que possa aceitar foco inicial em uma nota, pasta, busca ou outro contexto relevante.
4. A visualização global deve usar uma composição por ilhas temáticas, com cada ilha principal representando um assunto derivado das pastas top-level do vault.
5. Notas devem ser a amostragem principal dentro de cada ilha, ocupando a maior parte da presença visual do graph.
6. Pastas devem aparecer como entidades de contexto e navegação dentro dessas ilhas, sem competir visualmente com o papel principal das notas.
7. Nós de notas e nós de pastas devem permanecer visualmente distinguíveis.
8. O graph deve combinar pelo menos links manuais e relações automáticas locais como fontes de conexão.
9. A linguagem visual pode usar uma paleta por ilha e destaque contextual no foco atual, sem depender de uma escala global fixa de calor.
10. O graph deve permitir arrastar e aplicar zoom na visualização global sem recarregar o vault inteiro manualmente.
11. Ao clicar em um nó de nota, o sistema deve focar a nota correspondente na superfície global.
12. Ao dar duplo clique em um nó de nota, o sistema deve abrir a nota correspondente.
13. Ao clicar em um nó de pasta, o sistema deve focar esse contexto no graph; ao dar duplo clique, pode abrir a pasta no workspace.
14. Ao clicar em uma ilha principal, o sistema deve focar o assunto correspondente sem sair da superfície global.
15. O graph deve permitir ocultar, reduzir ou filtrar conexões fracas para evitar poluição visual excessiva.
16. O graph não deve depender de mutação automática do markdown para existir; relações inferidas podem permanecer apenas no índice local.
17. O graph global deve representar o vault ativo por padrão; em vaults grandes, pode usar uma amostragem de notas e pastas, desde que informe claramente a quantidade exibida e não bloqueie o fluxo principal de edição.
18. Quando uma nota ou ilha estiver em destaque, a interface deve exibir um overlay ou painel leve com pelo menos título, resumo curto e métricas básicas de contexto.
19. A direção visual deve privilegiar fundo escuro, profundidade, movimento fluido e sensação de rede viva, sem depender de imagens remotas obrigatórias.
20. Quando não houver imagem associada à nota, a visualização deve conseguir representar a nota com título, cor, textura ou outro tratamento local equivalente.
21. A representação visual inicial das notas no graph deve ser híbrida: em repouso cada nota aparece como nó compacto com rótulo implícito, e ao ganhar foco ela revela informações textuais como título e resumo curto.
22. O estado abstrato da nota deve priorizar legibilidade da malha global, enquanto o estado em foco deve priorizar compreensão e navegação da entidade selecionada.
23. A implementação do graph local do workspace e dos controles da surface de relações pode ser modularizada separadamente, desde que preserve a mesma navegação por clique, zoom, drag e abertura de nota ou pasta dentro do vault ativo.
24. A implementação principal do graph global por ilhas e de seus handlers de foco, hover, drag, zoom e overlay pode ser modularizada separadamente, desde que preserve a mesma navegação e o mesmo foco visual dentro do vault ativo.

31. O graph não deve reconstruir toda a árvore DOM em animação contínua; atualizações de foco e hover devem reaproveitar a cena renderizada sempre que possível.
32. O graph deve interromper movimento contínuo em documento oculto e respeitar a preferência do sistema por movimento reduzido.
33. O overlay de uma nota em foco deve poder ser fechado sem sair da superfície do graph.

## Pontos de atenção
- Um graph global totalmente conectado tende a perder valor; a visualização precisa controlar limiares, foco e densidade.
- A leitura por ilhas não pode esconder relações cruzadas relevantes entre assuntos distintos.
- A estética orgânica das ilhas não pode comprometer legibilidade, contraste ou capacidade de navegação.
- Pastas só devem ganhar destaque no graph quando ajudarem a explicar ou navegar o contexto relacionado.
- A composição por ilhas deve continuar subordinada ao modelo de navegação por notas, não o contrário.
- O graph precisa funcionar com dados locais da nota, sem depender de catálogo de imagens externas para parecer completo.
- Exibir texto completo em todos os nós ao mesmo tempo tende a poluir a cena; o graph deve revelar informação textual principalmente no foco.
- A modularização do graph local não pode alterar o contrato de navegação do workspace nem criar um fluxo paralelo de abertura fora do vault ativo.
- A modularização do graph global não pode alterar o contrato de foco, abertura, overlay e navegação por ilhas nem criar uma superfície paralela desconectada do vault ativo.

## Cenários

### Cenário 1: abrir visão global do graph
Given um vault ativo com notas e pastas indexadas
When o usuário abre o graph global
Then o sistema exibe uma rede navegável das entidades relacionadas
And abre a visualização do vault inteiro por padrão
And diferencia visualmente notas e pastas
And distribui os assuntos principais em ilhas visuais

### Cenário 1a: graph vazio não bloqueia navegação
Given um vault ativo sem notas Markdown ou com zero entidades relacionadas
When o usuário abre o graph global
Then a interface ainda abre a superfície global
And mostra um estado vazio controlado sem travar a navegação do app

### Cenário 1b: visual por ilhas temáticas
Given o graph global está aberto
When a interface renderiza a rede principal
Then a composição visual sugere ilhas orgânicas por assunto
And cada ilha principal representa um grupo derivado das pastas top-level do vault

### Cenário 2: foco destaca contexto atual
Given o graph aberto com uma nota ou ilha em foco
When o sistema atualiza o estado visual do contexto atual
Then o assunto ou nó focado recebe destaque principal
And os demais elementos podem ficar mais discretos sem sumir da leitura global

### Cenário 3: navegar clicando em uma nota
Given um nó de nota visível no graph
When o usuário clica nesse nó
Then a nota correspondente entra em foco no graph
And o contexto de navegação do graph acompanha o novo foco
And a interface pode mostrar título e resumo da nota destacada em overlay

### Cenário 3a: abrir nota com duplo clique
Given um nó de nota visível no graph
When o usuário dá duplo clique nesse nó
Then a nota correspondente é aberta no workspace

### Cenário 3b: nota muda de compacta para informativa no foco
Given o graph global mostra várias notas ao mesmo tempo
When uma nota entra em foco por clique, hover qualificado ou seleção ativa
Then sua representação pode revelar título e resumo curto
And as demais notas permanecem em estado mais compacto para preservar legibilidade visual

### Cenário 4: focar ilha principal
Given uma ilha principal visível no graph
When o usuário clica nessa ilha
Then o sistema foca o assunto correspondente sem sair da superfície global
And mantém as notas daquele contexto como leitura principal

### Cenário 4a: abrir subrede por pasta
Given um nó de pasta visível no graph
When o usuário interage com essa pasta
Then o sistema pode focar ou abrir o contexto daquela pasta
And mantém a navegação coerente com a hierarquia local do vault

### Cenário 5: reduzir ruído visual
Given um vault com muitas relações fracas
When o usuário ajusta a visualização ou o sistema aplica limiar de relevância
Then conexões pouco úteis podem ser ocultadas ou enfraquecidas
And o graph preserva os vínculos mais importantes para leitura humana

### Cenário 6: densidade inicial completa
Given um graph global com muitas relações candidatas
When a visualização inicial é aberta
Then o sistema exibe uma representação navegável do vault ativo por padrão
And a densidade visual pode ser ajustada ou amostrada quando o vault for grande
And a interface informa quando a quantidade exibida for menor que o total

### Cenário 7: graph funciona sem imagens remotas
Given um vault cujas notas não possuem imagens associadas
When o graph global é renderizado
Then a interface ainda representa as notas de forma visualmente útil
And não depende de imagens externas para navegar o conteúdo

### Cenário 8: graph local do workspace pode ser extraído sem mudar o comportamento
Given a interface desktop modulariza o graph local do workspace e os controles da surface de relações em um módulo dedicado
When o usuário alterna entre overview e graph, navega por clique ou aplica zoom e drag no graph local
Then a interface continua exibindo a mesma rede local da nota ou pasta ativa
And a abertura de nota ou pasta continua usando o mesmo fluxo principal do workspace

### Cenário 9: graph global por ilhas pode ser extraído sem mudar o comportamento
Given a interface desktop modulariza a surface principal do graph global por ilhas em um módulo dedicado
When o usuário foca notas, assuntos, overlay, zoom ou drag dentro do graph global
Then a interface continua exibindo a mesma leitura por ilhas e o mesmo foco visual do contexto ativo
And a abertura de nota ou pasta continua usando o mesmo fluxo principal do vault ativo

## Refinamento futuro
- adicionar modos de cluster por tema, tag ou root semântico
- permitir animações de destaque entre navegação textual e graph
- mostrar justificativas da relação ao passar o mouse sobre nós e arestas
