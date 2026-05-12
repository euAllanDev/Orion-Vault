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
11. A ponte de IA via CLI deve usar o mesmo vocabulário em slash commands, como `/context`, `/search`, `/plan`, `/preview` e `/apply`.
12. O onboarding da IA deve apresentar esses slash commands como caminho guiado para começar rápido.
13. O onboarding da IA no desktop deve manter o fluxo de comandos dentro do painel da própria IA, sem exigir modais aninhados.
14. A interface não deve liberar criação de nota, criação de pasta ou escrita de conteúdo enquanto o vault ativo ainda não estiver pronto para uso.
15. Após criar uma pasta vazia ou uma nota, a árvore do workspace deve refletir o novo item imediatamente no mesmo vault ativo.
16. Os diálogos internos de criação, renomeação e movimento devem manter apenas um conjunto de callbacks ativo por vez.

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
When ela chama slash commands como `/context`, `/search` ou `/plan` para uma nota
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
