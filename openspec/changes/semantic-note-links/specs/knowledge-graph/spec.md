# Spec: knowledge graph

## Regra de negócio
O sistema deve oferecer um graph global local-first para explorar notas e pastas relacionadas, usando cores quentes e frias para expressar proximidade relativa ao foco atual e permitindo navegação direta pelo vault.

## Regras
1. O graph deve conseguir representar notas e pastas do vault ativo em uma visão global navegável.
2. O graph global deve ser uma superfície própria e diferenciada do produto, não apenas uma expansão do graph local já existente.
3. A visão global deve abrir o vault inteiro por padrão, ainda que possa aceitar foco inicial em uma nota, pasta, busca ou outro contexto relevante.
4. A visualização global deve usar uma composição esférica, orgânica e densa, com nós renderizados como elementos circulares navegáveis em DOM, inspirada em uma leitura de cérebro, globo neural ou menu infinito rotativo.
5. Notas devem ser a amostragem principal da visualização, ocupando a maior parte da presença visual do graph.
6. Pastas devem aparecer como entidades de contexto e navegação, sem competir visualmente com o papel principal das notas.
7. Nós de notas e nós de pastas devem permanecer visualmente distinguíveis.
8. O graph deve combinar pelo menos links manuais e relações automáticas locais como fontes de conexão.
9. A escala de cor deve representar proximidade relativa ao foco atual, com tons mais quentes indicando maior similaridade e tons mais frios indicando menor proximidade.
10. O graph deve permitir arrastar, aplicar zoom e rotacionar a visualização global sem recarregar o vault inteiro manualmente.
11. Ao clicar em um nó de nota, o sistema deve abrir a nota correspondente.
12. Ao clicar em um nó de pasta, o sistema deve abrir ou refocar a rede daquela pasta.
13. O graph deve permitir ocultar, reduzir ou filtrar conexões fracas para evitar poluição visual excessiva.
14. O graph não deve depender de mutação automática do markdown para existir; relações inferidas podem permanecer apenas no índice local.
15. O graph global deve renderizar todos os nós do vault ativo por padrão, sem exigir filtragem inicial manual para torná-lo visível.
16. Quando uma nota estiver em destaque, a interface deve exibir um overlay ou painel leve com pelo menos título, resumo curto e ação direta de navegação.
17. A direção visual deve privilegiar fundo escuro, profundidade, movimento fluido e sensação de rede viva, sem depender de imagens remotas obrigatórias.
18. Quando não houver imagem associada à nota, a visualização deve conseguir representar a nota com título, cor, textura ou outro tratamento local equivalente.
19. A representação visual inicial das notas no graph deve ser híbrida: em repouso cada nota aparece como nó compacto com rótulo implícito, e ao ganhar foco ela revela informações textuais como título e resumo curto.
20. O estado abstrato da nota deve priorizar legibilidade da malha global, enquanto o estado em foco deve priorizar compreensão e navegação da entidade selecionada.

## Pontos de atenção
- Um graph global totalmente conectado tende a perder valor; a visualização precisa controlar limiares, foco e densidade.
- A cor deve ser relativa ao foco atual, não uma medida global fixa difícil de interpretar.
- A estética orgânica e esférica não pode comprometer legibilidade, contraste ou capacidade de navegação.
- Pastas só devem ganhar destaque no graph quando ajudarem a explicar ou navegar o contexto relacionado.
- A inspiração visual em componentes 3D ou menus infinitos deve permanecer subordinada ao modelo de navegação por notas, não o contrário.
- O graph precisa funcionar com dados locais da nota, sem depender de catálogo de imagens externas para parecer completo.
- Exibir texto completo em todos os nós ao mesmo tempo tende a poluir a cena; o graph deve revelar informação textual principalmente no foco.

## Cenários

### Cenário 1: abrir visão global do graph
Given um vault ativo com notas e pastas indexadas
When o usuário abre o graph global
Then o sistema exibe uma rede navegável das entidades relacionadas
And abre a visualização do vault inteiro por padrão
And diferencia visualmente notas e pastas

### Cenário 1a: graph vazio não bloqueia navegação
Given um vault ativo sem notas Markdown ou com zero entidades relacionadas
When o usuário abre o graph global
Then a interface ainda abre a superfície global
And mostra um estado vazio controlado sem travar a navegação do app

### Cenário 1b: visual neural esférico
Given o graph global está aberto
When a interface renderiza a rede principal
Then a composição visual sugere uma esfera ou massa neural rotativa
And as notas aparecem como cards dominantes da amostragem visual

### Cenário 2: recolorir proximidade a partir do foco
Given o graph aberto com uma nota em foco
When o sistema calcula a proximidade relativa das demais entidades
Then os nós mais semelhantes aparecem em cores mais quentes
And os menos próximos aparecem em cores mais frias

### Cenário 3: navegar clicando em uma nota
Given um nó de nota visível no graph
When o usuário clica nesse nó
Then a nota correspondente é aberta
And o contexto de navegação do graph pode acompanhar o novo foco
And a interface pode mostrar título e resumo da nota destacada em overlay

### Cenário 3b: nota muda de compacta para informativa no foco
Given o graph global mostra várias notas ao mesmo tempo
When uma nota entra em foco por clique, hover qualificado ou seleção ativa
Then sua representação pode revelar título e resumo curto
And as demais notas permanecem em estado mais compacto para preservar legibilidade visual

### Cenário 4: abrir subrede por pasta
Given um nó de pasta visível no graph
When o usuário clica nessa pasta
Then o sistema abre ou refoca a rede das notas contidas naquele contexto
And mantém a navegação coerente com a hierarquia local do vault

### Cenário 5: reduzir ruído visual
Given um vault com muitas relações fracas
When o usuário ajusta a visualização ou o sistema aplica limiar de relevância
Then conexões pouco úteis podem ser ocultadas ou enfraquecidas
And o graph preserva os vínculos mais importantes para leitura humana

### Cenário 6: densidade inicial completa
Given um graph global com muitas relações candidatas
When a visualização inicial é aberta
Then o sistema exibe todos os nós do vault ativo por padrão
And a densidade visual pode ser ajustada sem esconder a base do vault

### Cenário 7: graph funciona sem imagens remotas
Given um vault cujas notas não possuem imagens associadas
When o graph global é renderizado
Then a interface ainda representa as notas de forma visualmente útil
And não depende de imagens externas para navegar o conteúdo

## Refinamento futuro
- adicionar modos de cluster por tema, tag ou root semântico
- permitir animações de destaque entre navegação textual e graph
- mostrar justificativas da relação ao passar o mouse sobre nós e arestas
