## ADDED Requirements

### Requirement: Overview com painel vivo
O sistema deve transformar a página `Overview` em um painel inicial com contexto útil e leitura rápida.

#### Scenario: Exibir cards principais
- **WHEN** o usuário entra no `Overview`
- **THEN** o sistema exibe cartões para próximos prazos, atividade recente e resumo do vault

### Requirement: Layout em bento
O sistema deve organizar os cards do `Overview` em uma composição hierárquica em estilo bento, destacando o conteúdo mais importante.

#### Scenario: Hierarquia visual dos cards
- **WHEN** a página `Overview` é renderizada em desktop
- **THEN** um card principal recebe mais espaço visual e os demais cards ocupam blocos menores ao redor

#### Scenario: Resumo em coluna lateral
- **WHEN** o `Overview` é renderizado em desktop
- **THEN** o resumo do vault e os gráficos ficam agrupados em uma coluna lateral única

#### Scenario: Composição ocupa a área útil
- **WHEN** o `Overview` é renderizado em desktop em uma janela comum 16:9
- **THEN** os cards principais ocupam a área útil sem vazios laterais ou inferiores desproporcionais
- **AND** a leitura continua compacta e equilibrada

### Requirement: Ações rápidas em menu
O sistema deve expor as ações rápidas do `Overview` em um botão de opções no topo, em vez de um card dedicado.

#### Scenario: Abrir ações rápidas
- **WHEN** o usuário clica no botão de opções do `Overview`
- **THEN** o sistema mostra ações rápidas como criar nota, criar nota com data, abrir agenda e abrir o graph view
- **AND** o menu abre acima do conteúdo, sem ficar atrás dos cards do overview

### Requirement: Gráficos no canto
O sistema deve mostrar gráficos leves no canto do `Overview` para reforçar atividade, prazos e saúde do vault.

#### Scenario: Exibir gráficos
- **WHEN** o `Overview` é carregado
- **THEN** o sistema exibe gráficos compactos sem depender do painel auxiliar do workspace

### Requirement: Prioridade para prazos e atividade
O sistema deve priorizar informações que ajudem o usuário a decidir o próximo passo rapidamente.

#### Scenario: Mostrar próximos prazos
- **WHEN** houver notas com prazo na agenda
- **THEN** o `Overview` destaca os itens mais urgentes e os em atraso primeiro

#### Scenario: Mostrar atividade recente
- **WHEN** houver histórico recente de notas
- **THEN** o `Overview` lista as últimas ações sem exigir navegação adicional
