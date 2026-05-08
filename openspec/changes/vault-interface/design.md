# Design

## Visão geral
A interface adota uma linguagem visual dark, tátil e local-first, com superfícies profundas, painéis em camadas, acentos frios e uma sensação de produto desktop sólido.

O app continua dividido em duas superfícies principais:

1. `Vault Setup`: criar ou abrir vault com validação explícita.
2. `Vault Workspace`: navegar, editar, buscar, inspecionar e organizar notas.

## Linguagem visual
- sidebar fixa com navegação por intenção
- top bar com contexto do vault e ações rápidas
- área central mutável para setup, workspace, editor, graph ou busca
- painel auxiliar para backlinks, fixados, metadados e contexto
- launcher flutuante para IA local
- cards, modais e menus com profundidade e separação clara

## Página 1: Vault Setup
Objetivo: ativar o vault com segurança e clareza.

Componentes principais:
- campo visível para caminho do vault
- ações primárias para criar e abrir vault
- validação canônica da raiz
- resumo do vault ativo
- métricas rápidas do vault
- card rotativo com novidades ou destaques do produto
- atalhos para comandos mais usados

Regras de comportamento:
- a raiz escolhida deve ser validada antes de ficar ativa
- caminhos inválidos ou fora da fronteira devem ser rejeitados
- se o vault não existir, a interface pode orientar sua criação
- o setup deve funcionar como entrada principal e sem modais aninhados desnecessários

## Página 2: Vault Workspace
Objetivo: concentrar leitura, edição e organização.

Layout esperado:
- sidebar com seções do produto
- árvore de pastas e notas separadas por tipo
- editor central com conteúdo Markdown
- painel auxiliar com sumário, backlinks, fixados e grafo
- botões rápidos para criar, salvar, renomear, mover e fixar

Agrupamento de comandos:
- Observação: `inspect`, `validate`, `scan`, `context`, `doctor`
- Planejamento: `organize`, `plan`, `diff`
- Workspace: `mkdir`, `touch`, `edit`, `rename`, `move`
- Busca e utilidades: `search`, `sync`

Regras de comportamento:
- `organize` deve priorizar preview/dry-run
- ações de escrita precisam passar por validação
- a interface deve mostrar preview, no-ops, conflitos e erros
- o usuário precisa ver claramente o vault ativo antes de executar qualquer comando
- o grafo e a busca precisam ser acessíveis sem sair do workspace

## Estados
- vazio: nenhum vault selecionado
- válido: vault pronto para uso
- inválido: caminho rejeitado ou fora da fronteira
- carregando: leitura ou validação em progresso
- preview: plano calculado sem mutação
- erro: operação bloqueada ou falha controlada

## Navegação
- desktop: sidebar fixa + top bar + painéis laterais
- mobile: empilhamento dos painéis com navegação simples entre setup e workspace

## Segurança
- nenhuma operação pode escapar do vault configurado
- links simbólicos e caminhos canônicos devem continuar sendo validados
- a UI nunca deve ser a fonte de verdade da operação; apenas o backend/aplicação decide
