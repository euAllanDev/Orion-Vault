# Orion Vault Public MVP Release Execution

## Objetivo
Transformar o checklist do MVP publico em uma sequencia executavel de trabalho, com blocos claros, criterio de saida e prioridade pratica.

## Referencia principal
- `docs/runbooks/public-mvp-release-checklist.md`

## Como usar este runbook
- execute os blocos na ordem
- nao avance para o proximo bloco sem cumprir o criterio de saida do bloco atual
- trate qualquer item marcado como bloqueador como prioridade maxima antes da divulgacao publica

## Bloco 1: Congelar escopo do MVP

### Objetivo
Fechar exatamente o que entra na divulgacao publica e o que fica rotulado como beta ou experimental.

### Tarefas
- [ ] confirmar a lista final do que entra no MVP publico
- [ ] confirmar a lista final do que fica beta
- [ ] confirmar a lista final do que fica experimental
- [ ] remover da comunicacao qualquer promessa fora desse recorte

### Critério de saída
- existe uma definicao fechada do escopo publico
- a equipe consegue explicar a versao em 1-2 frases sem contradicao

## Bloco 2: Validar fluxo do usuario comum

### Objetivo
Garantir que o app funcione bem sem depender da IA.

### Tarefas
- [ ] abrir ou criar vault sem ajuda externa
- [ ] criar pasta manualmente
- [ ] criar nota apenas pelo titulo
- [ ] editar nota sem friccao grave
- [ ] renomear e mover nota manualmente
- [ ] criar nota de agenda
- [ ] verificar que a agenda nao notifica incoerentemente ao criar nota futura
- [ ] navegar dashboards
- [ ] abrir graph sem bug grave
- [ ] revisar responsividade minima em janela menor

### Critério de saída
- um usuario comum consegue usar o app do inicio ao fim sem precisar entender o modo dev

## Bloco 3: Validar fluxo do usuario dev

### Objetivo
Garantir que o modo dev entregue valor real e previsivel.

### Tarefas
- [ ] abrir `Modo dev`
- [ ] verificar que o terminal abre no vault ativo
- [ ] verificar que a sessao expoe `ORION_VAULT_ROOT`
- [ ] rodar `orion /start`
- [ ] rodar `orion /skills`
- [ ] rodar `orion /flows`
- [ ] rodar `orion /search`
- [ ] rodar `orion /retrieve`
- [ ] rodar `orion /agent-context`
- [ ] rodar `orion /analyze-note`
- [ ] rodar `orion /prepare-edit-task`
- [ ] rodar `orion /prepare-writing-task`
- [ ] rodar `orion /maintenance-diagnose`
- [ ] criar ou editar nota usando comandos do produto
- [ ] verificar que o onboarding empurra o uso de skills antes de filesystem direto

### Notas de execucao
- `analyze-note`, `prepare-edit-task`, `prepare-writing-task` e `maintenance-diagnose` ja existem como comandos reais e devem ser validados nessa rodada
- `organize-batch` ja existe como comando real, mas continua fora deste bloco como obrigatorio por ainda estar classificado como experimental
- a maior validacao manual deste bloco e confirmar o launcher real do desktop, nao apenas a CLI isolada

### Critério de saída
- um usuario dev consegue usar o modo dev para pesquisa, criacao e edicao assistidas sem explorar o repositorio para descobrir o produto

## Bloco 4: Estabilidade tecnica de release

### Objetivo
Evitar divulgar uma build com regressao basica ou identidade inconsistente.

### Tarefas
- [ ] rodar `pnpm docs:sync-ai`
- [ ] rodar `pnpm typecheck`
- [ ] rodar `pnpm test`
- [ ] rodar `pnpm build`
- [ ] verificar que o branding esta consistente como `Orion Vault`
- [ ] verificar que o launcher do modo dev e `orion`
- [ ] verificar que `ai-start-here.md` e `comandos.md` refletem o catalogo atual de skills
- [ ] verificar que a base ativa nao carrega mais o nome antigo do produto

### Critério de saída
- existe uma build local validada e coerente com a narrativa publica do produto

## Bloco 5: Classificar riscos de divulgacao

### Objetivo
Saber o que pode quebrar expectativa publica e o que ainda deve ser tratado como beta.

### Tarefas
- [ ] listar bugs ainda abertos que afetam usuario comum
- [ ] listar bugs ainda abertos que afetam usuario dev
- [ ] classificar cada bug como bloqueador, importante ou pos-lancamento
- [ ] marcar explicitamente o que sera divulgado como beta
- [ ] marcar explicitamente o que sera divulgado como experimental

### Critério de saída
- existe uma decisao consciente sobre o risco aceito na divulgacao publica

## Bloco 6: Preparar comunicacao publica

### Objetivo
Divulgar com mensagem clara e expectativa controlada.

### Tarefas
- [ ] escolher o nome da versao publica (`0.1 Beta` ou `Early Access`)
- [ ] escolher a mensagem curta principal
- [ ] preparar texto curto para redes sociais
- [ ] preparar pedido objetivo de feedback
- [ ] preparar lista curta do que testar para usuario comum
- [ ] preparar lista curta do que testar para usuario dev

### Critério de saída
- a mensagem publica esta pronta antes da release

## Bloco 7: Go/No-Go final

### Perguntas finais
- [ ] o usuario comum consegue usar o produto sem depender da IA?
- [ ] o usuario dev consegue usar o modo dev sem improvisar no filesystem?
- [ ] existe algum bug grave ainda aberto em agenda, escrita, terminal ou abertura do app?
- [ ] a versao esta apresentavel o bastante para feedback publico real?

### Decisão
- [ ] Go
- [ ] No-Go

## Observacao operacional
Se a resposta do bloco final for `No-Go`, o proximo trabalho deve voltar ao bloco anterior que falhou, em vez de seguir para divulgacao.
