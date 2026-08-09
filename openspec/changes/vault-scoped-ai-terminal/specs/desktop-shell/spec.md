# Spec Delta: desktop-shell

## UPDATED Regras
- Regra 46: O terminal aberto pelo fluxo padrão da IA deve iniciar no vault ativo e manter o contrato do vault da sessão; manutenção da raiz do app, quando necessária, deve acontecer por fluxo separado.

## ADDED Regras
49. O fluxo padrão de IA do desktop deve tratar o vault ativo como diretório de trabalho primário e contexto operacional principal.
50. O desktop não deve expor a raiz do app como diretório inicial do fluxo normal da IA para tarefas de notas.
51. Se o produto oferecer um fluxo de manutenção interna do app, esse fluxo deve ser explícito, separado e não pode substituir a entrada padrão voltada ao vault.
52. O desktop deve apresentar o fluxo de IA como acesso a skills e recursos do produto, não como abertura de um terminal genérico sem orientação.
53. Quando a pergunta do usuário mencionar o app, o produto, a ferramenta ou o projeto, o fluxo padrão da IA deve distinguir explicitamente entre produto Orion Vault, vault ativo e código do app antes de responder.
54. O shell desktop deve expor um caminho explícito para contexto do produto, sem exigir que a IA inferira a identidade do app apenas a partir do diretório atual do vault.
55. Na build instalada, o launcher do terminal deve executar o script PowerShell e a CLI compilada a partir de recursos físicos fora de `app.asar`.
56. O runtime externo do terminal deve incluir as dependências e recursos locais necessários para carregar o onboarding sem exigir acesso ao ASAR por Node ou PowerShell.

## ADDED Pontos de atenção
- Abrir a IA direto no repositório do app aumenta o risco de respostas fora do escopo das notas do usuário.
- O diferencial do produto depende de a IA operar como copiloto do vault, não como exploradora padrão da base do app.
- A separação entre `trabalhar no vault` e `manter o app` precisa ser visível na interface e previsível para automação.
- O shell desktop deve reforçar, já na abertura, quais capacidades são de leitura, planejamento e execução segura.
- Perguntas ambíguas sobre "o app" não podem ser resolvidas só por leitura cega do vault atual.
- O launcher precisa ensinar a IA a diferenciar produto, conteúdo do vault e código-fonte antes de qualquer diagnóstico sobre a ferramenta.
- PowerShell e Node externos não compartilham o filesystem virtual do Electron; o fluxo instalado precisa resolver somente caminhos físicos destinados ao runtime do terminal.

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

### Cenário 6f: shell apresenta categorias de capacidade
Given a aplicação desktop está aberta com um vault ativo
When o usuário abre o terminal da IA pelo fluxo padrão
Then a sessão mostra um launcher curto e orientação inicial para skills do produto
And a execução segura aparece depois de contexto e planejamento

### Cenário 6g: pergunta sobre o app não é confundida com o vault
Given a aplicação desktop está aberta com um vault ativo
When o usuário pede uma opinião sobre "esse app"
Then a IA distingue produto Orion Vault, vault ativo e código do app antes de responder
And a sessão não conclui que o vault atual é o código-fonte do produto

### Cenário 6h: terminal empacotado inicia sem depender do ASAR
Given o Orion Vault foi instalado no Windows e possui um vault ativo
When o usuário abre o terminal da IA pelo fluxo padrão
Then o launcher usa um script PowerShell físico do runtime instalado
And o helper `orion` executa a CLI compilada com suas dependências locais disponíveis
And a sessão exibe o onboarding sem erro de arquivo, módulo ou `openspec/registry.md`
