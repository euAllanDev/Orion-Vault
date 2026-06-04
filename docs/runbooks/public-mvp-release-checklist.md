# Orion Vault Public MVP Release Checklist

## Objetivo
Definir a régua mínima para compartilhar publicamente a primeira versão testável do Orion Vault, com foco em estabilidade, clareza de proposta e capacidade de coleta de feedback.

## Nome da versão
- Recomendado: `Orion Vault 0.1 Beta`
- Alternativa: `Orion Vault Early Access`

## Posicionamento
Orion Vault e um workspace local-first para notas Markdown com duas trilhas oficiais:
- modo manual para escrita, organizacao, agenda, dashboards e graph
- modo dev para pesquisa, criacao e edicao assistidas por IA via terminal seguro no vault

## Escopo do MVP Publico

### Entra no MVP
- abertura e criacao de vault
- escrita manual de notas
- organizacao manual de notas e pastas
- agenda
- dashboards
- graph para visualizacao
- modo dev com launcher `orion`
- onboarding e catalogo de skills
- primitives de leitura, busca, retrieval e mutacao segura
- composed skills reais: `analyze-note`, `maintenance-diagnose`, `prepare-writing-task`

Notas de escopo atual:
- `analyze-note`, `prepare-writing-task` e `maintenance-diagnose` ja existem como comandos reais
- `organize-batch` ja existe como comando dedicado, mas continua experimental e nao entra como superficie principal do MVP

### Fica como beta
- modo dev como trilha oficial para usuarios avancados
- retrieval semantico como principal diferencial para pesquisa local assistida
- composed skills promovidas recentemente para comandos reais

### Fica como experimental
- organizacao em lote orientada por IA
- automacao mais autonoma por agentes
- flows compostos ainda nao promovidos a comandos reais
- uso do graph como ferramenta analitica avancada

### Fica fora do MVP
- sync em nuvem
- multiusuario
- plugins publicos maduros
- sandbox forte de sistema operacional
- mutacao automatica agressiva em lote
- promessa de agente autonomo ponta a ponta

## Checklist Usuario Comum

### Fluxo basico
- [ ] consegue abrir ou criar um vault sem ajuda
- [ ] entende a interface principal sem depender da IA
- [ ] consegue criar uma pasta
- [ ] consegue criar uma nota apenas pelo titulo
- [ ] consegue editar nota sem friccao grave
- [ ] consegue renomear e mover nota manualmente

### Agenda e visualizacao
- [ ] consegue criar nota de agenda
- [ ] nao recebe notificacao incoerente ao criar nota futura
- [ ] consegue navegar dashboards sem bug grave
- [ ] consegue abrir graph sem crash ou quebra visual severa
- [ ] consegue usar o app sem precisar entender o modo dev

### Estabilidade percebida
- [ ] logo e branding corretos
- [ ] layout legivel em desktop e janela reduzida
- [ ] estados vazios compreensiveis
- [ ] sem perda de conteudo em fluxos normais

## Checklist Usuario Dev

### Entrada no modo dev
- [ ] `Modo dev` abre o terminal no vault ativo
- [ ] onboarding mostra o fluxo com `orion /start`, `orion /guide`, `orion /skills` e `orion /flows`
- [ ] o terminal deixa claro que a IA deve preferir comandos do produto ao filesystem direto

Observacao:
- a base ja possui launcher `orion`, onboarding, catalogo de skills e flows; o ponto principal aqui e validar a abertura real do terminal desktop de ponta a ponta

### Fluxo de leitura e pesquisa
- [ ] consegue usar `orion /search`
- [ ] consegue usar `orion /retrieve`
- [ ] consegue usar `orion /agent-context`
- [ ] consegue usar `orion /analyze-note`
- [ ] consegue usar `orion /prepare-edit-task`
- [ ] percebe valor na indexacao semantica para pesquisa local

### Fluxo de escrita e preparacao
- [ ] consegue usar `orion mkdir`, `touch`, `edit`, `rename`, `move`
- [ ] consegue usar `orion /prepare-writing-task`
- [ ] entende quando precisa ir para `preview` e `apply`
- [ ] sente que a IA opera pelas skills do Orion Vault, nao pelo filesystem puro

### Diagnostico e manutencao
- [ ] consegue usar `orion /maintenance-diagnose`
- [ ] o fluxo de manutencao aparece separado do fluxo normal de notas

### Itens explicitamente experimentais
- [ ] `organize-batch` continua tratado como fluxo experimental mesmo ja existindo como comando dedicado nesta release

## Checklist Tecnico de Release
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] docs de IA regenerados com `pnpm docs:sync-ai`
- [ ] nenhuma referencia antiga de nome/produto na base ativa
- [ ] build desktop abre sem erro de preload ou bootstrap
- [ ] launcher `orion` aparece corretamente no modo dev
- [ ] validacao manual confirma que o terminal do modo dev nasce no vault ativo com `ORION_VAULT_ROOT`

## Classificacao de Superficies
- Manual Mode: estavel
- Dev Mode: beta
- Batch AI organization: experimental

## Critério de Go/No-Go
O MVP publico pode ser compartilhado quando:
- o usuario comum consegue completar o fluxo principal sem ajuda da IA
- o usuario dev consegue usar o modo dev sem explorar o repositorio para descobrir o produto
- nao existem bugs graves de abertura, escrita, agenda ou terminal
- a proposta do produto cabe em uma mensagem curta e verdadeira

## Mensagens curtas para redes sociais

### Versao 1
Orion Vault e um app local-first para notas Markdown, agenda, dashboards e graph, com um modo dev seguro para usar IA no seu vault.

### Versao 2
Notas locais com modo manual e modo IA, sem sair do seu vault.

### Versao 3
Um workspace local-first para conhecimento pessoal, com escrita manual para qualquer usuario e automacao assistida por IA para usuarios avancados.

## Pedido de feedback recomendado
Ao compartilhar a versao, pedir feedback sobre:
- clareza da experiencia manual
- sensacao de estabilidade
- utilidade da agenda e dashboards
- qualidade do graph como visualizacao
- utilidade do modo dev para pesquisa, criacao e edicao assistidas por IA
- pontos de confusao no onboarding

## Próximo passo apos o MVP
Depois de validar essa versao com feedback real:
- consolidar arquitetura entre CLI, web e desktop para composed skills
- decidir se `organize-batch` deixa de ser experimental
- revisar o que deve continuar beta e o que pode virar estavel
