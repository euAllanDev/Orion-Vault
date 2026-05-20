## ADDED Requirements

### Requirement: Agenda de notas com prazo
O sistema deve oferecer uma área dedicada para criar e acompanhar notas ligadas a datas, com entrada própria na sidebar.

### Requirement: Pasta fixa de agenda
O sistema deve manter `Agenda/` como pasta estrutural fixa do vault para armazenar e listar todas as notas de prazo.

### Requirement: Mesma raiz ativa do desktop
O sistema deve usar a mesma raiz ativa do desktop para criar, salvar e listar notas de agenda, mantendo `Agenda/` como subpasta fixa dessa raiz.

#### Scenario: Abrir menu de opções
- **WHEN** o usuário clica no botão de opções da fila de prazos
- **THEN** o sistema exibe um menu com ações rápidas e filtros visuais em cartões

#### Scenario: Criar nota com data
- **WHEN** o usuário preenche título, data e status inicial na área de agenda
- **THEN** o sistema cria uma nota Markdown dentro de `Agenda/` com metadados mínimos de prazo e status

#### Scenario: Pasta de agenda existe no vault
- **WHEN** o vault padrão é aberto ou um vault existente é carregado no desktop
- **THEN** a pasta `Agenda/` é garantida como parte estrutural do vault

#### Scenario: Listar notas com prazo
- **WHEN** a área de agenda é aberta
- **THEN** o sistema lista as notas com prazo a partir de `Agenda/`, mostrando estado pendente, concluído ou em atraso

#### Scenario: Notas de agenda aparecem no board dedicado
- **WHEN** uma nota nova é criada em `Agenda/`
- **THEN** a lista da agenda é atualizada imediatamente
- **AND** a nota fica visível sem exigir troca de tela

#### Scenario: Agenda usa o vault ativo do desktop
- **WHEN** o usuário salva uma nota de agenda no desktop
- **THEN** o sistema grava a nota dentro de `Agenda/` da raiz ativa atual
- **AND** a fila de prazos recarrega a partir da mesma raiz ativa

#### Scenario: Filtrar fila de prazos
- **WHEN** o usuário escolhe um filtro no menu de opções
- **THEN** o sistema atualiza a fila para mostrar apenas os itens do estado selecionado

### Requirement: Notificações nativas no desktop
O sistema deve emitir notificações nativas apenas na experiência desktop, usando alertas fixos em 1 dia, 1 hora e no horário do prazo, com um som local de lembrete reproduzido junto ao alerta. A experiência também deve poder disparar um resumo da agenda ao abrir, mostrar ou restaurar a janela desktop quando houver itens pendentes relevantes.

#### Scenario: Aviso antes do prazo
- **WHEN** uma nota está a 1 dia ou 1 hora do vencimento e ainda não foi concluída
- **THEN** o sistema dispara uma notificação local correspondente

#### Scenario: Aviso no horário
- **WHEN** o horário do prazo é atingido e a nota ainda não foi concluída
- **THEN** o sistema dispara uma notificação local de vencimento

#### Scenario: Resumo da agenda ao abrir o desktop
- **WHEN** a janela desktop termina de abrir, é mostrada novamente ou volta de minimizada
- **AND** existem itens pendentes, importantes para hoje ou em atraso
- **THEN** o sistema pode disparar uma notificação nativa resumindo esse estado da agenda
- **AND** evita repetir esse resumo continuamente dentro da janela curta de reabertura

#### Scenario: Alerta com som local
- **WHEN** um lembrete de agenda é disparado no desktop
- **THEN** o sistema reproduz o som local configurado para lembrete
- **AND** o alerta mantém o comportamento local-first sem depender do browser

#### Scenario: Clique na notificação abre a agenda
- **WHEN** o usuário clica em uma notificação nativa de agenda no desktop
- **THEN** o app principal é trazido para frente
- **AND** a interface navega para a área de agenda

#### Scenario: Notificação usa identidade do app no desktop
- **WHEN** uma notificação nativa de agenda é exibida no shell desktop
- **THEN** o sistema tenta usar a identidade visual do app empacotado, incluindo o ícone configurado
- **AND** a identificação final ainda pode depender das limitações do sistema operacional e do modo de execução

### Requirement: Browser fora do escopo inicial
O sistema deve registrar que o suporte a notificações no browser fica fora do escopo inicial desta mudança.

#### Scenario: Escopo futuro
- **WHEN** a especificação é consultada
- **THEN** fica explícito que o browser será tratado em uma evolução futura
