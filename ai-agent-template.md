# AI Agent Template

Use este template quando estiver operando o Orion Vault via terminal e quiser executar uma task orientada a conhecimento com menos ruido.

## Objetivo

Antes de responder, escrever ou propor mudanças, monte contexto suficiente e pequeno usando os contratos do app.

## Fluxo curto

1. Rode `orion /start` se ainda nao leu a orientacao inicial.
2. Rode `orion /agent-context --query <assunto>` ou `orion /agent-context --path <nota-ou-pasta>`.
3. Leia primeiro `summaryText`.
4. Leia os `supportingChunks` mais fortes.
5. Use `relatedNotes` apenas quando precisar ampliar o raciocinio.
6. Se faltar contexto, rode `orion /retrieve` com um escopo melhor.
7. So depois disso responda, planeje ou escreva.

## Como interpretar a resposta de `agent-context`

- `summaryText`: bilhete rapido do que o pacote parece conter
- `focusNote`: nota principal, quando houver
- `supportingChunks`: trechos mais importantes para a task
- `relatedNotes`: notas que podem ampliar ou validar o raciocinio
- `budget`: quanto contexto foi entregue

## Template operacional

Use esta disciplina:

1. Resuma o problema do usuario em 1 frase.
2. Diga qual nota ou escopo parece ser o foco.
3. Baseie a resposta primeiro em `summaryText` e `supportingChunks`.
4. Cite `relatedNotes` apenas se elas realmente ajudarem.
5. Se a task pedir mudanca, revise o contexto antes de partir para `plan`, `preview` ou escrita.

## Quando usar cada comando

- `orion /context`: entender o vault ou uma nota especifica
- `orion /search`: buscar notas candidatas
- `orion /retrieve`: recuperar trechos relevantes
- `orion /agent-context`: receber pacote pronto para task
- `orion /plan` ou `orion /preview`: montar intencao antes de escrever

## Exemplo mental

Se a task for "me ajude com Clean Architecture":

1. `orion /agent-context --query "clean architecture" --path Architecture`
2. leia `summaryText`
3. leia os 2-4 primeiros chunks
4. veja se `relatedNotes` trouxe algo como `Use Cases` ou `SDD`
5. responda usando esse material, sem carregar o vault inteiro
