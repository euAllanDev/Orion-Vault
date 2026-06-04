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
3. A sessão recebe `ORION_VAULT_ROOT` com o vault ativo
4. A mensagem inicial orienta:
   - rodar `/start`
   - depois `/guide`
   - depois `/context`, `/search`, `/plan`, `/preview` e `/apply`

## Modelo de capacidades para IA
O terminal aberto no vault não deve expor apenas uma lista de comandos soltos.

O produto deve tratar esses comandos como skills e recursos operacionais explícitos para IA.

### Skills de contexto
- `/start`
- `/guide`
- `/context`
- `/search`
- `/retrieve`
- `/agent-context`
- `/related`

### Skills de planejamento
- `/plan`
- `/preview`
- `diff`

### Recursos de execução segura
- `/apply`
- `mkdir`
- `touch`
- `edit`
- `rename`
- `move`

## Papel do framework de skills
O objetivo não é criar outro vocabulário paralelo.

O objetivo é formalizar que:
- a IA deve operar pelas capacidades do app
- cada capacidade possui intenção clara, fronteira e saída previsível
- o onboarding deve ensinar categorias de skill, não apenas exemplos de comando
- skills de notas e manutenção do app devem aparecer separadas

## Catálogo operacional recomendado
Além de onboarding e guia textual, o produto deve poder expor um catálogo local de capabilities para IA.

Esse catálogo pode ser apresentado por comandos como:
- `orion /skills`
- `orion /skills --category context`
- `orion /flows`

## Estrutura conceitual do catálogo
Cada skill deve poder ser descrita com metadados previsíveis.

Campos recomendados:
- `id`
- `category`
- `description`
- `whenToUse`
- `inputs`
- `output`
- `mutatesVault`
- `requiresPreview`
- `examples`

Cada flow deve poder ser descrito com:
- `id`
- `description`
- `steps`
- `notes`

## Objetivo do catálogo
O catálogo existe para:
- reduzir ambiguidade operacional da IA
- permitir descoberta das capabilities sem leitura do repositório
- tornar o fluxo recomendado consumível por humanos, IA e futura automação
- preservar os comandos atuais enquanto eleva a camada conceitual de uso

## Recomendação de produto para a sessão
Ao abrir o terminal no vault, o produto deve deixar claro que `orion` e o launcher curto da sessao e que os slash commands representam skills do app.

Na superficie visual do `Modo dev`, o resumo rapido nao deve ficar preso apenas às primitives mais antigas.

O card principal do launcher deve priorizar um fluxo orientado por intenção:
- `orion /start`
- `orion /route-intent --query "o que voce quer descobrir?"`
- `orion /product-context`
- depois comandos compostos de task como `orion /analyze-note`, `orion /prepare-edit-task`, `orion /prepare-writing-task` e `orion /organize-batch`

Isso reduz ambiguidade logo na entrada e aproxima o launcher visual do fluxo real recomendado para usuário dev.

Exemplo de leitura conceitual:
- `orion /context` -> skill de contexto
- `orion /agent-context` -> skill composta pronta para task
- `orion /preview` -> skill de planejamento validavel
- `orion /apply --preview-id <id>` -> recurso de execucao guardado por confirmacao

## Ponto de entrada curto
O ponto de entrada curto será composto por duas camadas complementares:

1. `Slash command curto`
- `/start`
- deve continuar sendo a primeira instrução mostrada pelo onboarding

2. `Ajuda local acessível a partir do vault`
- a sessão aberta no vault deve conseguir executar os comandos do produto sem exigir navegação até a raiz do app
- isso pode acontecer por um launcher curto, alias de sessão ou script acessível no ambiente da sessão

## Recomendação de produto
Usar um launcher curto de sessao chamado `orion` no terminal aberto pelo desktop.

Exemplos:
- `orion /start`
- `orion /guide`
- `orion /context`
- `orion /search --query "arquitetura local"`

## Por que `orion` e nao `pnpm dev`
- reduz atrito de digitação
- remove dependência de descobrir a raiz do app
- evita que a IA conclua que precisa explorar o repositório para usar a CLI
- mantém os comandos existentes intactos, apenas encurtando a entrada

## Recomendação técnica inicial
No terminal aberto pelo desktop, registrar um helper de sessão apontando para a CLI do produto.

Exemplo conceitual no PowerShell:
- funcao `orion` que invoca `tsx <appRoot>/interfaces/cli/main.ts` com os argumentos recebidos

Isso preserva:
- o diretório de trabalho no vault
- o contrato `ORION_VAULT_ROOT`
- o vocabulário já existente de slash commands

## Regras derivadas
- o onboarding deve mostrar primeiro `orion /start`, nao apenas `/start`, se o terminal nao interceptar slash commands sozinho
- o guia não deve mandar a IA procurar `comandos.md` no repositório do app como fluxo normal
- a sessão precisa tornar o launcher curto disponível imediatamente ao abrir
- a ajuda inicial deve apresentar categorias de skills e recursos do app voltados à IA
- o fluxo normal deve reforçar primeiro skills de leitura e planejamento, depois recursos de execução
- o catálogo de skills deve reaproveitar o vocabulário existente em vez de criar aliases concorrentes
- flows recomendados devem declarar explicitamente a ordem leitura -> planejamento -> execução

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
- O atalho operacional recomendado da sessao sera `orion /start`
- A sessão padrão do desktop deve abrir no vault ativo
- O fluxo de manutenção do app fica fora dessa entrada padrão

## Estado implementado hoje
Na base atual, os seguintes pontos deste design já existem de forma concreta:
- o desktop abre o terminal da IA com helper de sessão `orion`
- a sessão define `ORION_VAULT_ROOT` e usa o vault ativo como diretório padrão
- `orion /onboarding`, `orion /skills` e `orion /flows` já existem
- `ai-start-here.md` e `comandos.md` são gerados a partir do catálogo interno de skills
- `analyze-note`, `prepare-edit-task`, `prepare-writing-task` e `maintenance-diagnose` já existem como comandos reais

Pontos ainda não fechados no mesmo nível:
- a abertura real do terminal desktop ainda está validada principalmente por inspeção manual no fluxo completo do Electron, embora o script `start-ai-terminal.ps1` já tenha teste automatizado

## Próxima etapa recomendada
Depois da consolidação do catálogo atual, a evolução natural do `Orion Vault` é subir o nível sem quebrar as primitivas existentes.

Direção recomendada:
- manter `orion /context`, `orion /search`, `orion /retrieve`, `orion /preview` e `orion /apply` como base operacional autoritativa
- introduzir skills compostas de nível mais alto, como análise, preparação de escrita e organização orientada a intenção
- separar a apresentação de `skills de notas` e `skills de manutenção do app` também em flows recomendados

Exemplos conceituais de próxima fase:
- `analyze-note`
- `prepare-edit-task`
- `prepare-writing-task`
- `organize-batch`
- `maintenance-diagnose`

## Primeira leva de skills compostas
As primeiras skills compostas devem ser declarativas, previsíveis e derivadas das primitives já existentes.

Status atual da primeira leva:
- `analyze-note`: implementada como comando dedicado
- `prepare-edit-task`: implementada como comando dedicado
- `prepare-writing-task`: implementada como comando dedicado
- `maintenance-diagnose`: implementada como comando dedicado
- `organize-batch`: implementada como comando dedicado em uma primeira versão focada no preview do vault ativo

### 1. `analyze-note`
Objetivo:
- montar rapidamente um pacote de compreensão para uma nota ou escopo

Composição esperada:
- `context`
- `related`
- `agent-context`

Saída esperada:
- foco principal
- resumo curto
- supporting chunks
- related notes
- observações sobre limites do contexto

### 2. `prepare-edit-task`
Objetivo:
- preparar contexto suficiente antes de revisar, expandir ou corrigir uma nota existente

Composição esperada:
- `context`
- `agent-context`
- `retrieve`
- `related`

Saída esperada:
- foco da edição
- supporting chunks
- riscos principais
- alvos relacionados para revisão
- próximo passo recomendado

### 3. `prepare-writing-task`
Objetivo:
- preparar material suficiente antes de escrita assistida ou resposta longa

Composição esperada:
- `context` ou `agent-context`
- `search` ou `retrieve`
- `preview` quando a task envolver mutação relevante

Saída esperada:
- foco da escrita
- chunks principais
- riscos e lacunas de contexto
- próximo passo recomendado

### 4. `organize-batch`
Objetivo:
- encapsular o fluxo padrão de organização orientado a preview para múltiplas notas

Composição esperada:
- `context`
- `search` quando necessário
- `plan` ou `preview`
- `apply` somente após confirmação válida

Saída esperada:
- escopo do batch
- previewId quando houver
- ações sugeridas
- status da confirmação

### 5. `maintenance-diagnose`
Objetivo:
- separar explicitamente a leitura técnica do app e do vault do fluxo normal de notas

Composição esperada:
- `inspect`
- `validate`
- `scan`
- `doctor`

Saída esperada:
- resumo técnico
- issues encontrados
- ações de manutenção sugeridas

## Regra de composição
Essas skills compostas:
- não substituem as primitives existentes
- não criam um segundo conjunto obrigatório de comandos
- devem declarar explicitamente quais primitives usam
- devem deixar claro quando a execução termina em leitura, preview ou mutação

## Fase de readiness pública
Depois de consolidar onboarding, catálogo, launcher `orion` e a primeira leva de skills compostas reais, o `Orion Vault` entra numa fase de readiness para MVP público.

Essa fase deve assumir duas superfícies principais:
- `Manual Mode`: fluxo estável para usuário comum
- `Dev Mode`: fluxo beta para usuário avançado usando IA no vault

Critérios dessa fase:
- o usuário comum não depende da IA para usar o produto
- o usuário dev consegue operar pelas skills do produto sem explorar o repositório para descobrir o fluxo
- branding, terminal, agenda, criação manual de nota e navegação principal precisam estar coerentes antes da divulgação

Operacionalmente, essa fase deve ser conduzida pelos runbooks:
- `docs/runbooks/public-mvp-release-checklist.md`
- `docs/runbooks/public-mvp-release-execution.md`
