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
- atalho fixo de IA local no rodapé da sidebar
- cards, modais e menus com profundidade e separação clara

## Página 1: Vault Setup
Objetivo: validar e abrir o vault padrão automaticamente, usando setup/home apenas como fallback.

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
- o vault padrão deve ser aberto automaticamente ao iniciar o app
- na experiência desktop, o workspace deve aparecer primeiro quando houver um vault válido
- o setup deve funcionar como fallback e sem modais aninhados desnecessários
- o bootstrap automático deve usar a mesma rotina de `open` usada depois pelas ações da interface
- até a abertura terminar, o workspace deve permanecer em estado de carregamento ou vazio controlado, sem habilitar escrita

## Página 2: Vault Workspace
Objetivo: concentrar leitura, edição e organização.

Layout esperado:
- sidebar com seções do produto
- sidebar com modo recolhido para ícones apenas no desktop
- árvore de pastas e notas separadas por tipo
- editor central com conteúdo Markdown em leitura minimalista e fundo unificado
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
- a árvore deve refletir pastas vazias recém-criadas assim que o refresh local terminar
- diálogos internos de criação, renomeação e movimento devem invalidar sessões anteriores para evitar callbacks acumulados
- o título da nota aberta pode funcionar como ponto de rename inline, desde que a validação e a fronteira do vault permaneçam no backend
- diálogos internos, menus contextuais e notificações locais podem ser modularizados separadamente, desde que preservem a mesma coordenação de sessão e o mesmo fechamento previsível das superfícies auxiliares
- a orquestração de abertura do vault pode ser modularizada separadamente, desde que preserve o mesmo contrato de bootstrap e a mesma sincronização entre raiz visual e raiz realmente aberta
- a composição entre módulos da interface deve evitar acesso antecipado a controllers ainda não inicializados; quando houver dependência cíclica prática, a ligação deve acontecer por callback tardio

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
