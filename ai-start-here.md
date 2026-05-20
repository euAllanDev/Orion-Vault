# AI Start Here

Este arquivo e o ponto de entrada rapido para qualquer IA operando no terminal deste app.

## O que e o Marika
Marika e um app local-first para ler, editar, organizar e relacionar notas Markdown dentro de um vault seguro.

O app oferece uma ponte controlada entre IA e vault:
- a IA consulta contexto do vault
- a IA busca notas relacionadas
- a IA gera plano e preview antes de escrever
- a IA aplica mudancas usando os comandos do app
- o app valida a fronteira do vault antes de executar escrita

## Como a IA deve agir
Antes de executar qualquer tarefa:

1. Rode `marika /guide` para entender os comandos disponiveis.
2. Use os contratos do app como caminho principal.
3. Evite acesso direto a arquivos quando houver um comando equivalente.
4. Comece por contexto e busca antes de escrever.
5. Gere preview antes de aplicar mudancas.
6. Use `apply` somente com `previewId` validado.

## Fluxo recomendado
Use esta ordem na maioria das tarefas:

1. `marika /guide`
2. `marika /context`
3. `marika /search`
4. `marika /plan` ou `marika /preview`
5. `marika /apply --preview-id <id>`

## Escrita no vault
Se a tarefa pedir escrita direta:
- use `mkdir`, `touch`, `edit`, `rename` e `move`
- para textos grandes, prefira `--content-file` ou `--stdin`
- mantenha tudo dentro do vault ativo

## Regra beta
Nesta versao beta, a IA pode operar em um terminal local comum.
Mesmo assim, o comportamento esperado e reutilizar os comandos do app sempre que possivel, em vez de usar acesso direto ao filesystem como estrategia principal.

## Arquivos importantes
- `ai-start-here.md` -> entrada rapida para IA
- `comandos.md` -> referencia de comandos e exemplos
- `openspec/changes/ai-cli-bridge/step2.md` -> direcao da feature de ponte IA + app

## Resumo curto
Primeiro rode `marika /start`. Depois leia contexto. Depois busque. Depois gere preview. So aplique quando houver confirmacao valida.
