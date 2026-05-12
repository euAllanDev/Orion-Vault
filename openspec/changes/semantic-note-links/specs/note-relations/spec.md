# Spec: note relations

## Regra de negócio
O sistema deve manter uma representação vetorial local das notas do vault para calcular similaridade, explicar relações relevantes e permitir consulta direta por notas com alto nível de relacionamento.

## Regras
1. Cada nota Markdown elegível do vault deve possuir uma representação vetorial ou índice local de relações calculado pelo sistema.
2. Essa representação não deve ser gravada dentro do markdown da nota como conteúdo obrigatório.
3. O cálculo de relação deve considerar sinais locais como título, headings, corpo, tags, frontmatter, caminho, links manuais e backlinks quando disponíveis.
4. O índice de relações deve ser recalculado quando uma nota relevante for criada, editada, movida, renomeada ou relinkada.
5. Para o mesmo estado de entrada e a mesma estratégia de cálculo, o score de relacionamento deve ser determinístico.
6. O sistema deve expor um comando `related` capaz de listar notas com alto nível de relacionamento a partir de uma nota de referência.
7. O resultado do comando deve incluir a nota relacionada, um score relativo e sinais explicativos suficientes para revisão humana.
8. O comando deve operar somente dentro do vault ativo e sobre notas Markdown válidas.
9. O sistema deve continuar local-first e não exigir internet para calcular ou consultar relações.
10. Relações inferidas automaticamente devem permanecer distintas de links manuais persistidos no markdown.
11. A estratégia inicial de vetorização deve usar TF-IDF como sinal principal de conteúdo.
12. O score inicial de relacionamento deve ser híbrido, combinando TF-IDF, tags, título e headings, links manuais e backlinks, e proximidade de pasta.
13. No perfil inicial, o peso relativo do score deve seguir a proporção de `55%` para TF-IDF, `15%` para tags, `10%` para título e headings, `10%` para links manuais e backlinks, e `10%` para proximidade de pasta.
14. O sistema deve classificar as relações por faixas de intensidade para guiar comandos, sugestões e graph.
15. No perfil inicial, scores `>= 0.75` representam relação forte, scores entre `0.55` e `0.74` representam relação média, scores entre `0.35` e `0.54` representam relação fraca, e scores abaixo de `0.35` não devem aparecer por padrão como relação relevante.

## Pontos de atenção
- A escolha do algoritmo inicial pode variar, mas a saída precisa ser auditável o suficiente para o usuário confiar no ranking.
- O contrato deve permitir trocar TF-IDF por outra estratégia local no futuro sem quebrar o comando, o graph ou a camada de sugestão de links.
- Comparação total entre todas as notas pode ficar cara em vaults grandes; o índice deve prever atualização incremental.
- Score alto por proximidade estrutural não deve mascarar diferenças semânticas reais de conteúdo.
- O comando de relacionadas deve evitar respostas caixa-preta e informar por que as notas apareceram.

## Cenários

### Cenário 1: gerar índice local por nota
Given um vault com notas Markdown válidas
When o sistema indexa as notas para relações
Then cada nota recebe uma representação vetorial ou índice local
And essa representação fica disponível para consultas posteriores

### Cenário 2: listar notas altamente relacionadas
Given uma nota de referência já indexada
When o usuário executa `related` para essa nota
Then o sistema retorna uma lista ordenada de notas relacionadas
And cada item informa score e sinais explicativos da relação

### Cenário 2b: filtrar por intensidade padrão
Given uma nota de referência já indexada
When o sistema calcula as relações relevantes para `related`
Then relações fortes e médias podem aparecer por padrão
And relações abaixo do limiar mínimo ficam ocultas por padrão

### Cenário 3: nota alterada atualiza relações
Given uma nota já indexada
When seu conteúdo, tags, caminho ou links mudam
Then o sistema recalcula sua representação local
And as relações derivadas passam a refletir o novo estado

### Cenário 4: vault sem relações fortes
Given uma nota sem relação relevante acima do limiar configurado
When o usuário consulta notas relacionadas
Then o sistema retorna resultado vazio ou fraco de forma explícita
And não inventa relação alta sem base suficiente

### Cenário 5: links manuais influenciam mas não dominam sozinhos
Given duas notas com um link manual e baixo alinhamento de conteúdo
When o sistema calcula o ranking de relação
Then o link manual pode aumentar a proximidade
And o score final ainda considera os demais sinais locais

### Cenário 6: TF-IDF é a base inicial do conteúdo
Given duas notas com vocabulário parecido no título, headings ou corpo
When o sistema calcula o componente principal de similaridade
Then o sinal de conteúdo usa TF-IDF como estratégia inicial
And os demais sinais apenas refinam o ranking final

## Refinamento futuro
- suportar múltiplas estratégias de vetorização sob o mesmo contrato
- permitir pesos configuráveis para diferentes sinais de relação
- enriquecer o comando com filtros por pasta, tag e limiar mínimo
