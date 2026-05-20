# Spec Delta: desktop-shell

## UPDATED Regras
- Regra 46: O terminal aberto pelo fluxo padrão da IA deve iniciar no vault ativo e manter o contrato do vault da sessão; manutenção da raiz do app, quando necessária, deve acontecer por fluxo separado.

## ADDED Regras
49. O fluxo padrão de IA do desktop deve tratar o vault ativo como diretório de trabalho primário e contexto operacional principal.
50. O desktop não deve expor a raiz do app como diretório inicial do fluxo normal da IA para tarefas de notas.
51. Se o produto oferecer um fluxo de manutenção interna do app, esse fluxo deve ser explícito, separado e não pode substituir a entrada padrão voltada ao vault.

## ADDED Pontos de atenção
- Abrir a IA direto no repositório do app aumenta o risco de respostas fora do escopo das notas do usuário.
- O diferencial do produto depende de a IA operar como copiloto do vault, não como exploradora padrão da base do app.
- A separação entre `trabalhar no vault` e `manter o app` precisa ser visível na interface e previsível para automação.

## UPDATED Cenários
- Cenário 6c: Given a aplicação desktop está aberta com um vault ativo
When o usuário abre o terminal da IA pelo fluxo padrão
Then o terminal inicia no vault ativo
And o vault ativo permanece disponível como contexto autoritativo da sessão
And a IA não precisa navegar pela raiz do app para começar o fluxo do produto

## ADDED Cenários

### Cenário 6e: manutenção do app não contamina o fluxo padrão
Given a aplicação desktop está aberta com um vault ativo
When o usuário quer usar a IA para operar sobre notas
Then a entrada padrão da IA abre no vault ativo
And qualquer fluxo voltado ao repositório do app aparece como opção separada e explícita
