# Design: vault-scoped-ai-terminal

## Decisão principal
O ponto de entrada curto da IA dentro do vault deve ser o slash command `/start`.

Nao vamos criar um novo vocabulário de comando para isso.

## Motivo
O produto já possui duas peças corretas para onboarding rápido:
- `ai-start-here.md` como orientação curta para IA
- `/start` como comando estável que imprime essa orientação

O problema atual não é falta de comando. O problema é o contexto operacional errado da sessão, que hoje nasce na raiz do app.

Ao abrir a sessão no vault ativo, `/start` passa a ser um ponto de entrada curto suficiente, desde que o terminal também ofereça um caminho óbvio para os demais comandos do produto.

## Forma concreta do fluxo
Fluxo padrão do desktop:

1. O usuário abre `Modo dev`
2. O terminal nasce no vault ativo
3. A sessão recebe `MARIKA_VAULT_ROOT` com o vault ativo
4. A mensagem inicial orienta:
   - rodar `/start`
   - depois `/guide`
   - depois `/context`, `/search`, `/plan`, `/preview` e `/apply`

## Ponto de entrada curto
O ponto de entrada curto será composto por duas camadas complementares:

1. `Slash command curto`
- `/start`
- deve continuar sendo a primeira instrução mostrada pelo onboarding

2. `Ajuda local acessível a partir do vault`
- a sessão aberta no vault deve conseguir executar os comandos do produto sem exigir navegação até a raiz do app
- isso pode acontecer por um launcher curto, alias de sessão ou script acessível no ambiente da sessão

## Recomendação de produto
Usar um launcher curto de sessão chamado `marika` no terminal aberto pelo desktop.

Exemplos:
- `marika /start`
- `marika /guide`
- `marika /context`
- `marika /search --query "arquitetura local"`

## Por que `marika` e não `pnpm dev`
- reduz atrito de digitação
- remove dependência de descobrir a raiz do app
- evita que a IA conclua que precisa explorar o repositório para usar a CLI
- mantém os comandos existentes intactos, apenas encurtando a entrada

## Recomendação técnica inicial
No terminal aberto pelo desktop, registrar um helper de sessão apontando para a CLI do produto.

Exemplo conceitual no PowerShell:
- função `marika` que invoca `tsx <appRoot>/interfaces/cli/main.ts` com os argumentos recebidos

Isso preserva:
- o diretório de trabalho no vault
- o contrato `MARIKA_VAULT_ROOT`
- o vocabulário já existente de slash commands

## Regras derivadas
- o onboarding deve mostrar primeiro `marika /start`, não apenas `/start`, se o terminal não interceptar slash commands sozinho
- o guia não deve mandar a IA procurar `comandos.md` no repositório do app como fluxo normal
- a sessão precisa tornar o launcher curto disponível imediatamente ao abrir

## Alternativas consideradas

### Alternativa 1: manter `pnpm dev`
Rejeitada.
Exige conhecimento do repositório e incentiva exploração da raiz do app.

### Alternativa 2: copiar `ai-start-here.md` para dentro de todo vault
Rejeitada como padrão.
Polui o vault do usuário com arquivo operacional do app e cria acoplamento desnecessário.

### Alternativa 3: criar novos comandos nativos sem slash
Rejeitada por agora.
O produto já consolidou `/start`, `/guide`, `/context`, `/search`, `/plan`, `/preview` e `/apply` como vocabulário principal.

## Decisão final
- O comando conceitual de entrada continua sendo `/start`
- O atalho operacional recomendado da sessão será `marika /start`
- A sessão padrão do desktop deve abrir no vault ativo
- O fluxo de manutenção do app fica fora dessa entrada padrão
