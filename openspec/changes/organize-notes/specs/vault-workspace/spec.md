# Spec: vault workspace

## Regra de negócio
O sistema deve permitir criar e editar a estrutura básica do vault local de forma segura, sem violar a fronteira do diretório raiz.

## Regras
1. O sistema deve permitir criar pastas dentro do vault.
2. O sistema deve permitir criar arquivos Markdown dentro do vault.
3. O sistema deve permitir editar o conteúdo de uma nota Markdown existente.
4. O sistema deve permitir renomear arquivos e pastas dentro do vault.
5. O sistema deve permitir mover notas entre pastas dentro do vault.
6. Nenhuma operação pode sobrescrever conteúdo existente sem validação explícita.
7. Nenhuma operação pode escapar da raiz do vault.
8. A leitura e validação continuam como base de segurança para qualquer operação de escrita.
9. A criação de pastas e notas deve partir da pasta atualmente selecionada ou da raiz do vault quando nenhuma pasta estiver ativa.
10. A interface de workspace deve apresentar apenas o nome da nota na listagem, sem repetir o caminho completo na linha principal.
11. Pastas e notas devem permanecer visualmente separadas e ordenadas de forma consistente, com pastas antes de notas e nomes em ordem alfabética.
12. A seleção de pasta deve ser removida ao clicar fora da árvore de pastas e notas, sem exigir um botão dedicado para desmarcar.

## Pontos de atenção
- Escritas devem continuar precedidas por resolução canônica de caminho e checagem de fronteira.
- Renomear e mover precisam preservar o conteúdo original quando houver conflito de destino.
- A spec não cobre delete; evitar introduzi-lo implicitamente nas rotinas de workspace.
- A criação baseada em nome não deve gerar caminhos brutos ou concatenados de forma visível na linha principal da nota.

## Cenários

### Cenário 1: criar uma pasta
Given um vault válido
And uma pasta está selecionada ou nenhuma pasta foi selecionada
When o usuário cria uma pasta por nome
Then a pasta é criada com segurança
And a nova pasta é criada dentro da pasta ativa ou da raiz
And a estrutura do vault é atualizada

### Cenário 2: criar uma nota Markdown
Given um vault válido
And uma pasta está selecionada ou nenhuma pasta foi selecionada
When o usuário cria uma nota Markdown por nome
Then o arquivo é criado com o conteúdo informado
And o caminho é resolvido a partir da pasta ativa ou da raiz
And o vault permanece dentro da fronteira permitida

### Cenário 3: editar uma nota existente
Given uma nota Markdown existente
When o usuário edita o conteúdo da nota
Then o conteúdo é substituído de forma controlada
And o caminho da nota permanece dentro do vault

### Cenário 4: renomear ou mover um item
Given uma pasta ou nota existente
When o usuário renomeia ou move o item dentro do vault
Then o item é atualizado no filesystem
And o conteúdo original é preservado

### Cenário 5: tentativa fora do vault é rejeitada
Given uma operação com caminho inválido
When o sistema valida a operação
Then a operação é rejeitada
And nenhum arquivo é alterado

### Cenário 6: clique fora da árvore limpa a pasta ativa
Given uma pasta está selecionada
When o usuário clica fora da árvore de pastas e notas
Then a seleção de pasta é limpa
And a próxima criação volta a partir da raiz ou da nova seleção

## Refinamento futuro
- adicionar delete com proteção contra perda acidental
- suportar edição assistida por blocos ou frontmatter
- suportar operações em lote com preview
