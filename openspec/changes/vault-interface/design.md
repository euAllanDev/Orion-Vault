# Design

## Visão geral
A interface é dividida em duas páginas.

1. `Vault Setup`: criação ou abertura do vault e validação da raiz.
2. `Vault Workspace`: inspeção, organização e acesso aos comandos já implementados.

O design é local-first. A UI não acessa o filesystem diretamente; ela apenas solicita ações à camada de aplicação.

## Página 1: Vault Setup
Objetivo: deixar o vault pronto para uso.

Componentes principais:
- seletor de caminho do vault
- ação de criar ou abrir vault
- status de validação da raiz
- resumo do vault ativo
- mensagens de erro controladas

Regras de comportamento:
- a raiz escolhida deve ser validada antes de ficar ativa
- caminhos inválidos ou fora da fronteira devem ser rejeitados
- se o vault não existir, a interface pode orientar sua criação
- a página deve funcionar como ponto único de entrada do fluxo

## Página 2: Vault Workspace
Objetivo: concentrar os comandos operacionais já criados.

Agrupamento sugerido:
- Observação: `inspect`, `validate`, `scan`, `context`, `doctor`
- Planejamento: `organize`, `plan`, `diff`
- Workspace: `mkdir`, `touch`, `edit`, `rename`, `move`
- Busca e utilidades: `search`, `sync`

Regras de comportamento:
- `organize` deve priorizar preview/dry-run
- ações de escrita precisam passar por validação
- a interface deve mostrar preview, no-ops, conflitos e erros
- o usuário precisa ver claramente o vault ativo antes de executar qualquer comando

## Estados
- vazio: nenhum vault selecionado
- válido: vault pronto para uso
- inválido: caminho rejeitado ou fora da fronteira
- carregando: leitura ou validação em progresso
- preview: plano calculado sem mutação

## Navegação
- desktop: layout em duas colunas ou com sidebar fixa
- mobile: páginas empilhadas e navegação simples entre setup e workspace

## Segurança
- nenhuma operação pode escapar do vault configurado
- links simbólicos e caminhos canônicos devem continuar sendo validados
- a UI nunca deve ser a fonte de verdade da operação; apenas o backend/aplicação decide
