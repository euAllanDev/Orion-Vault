# Spec: command hub

## Regra de negócio
A interface deve expor os comandos existentes do sistema em uma página operacional única, organizada por intenção e com resultados legíveis.

## Regras
1. Os comandos devem ser apresentados em grupos coerentes com o fluxo do usuário.
2. O hub deve abranger leitura, planejamento, workspace e utilidades.
3. `organize` deve aparecer como fluxo de preview e planejamento antes de mutação.
4. Comandos de escrita só podem seguir após validação de segurança.
5. A interface deve mostrar resultado, conflito, no-op e erro sem ambiguidade.
6. A ação de criação deve respeitar a pasta atualmente selecionada, sem exigir que o usuário digite o caminho completo manualmente.
7. A navegação da árvore deve priorizar pastas antes de notas, e exibir somente o nome da nota na linha principal.
8. O menu de contexto em pastas deve expor as mesmas ações principais do hub, de forma consistente.
9. A interface desktop deve expor um botão para listar os comandos disponíveis, agrupados por intenção.
10. A ponte de IA via CLI deve reutilizar os mesmos comandos do hub para ler contexto, planejar e propor ações sobre notas.
11. A ponte de IA via CLI deve usar o mesmo vocabulário em slash commands, como `/start`, `/guide`, `/context`, `/search`, `/plan`, `/preview` e `/apply`.
12. A seleção de pasta no workspace deve ser desfeita ao clicar fora da árvore de pastas e notas, sem depender de controle manual dedicado.
13. O onboarding da IA deve apresentar `/start` como leitura inicial e os demais slash commands como caminho guiado para começar rápido.
14. O onboarding da IA no desktop deve manter o fluxo de comandos dentro do painel da própria IA, sem exigir modais aninhados.
15. A interface não deve liberar criação de nota, criação de pasta ou escrita de conteúdo enquanto o vault ativo ainda não estiver pronto para uso.
16. Após criar uma pasta vazia ou uma nota, a árvore do workspace deve refletir o novo item imediatamente no mesmo vault ativo.
17. Os diálogos internos de criação, renomeação, movimento e seleção de links devem manter apenas um conjunto de callbacks ativo por vez.
18. O menu de opções da nota deve oferecer uma ação explícita de `linkar`, substituindo a ação de relações nessa superfície.
19. No desktop, o acesso à IA deve aparecer como ação fixa `Modo dev` na sidebar, sem depender de launcher flutuante sobre o workspace.
20. Mudanças feitas no vault por terminal, automação local ou outros fluxos externos devem aparecer no workspace sem exigir reinício manual do app.
21. A implementação de busca local, modelos e seletor de links pode ser modularizada separadamente, desde que preserve os mesmos contratos de filtro local, abertura de nota, seleção de modelo e inserção de wiki link no vault ativo.
22. A implementação de diálogos internos, menus contextuais e notificações locais pode ser modularizada separadamente, desde que preserve a mesma invalidação de sessões anteriores e o mesmo fechamento coordenado das superfícies auxiliares.

## Pontos de atenção
- O hub deve refletir os contratos já existentes, não inventar novos comportamentos.
- O usuário precisa ver o vault ativo antes de executar qualquer comando.
- A ordenação visual deve favorecer `inspect` e `organize` como comandos principais.
- A experiência de criação não deve depender de caminhos brutos nem expor o path completo como texto principal da lista.
- O destaque visual de pastas deve ser sutil, preservando a hierarquia sem excesso de contraste.
- As ações de criação e renomeação devem usar entrada interna da interface, não prompts do navegador.
- Um vault ainda em bootstrap não conta como vault pronto para comandos de escrita, mesmo que a tela do workspace já esteja montada.
- Um refresh da árvore após criação precisa cobrir pastas vazias e notas novas sem depender de navegação adicional.
- Diálogos internos não podem acumular listeners antigos e disparar ações duplicadas ou cruzadas.
- O seletor de links deve listar notas do vault ativo e permitir filtro local antes de inserir um wiki link.
- A modularização dessas superfícies auxiliares não pode criar caminhos paralelos de abertura, escrita ou seleção fora do vault ativo.
- A modularização dos diálogos e menus não pode reintroduzir listeners acumulados nem quebrar a regra de apenas uma sessão ativa por vez.

## Cenários

### Cenário 1: comandos organizados por intenção
Given um vault ativo
When a página de comandos é aberta
Then o sistema apresenta grupos de observação, planejamento, workspace e utilidades
And cada comando fica acessível no grupo correto

### Cenário 1b: criação orientada pela pasta ativa
Given um vault ativo e uma pasta selecionada
When o usuário aciona uma ação de criação
Then a nova pasta ou nota é criada dentro da pasta selecionada
And o usuário não precisa informar o caminho completo manualmente

### Cenário 1c: criação fica bloqueada durante bootstrap
Given o desktop ainda está abrindo o vault padrão
When o usuário tenta criar uma nota ou uma pasta antes da conclusão do bootstrap
Then a interface aguarda o vault ativo ou bloqueia a ação com mensagem controlada
And nenhuma escrita acontece com o workspace ainda em estado parcial

### Cenário 2: preview de organização
Given um vault com notas elegíveis para organização
When o usuário aciona `organize`
Then o sistema exibe um preview do plano
And não muta o filesystem no fluxo principal

### Cenário 3: ação de escrita validada
Given uma ação de workspace como criar, editar, renomear ou mover
When o usuário confirma a execução
Then o sistema valida a ação
And só executa se o caminho permanecer dentro do vault

### Cenário 3b: nova pasta vazia aparece na árvore
Given um vault ativo no workspace
When o usuário confirma a criação de uma pasta vazia
Then o sistema cria a pasta no vault ativo
And o refresh seguinte da árvore mostra essa pasta imediatamente
And o usuário não precisa trocar de view para enxergar o diretório recém-criado

### Cenário 4: erro ou no-op visível
Given uma operação inválida ou sem efeito
When o comando termina
Then a interface mostra o motivo ou o no-op
And o usuário não fica sem feedback

### Cenário 5: IA via CLI conversa com as notas
Given uma IA local usando a CLI do projeto
When ela chama `/start` e depois slash commands como `/context`, `/search` ou `/plan` para uma nota
Then a interface fornece os mesmos comandos do hub
And qualquer mutação sugerida precisa passar por validação de segurança

### Cenário 6: comandos da IA ficam no painel
Given o popup de onboarding da IA está aberto
When o usuário pede para ver os comandos
Then a lista agrupada é exibida dentro do mesmo painel
And o usuário pode alternar a visibilidade sem perder o contexto atual

### Cenário 7: diálogo interno não reaproveita callbacks antigos
Given um diálogo interno de criação ou renomeação foi aberto anteriormente
When um novo diálogo substitui a sessão anterior
Then apenas a sessão atual pode confirmar a ação
And handlers antigos não podem disparar criações extras ou de outro tipo

### Cenário 8: link manual via seletor
Given uma nota aberta no editor
When o usuário aciona `linkar` no menu de opções
Then a interface mostra uma lista filtrável de notas do vault ativo
And ao escolher uma nota o sistema insere um wiki link no markdown da nota atual

### Cenário 9: acesso da IA fica fixo na lateral
Given a interface desktop está aberta
When o usuário procura o acesso da IA local
Then a sidebar exibe a ação `Modo dev` como ponto de entrada estável
And o fluxo de onboarding e comandos continua abrindo no painel da própria IA

### Cenário 10: mudanças externas atualizam o workspace
Given o workspace desktop está aberto em um vault ativo
When uma pasta ou nota é criada por terminal local ou outro fluxo externo dentro do mesmo vault
Then a árvore do workspace reflete a mudança sem reinício manual do app
And o usuário continua vendo a raiz ativa correta

### Cenário 11: busca, modelos e link picker podem ser extraídos sem mudar o comportamento
Given a interface desktop modulariza busca local, modelos e seletor de links em um módulo dedicado
When o usuário busca notas, escolhe um modelo ou seleciona uma nota para inserir um wiki link
Then a interface continua aplicando o mesmo filtro local e a mesma abertura de nota
And a seleção de modelo e a inserção de wiki link continuam usando o mesmo fluxo principal do vault ativo

### Cenário 12: diálogos e menus podem ser extraídos sem mudar o comportamento
Given a interface desktop modulariza diálogos internos, menus contextuais e notificações locais em um módulo dedicado
When o usuário abre confirmações, entradas internas, menus de contexto ou superfícies auxiliares do workspace
Then a interface continua mantendo apenas uma sessão ativa por vez quando aplicável
And o fechamento coordenado dessas superfícies continua previsível dentro do mesmo fluxo principal do app
