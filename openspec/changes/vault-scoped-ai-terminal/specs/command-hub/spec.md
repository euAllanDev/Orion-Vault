# Spec Delta: command-hub

## UPDATED Regras
- Regra 10: A ponte de IA via CLI deve reutilizar os mesmos comandos do hub para ler contexto, planejar e propor ações sobre notas, partindo do vault ativo como contexto padrão.
- Regra 13: O onboarding da IA deve apresentar `/start` como leitura inicial e os demais slash commands como caminho guiado para começar rápido a partir do vault ativo.

## ADDED Regras
21. O hub deve refletir um ponto de entrada curto da IA que possa ser usado a partir do vault ativo sem navegação pelo repositório do app.
22. O fluxo padrão apresentado pelo hub para a IA deve assumir o vault como fronteira e contexto primários.
23. Se houver comandos ou fluxos voltados à manutenção do app, eles devem ser apresentados separadamente do fluxo normal de notas.

## ADDED Pontos de atenção
- A lista de comandos da IA não deve induzir a sessão padrão a explorar o repositório do app.
- O vocabulário do hub deve reforçar que o alvo principal da IA é o vault ativo.

## ADDED Cenários

### Cenário 11: hub orienta a IA a partir do vault
Given o painel de comandos da IA está aberto
When o usuário consulta o fluxo inicial recomendado
Then o sistema mostra um caminho curto de operação a partir do vault ativo
And não exige descoberta prévia da raiz do app para usar os comandos do produto

### Cenário 12: fluxo de manutenção aparece separado
Given o produto oferece ações voltadas ao próprio app
When o usuário consulta os comandos disponíveis
Then o fluxo normal de notas aparece separado do fluxo de manutenção do app
And a fronteira do vault continua sendo a referência principal da IA
