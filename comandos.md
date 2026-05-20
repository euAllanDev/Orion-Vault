# Comandos da Aplicação

Este arquivo acompanha a aplicação e serve como guia rápido para humanos e IA.

Se voce for uma IA operando neste terminal, rode primeiro `marika /start`.

## O que este app faz
Marika e um app local-first para organizar, editar e explorar notas Markdown dentro de um vault seguro.

Com a feature de IA, o app funciona como uma ponte entre a IA e o vault:
- a IA le contexto do vault sem escrever direto no filesystem
- a IA busca notas relacionadas antes de agir
- a IA gera plano e preview antes de qualquer escrita
- a IA aplica mudancas somente pelos comandos do app
- o app valida a fronteira do vault antes de escrever

Em resumo: a IA sugere e opera pelos contratos do produto; o app valida e executa dentro do vault.

## Como a IA deve comecar
Quando o usuario pedir alguma tarefa no terminal, a IA deve seguir esta estrategia:

1. Rodar `marika /start` para ler a orientacao inicial da IA.
2. Rodar `marika /guide` quando precisar entender o fluxo do app.
2. Assumir que os comandos do produto sao o caminho principal para trabalhar com o vault.
3. Evitar acesso direto a arquivos quando houver comando equivalente do app.
4. Comecar por leitura e contexto antes de qualquer escrita.
5. Gerar preview antes de aplicar mudancas.
6. Usar `apply` somente com `previewId` validado.

## Fluxo recomendado para IA
Para quase toda tarefa, a ordem recomendada e:

1. `marika /guide` para rever o guia rapidamente se necessario
2. `marika /context` para entender o vault ativo ou a nota alvo
3. `marika /search` para ampliar contexto com notas relacionadas
4. `marika /plan` ou `marika /preview` para montar a intencao
5. `marika /apply --preview-id <id>` somente quando houver confirmacao valida

Atalho recomendado:

1. `marika /start`
2. `marika /guide`
3. continuar no fluxo acima

## Quando usar comandos de workspace
Use `mkdir`, `touch`, `edit`, `rename` e `move` quando a tarefa pedir escrita direta e objetiva no vault.

Mesmo nesses casos:
- prefira `--content-file` ou `--stdin` para textos grandes
- mantenha os caminhos dentro do vault ativo
- nao trate acesso direto ao filesystem como fluxo principal da IA

## Instalação
```bash
pnpm install
```

## Execução
```bash
pnpm dev
pnpm dev:desktop
```

## Observação e planejamento
```bash
marika /context
marika /search --query <texto>
marika /plan
marika /preview
marika /apply --preview-id <id>
```

Os slash commands acima devolvem saida estruturada em JSON para facilitar automacao local por IA.
O fluxo esperado e: `marika /context` -> `marika /search` -> `marika /plan` ou `marika /preview` -> `marika /apply --preview-id <id>`.

## Respostas estruturadas
- `success`: comando executado com sucesso
- `conflict`: o plano ou a escrita exigem revisao ou confirmacao
- `noop`: nao havia mudancas validas para executar
- `error`: houve falha de validacao ou execucao

## Workspace
```bash
pnpm dev mkdir --vault <path> --path <folder>
pnpm dev touch --vault <path> --path <file.md> --content <text>
pnpm dev edit --vault <path> --path <file.md> --content <text>
pnpm dev rename --vault <path> --source <path> --destination <path>
pnpm dev move --vault <path> --source <path> --destination <path>
```

Para textos maiores, prefira uma destas formas:

```bash
pnpm dev touch --vault <path> --path <file.md> --content-file <texto.md>
pnpm dev edit --vault <path> --path <file.md> --content-file <texto.md>
Get-Content .\texto.md -Raw | pnpm dev edit --vault <path> --path <file.md> --stdin
```

## Validação
```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Dica para IA
Se voce precisar descobrir os comandos da aplicacao, use `marika /guide`.
Nesta versao beta, use primeiro os comandos existentes do produto e evite acessar arquivos diretamente quando houver um comando equivalente para contexto, busca, preview ou apply.
