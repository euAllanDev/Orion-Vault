# Spec Delta: ai-cli-bridge

## ADDED Regras
16. No desktop, o terminal da IA deve abrir na raiz do vault ativo como diretório de trabalho padrão.
17. O fluxo padrão da IA não deve depender de leitura da raiz do app para descobrir como operar sobre notas.
18. O sistema deve expor um ponto de entrada curto para os comandos do produto a partir da sessão aberta no vault.
19. O onboarding inicial da IA deve priorizar o vault ativo como contexto único da sessão normal de notas.
20. O fluxo padrão da IA deve distinguir operação sobre notas de manutenção interna do app.
21. A ponte de IA deve apresentar as capacidades do produto como skills e recursos explícitos, em vez de depender apenas de comandos soltos.
22. Skills de leitura e planejamento devem aparecer antes de recursos de execução no fluxo recomendado da IA.
23. A ponte de IA deve oferecer um recurso explícito de contexto do produto para distinguir app, vault ativo e código do app quando a intenção do usuário for ambígua.
24. Antes de responder a perguntas sobre "o app", a IA deve classificar explicitamente se o pedido é sobre produto, conteúdo do vault ou implementação interna do Orion Vault.

## UPDATED Regras
- Regra 9: O onboarding da IA deve orientar o usuário a abrir um terminal local visível no contexto operacional correto do vault, ler a orientação inicial da IA e iniciar o fluxo por slash commands.
- Regra 15: No desktop, o terminal da IA deve abrir no vault ativo e preservar o contrato do vault da sessão sem exigir navegação pela raiz do app.

## ADDED Pontos de atenção
- Abrir a sessão no vault reduz o risco de a IA misturar notas do usuário com documentação interna do produto.
- O ponto de entrada curto precisa funcionar sem obrigar a IA a procurar scripts ou specs no repositório do app.
- Se existir um fluxo de manutenção do app, ele deve ser explícito e separado do fluxo normal de notas.
- A linguagem de skill ajuda a IA a entender intenção, ordem de uso e limites de cada recurso oferecido pelo produto.
- Sem classificação explícita de escopo, a IA tende a tomar o vault atual como se fosse o próprio produto.
- O contrato do terminal precisa ensinar quando usar contexto de produto antes de contexto de nota.

## ADDED Cenários

### Cenário 7: terminal nasce dentro do vault ativo
Given a aplicação desktop está aberta com um vault ativo
When o usuário abre o terminal da IA pelo fluxo padrão
Then a sessão inicia com o vault ativo como diretório de trabalho
And a IA pode começar a operar sobre notas sem navegar pela raiz do app

### Cenário 8: onboarding curto sem descoberta do repositório
Given a sessão da IA foi aberta no vault ativo
When a IA lê a orientação inicial do produto
Then ela encontra o caminho para contexto, busca, plano e aplicação a partir dali
And não depende de inspecionar arquivos internos do repositório para descobrir esse fluxo

### Cenário 9: manutenção do app fica separada
Given existe necessidade de inspecionar ou manter o próprio app
When esse fluxo é acionado
Then ele acontece por um caminho explícito e separado do fluxo normal de notas
And a sessão padrão da IA continua focada no vault ativo

### Cenário 10: IA recebe um catálogo de skills do produto
Given a sessão da IA foi aberta no vault ativo
When a IA consulta a orientação inicial e o guia do produto
Then ela encontra skills de contexto, planejamento e execução segura apresentadas de forma explícita
And consegue escolher a próxima capacidade sem depender de inferência a partir do repositório do app

### Cenário 11: pedido sobre o produto é roteado corretamente
Given a sessão da IA foi aberta no vault ativo
When o usuário pede uma avaliação do app ou do produto
Then a IA usa um recurso explícito de contexto do produto para distinguir produto, vault e código do app
And não responde como se o vault atual fosse o repositório inteiro do Orion Vault
