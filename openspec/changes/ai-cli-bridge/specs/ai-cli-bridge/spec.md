# Spec: ai-cli-bridge

## Regra de negócio
Uma IA local executada via CLI deve conseguir consultar, planejar e propor alteracoes nas notas do Orion Vault usando os mesmos contratos do produto, sem bypassar a fronteira segura do vault.

## Regras
1. A IA deve obter contexto local antes de agir.
2. A IA deve poder buscar notas relacionadas antes de propor uma mudança.
3. A IA deve receber um preview de plano antes de qualquer mutação.
4. A IA não deve escrever direto no filesystem sem validação do vault.
5. A IA deve reutilizar os comandos existentes do sistema.
6. A IA deve receber respostas estruturadas de sucesso, conflito, no-op e erro.
7. A IA deve permanecer opcional e local-first.
8. A interação da IA via CLI deve usar slash commands como `/start`, `/guide`, `/context`, `/search`, `/retrieve`, `/plan`, `/preview` e `/apply`.
9. O onboarding da IA deve orientar o usuário a abrir um terminal local visível no diretório adequado, ler a orientação inicial da IA e iniciar o fluxo por slash commands.
10. O acesso da IA no desktop deve ser apresentado como uma ação fixa `Modo dev` na sidebar, sem depender de launcher flutuante.
11. O painel de onboarding da IA pode exibir o fluxo de comandos e a lista de comandos sem depender de modais aninhados.
12. Na versao beta, a IA pode operar por um terminal local comum, desde que o fluxo recomendado e documentado a instrua a reutilizar apenas os comandos existentes do produto.
13. A IA deve ter um arquivo de entrada rapido, como `ai-start-here.md`, antes do guia completo de comandos.
14. Para textos longos, a CLI deve permitir formas robustas de entrada de conteudo, como `--content-file` ou `--stdin`, em vez de depender apenas de um argumento inline.
15. No desktop, o terminal da IA deve abrir na raiz do app e preservar o vault ativo por contrato ou ambiente.

## Pontos de atenção
- O fluxo da IA deve ser previsível para automação.
- A fronteira do vault continua sendo a regra central.
- O preview precisa ser suficientemente legível para decidir se aplica ou não.
- O core não deve depender de um modelo específico.
- Na versao beta, a seguranca operacional da IA pode depender de validacao e onboarding guiado, sem exigir sandbox completo do terminal.

## Cenários

### Cenário 1: contexto local
Given uma IA local conectada via CLI
When ela chama `/start` e depois `/context` para o vault ou para uma nota
Then o sistema retorna dados locais úteis para decisão
And nenhum arquivo é alterado

### Cenário 2: busca antes de agir
Given uma tarefa de edição ou organização
When a IA chama `/search` por notas relacionadas
Then o sistema retorna candidatos relevantes localmente
And a IA consegue escolher o próximo passo com base nisso

### Cenário 2b: retrieval explícito para contexto de task
Given uma tarefa orientada a conhecimento ou execução por agente
When a IA chama `/retrieve` com consulta e escopo opcional
Then o sistema retorna um pacote de chunks relevantes para a tarefa
And a IA pode montar a resposta ou a próxima ação com menos desperdício de tokens

### Cenário 3: plano antes da mutação
Given uma intenção de alteração
When a IA chama `/plan` ou `/preview`
Then o sistema mostra a sequência de ações prevista
And não muta o vault nessa etapa

### Cenário 4: escrita validada
Given um plano aprovado pela IA
When a IA chama `/apply` com um `previewId` validado para confirmar a ação
Then o sistema valida a fronteira do vault
And executa apenas operações locais permitidas

### Cenário 5: erro ou conflito
Given uma ação inválida, conflitante ou sem efeito
When o comando termina
Then o sistema devolve um resultado estruturado
And a IA pode decidir a próxima ação sem ambiguidade

### Cenário 6: texto longo entra de forma robusta
Given uma tarefa de criação ou edição com conteúdo Markdown grande
When a IA usa `touch` ou `edit` com `--content-file` ou `--stdin`
Then o sistema preserva o conteúdo multilinha corretamente
And a nota resultante continua dentro da fronteira do vault
