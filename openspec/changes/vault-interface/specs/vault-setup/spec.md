# Spec: vault setup

## Regra de negócio
O sistema deve permitir criar ou abrir um vault local com segurança, tornando a raiz escolhida a referência ativa da interface.

## Regras
1. O usuário deve conseguir informar um caminho para criar ou abrir um vault.
2. A raiz escolhida deve ser validada antes de virar o vault ativo.
3. O sistema deve rejeitar caminhos fora da fronteira permitida.
4. O sistema deve mostrar o estado do vault ativo para a interface.
5. Erros de caminho, validação ou configuração devem aparecer de forma controlada.

## Pontos de atenção
- A criação do vault não deve presumir estrutura interna obrigatória além da raiz segura.
- A validação da raiz deve ser canônica e não apenas textual.
- A interface deve distinguir claramente entre vault ausente, vault inválido e vault ativo.

## Cenários

### Cenário 1: criar um vault novo
Given um caminho válido para um vault ainda inexistente
When o usuário confirma a criação
Then o sistema cria ou prepara a raiz do vault
And valida a fronteira
And marca o vault como ativo

### Cenário 2: abrir um vault existente
Given um vault local já existente
When o usuário seleciona a raiz
Then o sistema valida o caminho
And carrega o vault como ativo
And exibe seu estado na interface

### Cenário 3: caminho inválido é rejeitado
Given um caminho que escapa da fronteira permitida
When o sistema tenta validar a raiz
Then a operação é rejeitada
And o vault ativo não é alterado

### Cenário 4: vault sem seleção
Given nenhum vault configurado na sessão
When a interface carrega
Then a página de setup é apresentada
And nenhum comando de workspace é executado
