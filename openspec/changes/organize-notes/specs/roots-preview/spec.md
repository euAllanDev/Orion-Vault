# Spec: roots preview

## Regra de negócio
O sistema pode agrupar notas Markdown semanticamente semelhantes em `roots` visuais e informacionais para apoiar a navegação do usuário e fornecer contexto adicional à IA.

## Regras
1. Um root representa um agrupamento observável de notas relacionadas por conteúdo, tags, título, frontmatter ou padrões de nome.
2. Roots são uma camada de preview e contexto, não uma estrutura obrigatória do filesystem.
3. A semelhança entre roots pode ser expressa por cores, intensidade ou proximidade visual.
4. O sistema deve permitir que a IA consuma roots como contexto resumido.
5. O sistema não deve depender de roots para validar segurança de fronteira.

## Pontos de atenção
- Roots não podem ser tratados como fonte de verdade estrutural do vault.
- O algoritmo de similaridade deve ser interpretável o suficiente para revisão humana.
- Como o recurso é futuro, qualquer integração com a IA deve permanecer opcional e não bloquear o fluxo principal.

## Cenários

### Cenário 1: agrupar notas semelhantes
Given um vault com notas Markdown relacionadas por conteúdo ou tags
When o sistema gera roots de preview
Then notas similares podem ser agrupadas no mesmo root
And o usuário vê o agrupamento como informação auxiliar

### Cenário 2: roots não alteram o filesystem
Given roots gerados para visualização
When o usuário navega ou consulta o contexto
Then nenhum arquivo é movido ou reescrito

### Cenário 3: roots servem como contexto para IA
Given um conjunto de roots calculados
When a IA solicita contexto adicional
Then o sistema pode resumir os roots relevantes
And expor títulos, tags e proximidade semântica

## Refinamento futuro
- definir algoritmo de similaridade inicial
- integrar roots ao dashboard visual
- permitir feedback humano para ajustar agrupamentos
