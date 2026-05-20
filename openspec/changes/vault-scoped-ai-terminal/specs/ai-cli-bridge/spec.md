# Spec Delta: ai-cli-bridge

## ADDED Regras
16. No desktop, o terminal da IA deve abrir na raiz do vault ativo como diretório de trabalho padrão.
17. O fluxo padrão da IA não deve depender de leitura da raiz do app para descobrir como operar sobre notas.
18. O sistema deve expor um ponto de entrada curto para os comandos do produto a partir da sessão aberta no vault.
19. O onboarding inicial da IA deve priorizar o vault ativo como contexto único da sessão normal de notas.
20. O fluxo padrão da IA deve distinguir operação sobre notas de manutenção interna do app.

## UPDATED Regras
- Regra 9: O onboarding da IA deve orientar o usuário a abrir um terminal local visível no contexto operacional correto do vault, ler a orientação inicial da IA e iniciar o fluxo por slash commands.
- Regra 15: No desktop, o terminal da IA deve abrir no vault ativo e preservar o contrato do vault da sessão sem exigir navegação pela raiz do app.

## ADDED Pontos de atenção
- Abrir a sessão no vault reduz o risco de a IA misturar notas do usuário com documentação interna do produto.
- O ponto de entrada curto precisa funcionar sem obrigar a IA a procurar scripts ou specs no repositório do app.
- Se existir um fluxo de manutenção do app, ele deve ser explícito e separado do fluxo normal de notas.

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
