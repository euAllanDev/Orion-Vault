<!-- GENERATED FILE: run `pnpm docs:sync-ai` -->
<!-- Source of truth: application/ai/skills/skill-registry.ts and skill-catalog.ts -->

# AI Start Here

Este texto e gerado a partir do catalogo interno de skills e flows do Orion Vault.

## O que e o Orion Vault
Orion Vault e um app local-first de notas Markdown, adaptado para trabalho conjunto com IA e agentes dentro de um vault seguro.

Ele nao e um terminal generico nem um explorador livre do filesystem.
Ele existe para ajudar IA e agentes a ler, buscar, planejar, editar e organizar notas usando contratos explicitos do produto.

O app oferece uma ponte controlada entre IA e vault:
- a IA consulta contexto do vault
- a IA busca notas relacionadas
- a IA gera plano e preview antes de escrever
- a IA aplica mudancas usando os comandos do app
- o app valida a fronteira do vault antes de executar escrita
- a IA e os agentes trabalham sobre notas, agenda, relacoes e organizacao local

## Como a IA deve agir
Antes de executar qualquer tarefa:
- rode `orion /guide` para ver o guia completo
- rode `orion /product-context` quando a pergunta for sobre o app em si, e nao apenas sobre uma nota ou o vault atual
- rode `orion /route-intent --query "<pergunta>"` quando quiser classificar explicitamente produto, vault ativo ou codigo do app
- rode `orion /skills` para ver o catalogo estruturado
- rode `orion /flows` para ver sequencias recomendadas
- use os contratos do app como caminho principal
- evite acesso direto a arquivos quando houver comando equivalente
- nunca prefira filesystem direto se existir skill ou comando do Orion Vault para a tarefa
- priorize contexto e planejamento antes de execucao

## Skills principais
- contexto: `start`, `guide`, `product-context`, `route-intent`, `context`, `search`, `retrieve`, `agent-context`, `related`, `analyze-note`
- planejamento: `prepare-writing-task`, `prepare-edit-task`, `plan`, `preview`, `diff`
- execucao segura: `organize-batch`, `apply`, `mkdir`, `touch`, `edit`, `rename`, `move`

## Fluxo recomendado
- start -> guide -> context -> search | retrieve | agent-context -> plan | preview -> apply
- use `apply` somente com `previewId` validado

## Escrita no vault
- use `mkdir`, `touch`, `edit`, `rename` e `move` para escrita direta e objetiva
- para textos grandes, prefira `--content-file` ou `--stdin`
- mantenha tudo dentro do vault ativo

## Resumo curto
Primeiro rode `orion /start`. Se a pergunta estiver ambigua, rode `orion /route-intent --query "<pergunta>"`. Se for sobre o produto, rode `orion /product-context`. Depois leia contexto. Depois busque. Depois gere preview. So aplique quando houver confirmacao valida.
