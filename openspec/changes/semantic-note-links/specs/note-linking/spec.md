# Spec: note linking

## Regra de negócio
O sistema deve tratar links entre notas como uma camada de navegação explícita e também como uma sugestão semântica local, permitindo converter relações detectadas em links reais no markdown com confirmação do usuário.

## Regras
1. O sistema deve reconhecer links manuais em formato wiki como `[[Nota]]` e links Markdown equivalentes entre notas do vault.
2. Links manuais renderizados na interface devem aparecer com aparência clara de link clicável, usando azul como cor principal e affordance visual compatível com navegação.
3. Ao clicar em um link renderizado, o sistema deve abrir a nota de destino diretamente.
4. O sistema pode sugerir links automáticos a partir do índice local de relações entre notas.
5. Links automáticos não podem alterar o markdown silenciosamente.
6. O usuário deve conseguir ver um preview da alteração antes de aplicar links automáticos ao conteúdo da nota.
7. Quando a referência já estiver presente no texto de forma inequívoca, o sistema deve preferir substituir esse trecho por um link real entre notas.
8. Quando a inserção inline não for segura ou natural, o sistema pode adicionar os links aprovados em uma seção dedicada como `## Relacionadas`.
9. A aplicação de links automáticos deve continuar respeitando a fronteira segura do vault e as regras de escrita já existentes.
10. Relações aplicadas ao markdown devem gerar links persistentes que passam a contar como links manuais da nota.

## Pontos de atenção
- Nem toda relação semântica forte deve virar link inline; o texto da nota precisa continuar natural para leitura humana.
- O preview deve deixar claro o diff entre conteúdo atual e conteúdo proposto.
- Títulos ambíguos ou múltiplas notas candidatas com o mesmo nome devem exigir desambiguação antes de aplicar o link.
- O estilo visual azul do link deve reforçar navegação sem comprometer contraste no tema escuro do app.

## Cenários

### Cenário 1: abrir link manual existente
Given uma nota com um link manual para outra nota do vault
When a nota é renderizada na interface
Then o link aparece em azul com aparência de navegação
And ao clicar o sistema abre a nota de destino

### Cenário 2: sugerir link automático sem editar a nota
Given uma nota com alta relação semântica com outra nota
When o sistema calcula sugestões locais de link
Then a sugestão fica disponível para revisão
And o markdown original permanece inalterado até confirmação

### Cenário 3: aplicar link inline com preview
Given uma sugestão automática cuja referência já aparece no corpo da nota
When o usuário revisa e confirma a aplicação
Then o sistema mostra o diff proposto
And substitui o trecho correspondente por um link real no markdown

### Cenário 4: aplicar links em seção dedicada
Given uma nota com sugestões relevantes sem ponto natural de inserção inline
When o usuário confirma a aplicação
Then o sistema adiciona uma seção dedicada de relacionadas no markdown
And preserva o restante do conteúdo existente

### Cenário 5: destino ambíguo bloqueia aplicação direta
Given uma sugestão automática com múltiplas notas possíveis para o mesmo texto de referência
When o usuário tenta aplicar o link
Then o sistema exige escolha explícita do destino
And não grava uma associação ambígua automaticamente

## Refinamento futuro
- suportar aliases e âncoras de heading na aplicação de links
- sugerir remoção de links fracos ou obsoletos
- permitir aplicar múltiplas sugestões em lote com preview consolidado
