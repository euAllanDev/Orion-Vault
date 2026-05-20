# Step 2: IA + App Bridge Local-First

## Objetivo
Definir e implementar a ponte unica entre IA, CLI, web e desktop para que a IA trabalhe como copiloto local, sempre atraves dos contratos do produto e nunca direto no filesystem.

## Resultado esperado
Ao final deste step, o projeto deve permitir que uma IA local:
- leia uma orientacao inicial da feature antes de agir
- leia contexto do vault
- busque notas relevantes
- gere plano e preview
- solicite aplicacao apenas apos validacao
- receba respostas estruturadas de sucesso, conflito, no-op e erro
- opere tanto no terminal aberto pelo desktop quanto na CLI do projeto

## Principios obrigatorios
1. A IA nao acessa filesystem diretamente.
2. O vault continua sendo a unica fronteira de escrita.
3. CLI, web e desktop reutilizam os mesmos contratos.
4. Preview sempre vem antes de aplicacao.
5. Nao criar uma API paralela para IA se o contrato atual puder ser reaproveitado.
6. O fluxo deve continuar local-first e opcional.
7. A IA deve ter uma entrada curta e explicita para entender o app antes do catalogo completo de comandos.

## Escopo funcional
### Incluido
- `context` como porta de entrada para estado do vault e nota alvo
- `search` como ampliacao de contexto para notas candidatas
- `plan` e `preview` como representacao legivel da intencao
- `apply` como gatilho de escrita validada
- `start` como leitura inicial da estrategia operacional da IA
- retorno estruturado para comandos de IA e comandos da interface
- onboarding do terminal local no desktop com o vault correto ativo
- comunicacao entre desktop, web e CLI usando os mesmos servicos de aplicacao

### Excluido
- sincronizacao em nuvem
- agente remoto
- modelo fixo como dependencia do core
- mutacao fora do vault
- comandos duplicados apenas para IA

## Estado atual resumido
Hoje o projeto ja tem:
- CLI com `start`, `guide`, `context`, `search`, `plan`, `preview`, `apply`, `organize`
- web server local com endpoints de vault, search, graph e links
- desktop que abre um terminal local de IA
- providers locais para organizacao

O que ainda falta e a camada de ponte bem definida para que a IA consuma os mesmos contratos com respostas previsiveis e nao texto solto.

## Arquitetura alvo
### 1. Application como fonte do contrato
Criar um servico central de ponte para IA dentro de `application` que orquestre:
- leitura de contexto
- busca
- planejamento
- validacao de resposta da IA
- aplicacao segura de mudancas

### 2. Infra como adaptadores
Manter apenas implementacoes tecnicas em `infra`:
- leitura do vault
- busca local
- providers de IA
- executor de acoes
- logging e prompts

### 3. Interfaces como adaptadores finos
CLI, web e desktop devem apenas traduzir entrada/saida e chamar a mesma camada de aplicacao.

## Contratos que devem ser unificados
### Entrada da IA
- `start`
- `context`
- `search`
- `plan`
- `preview`
- `apply`

### Saida da IA
Sempre um objeto estruturado com:
- `provider`
- `summary`
- `actions[]`
- `status`
- `issues[]` quando houver

### Estados de resposta
- `success`
- `conflict`
- `noop`
- `error`

## Regras de comportamento
1. `context` deve retornar vault ativo, nota ativa, backlinks e caminhos relevantes quando existir foco.
2. `search` deve ampliar o contexto com notas candidatas localmente.
3. `plan` e `preview` devem ser deterministicas para a mesma entrada.
4. `apply` so pode executar apos validacao da fronteira do vault.
5. Comandos de escrita devem recusar caminhos fora do vault.
6. O terminal da IA precisa abrir na raiz do app e preservar o vault ativo por ambiente ou contrato equivalente.
7. O desktop nao deve depender de modal aninhado para mostrar comandos da IA.
8. A UI nao deve assumir que o vault ja esta pronto antes do bootstrap terminar.
9. Textos grandes para `touch` e `edit` devem poder entrar por `--content-file` ou `--stdin`.
10. O desktop deve refletir mudancas externas no vault sem exigir reinicio do app.

## Contrato tecnico minimo
### Requisicao de contexto
Deve carregar dados para decisao da IA sem depender de UI.

Campos esperados:
- `vaultRoot`
- `focusPath` ou nota alvo
- `notes`
- `backlinks`
- `relatedNotes`
- `summary`

### Requisicao de plano
Deve transformar contexto em intencao de mudanca.

Campos esperados:
- `vaultRoot`
- `provider`
- `summary`
- `actions`
- `dryRun`

### Requisicao de aplicacao
Deve validar e executar somente a partir de um plano aceito.

Campos esperados:
- `vaultRoot`
- `actions`
- `previewId` ou identificador equivalente
- `force` somente se a validacao anterior permitir

## Pontos de implementacao esperados
### CLI
- manter os comandos atuais, mas devolver saida mais estruturada quando usado como ponte de IA
- padronizar `context`, `search`, `plan`, `preview` e `apply`
- fazer `plan` e `preview` usarem o mesmo fluxo de orquestracao
- expor `/start` como orientacao inicial para IA
- aceitar `--content-file` e `--stdin` para escrita robusta em `touch` e `edit`

### Web
- expor os mesmos contratos da CLI por endpoints locais
- reutilizar a logica de contexto, busca e relacoes
- manter preview legivel e sem mutacao no passo errado

### Desktop
- abrir terminal local na raiz do app com o vault ativo preservado
- exibir onboarding da IA com os slash commands principais
- expor a IA como acao fixa `Modo dev` na sidebar, nao como launcher flutuante
- bloquear escrita ate o vault terminar de abrir
- refletir mudancas externas no vault sem exigir reinicio manual

### Application
- centralizar a validacao do fluxo IA -> preview -> apply
- transformar respostas de IA em acoes validas do dominio
- recusar qualquer saida fora do contrato

### Infra
- manter provider noop e provider local como adaptadores
- manter geracao de prompt separada da validacao de resposta
- nao misturar prompt com regra de negocio

## Sequencia de implementacao
1. Extrair o contrato central da ponte de IA em `application`.
2. Padronizar os DTOs de contexto, plano e resposta estruturada.
3. Fazer CLI e web consumirem o mesmo servico de ponte.
4. Ajustar o desktop para abrir o terminal IA na raiz do app com o vault ativo correto.
5. Revisar `plan` e `preview` para usar o mesmo caminho.
6. Garantir validacao de fronteira antes de qualquer escrita.
7. Atualizar specs relacionadas quando o comportamento ficar consolidado.

## Arquivos que provavelmente serao tocados
- `application/services/*`
- `application/dto/*`
- `application/ports/*`
- `application/use-cases/*`
- `interfaces/cli/main.ts`
- `interfaces/cli/commands/*`
- `interfaces/cli/runtime/*`
- `interfaces/web/server.ts`
- `interfaces/desktop/main.ts`
- `interfaces/desktop/preload.ts`
- `infra/ai/*`
- `infra/filesystem/*`
- `scripts/start-ai-terminal.ps1`
- `ai-start-here.md`
- `comandos.md`

## Critérios de aceite
O step so esta concluido quando:
- a IA consegue pedir contexto, buscar, planejar e aplicar sem acessar filesystem diretamente
- a IA consegue iniciar pelo arquivo de orientacao curta e depois consultar o guia de comandos
- a CLI e o desktop usam os mesmos contratos e o mesmo vocabulário
- preview nao muta o vault
- apply falha se sair da fronteira segura
- o desktop abre o terminal da IA na raiz do app com o vault ativo correto
- a saida dos comandos e previsivel o suficiente para automacao
- nao existe caminho paralelo duplicado para a mesma acao
- textos longos entram de forma robusta por `--content-file` ou `--stdin`
- mudancas externas no vault aparecem na interface desktop sem reinicio manual

## Testes esperados
- testes de contrato para contexto e resposta da IA
- testes de integracao para CLI com preview e apply
- testes de integracao para CLI com `--content-file` e `--stdin`
- testes de integracao para web server com endpoints locais
- testes de desktop para bootstrap do vault e abertura do terminal IA
- testes de fronteira para impedir escrita fora do vault

## Instrucoes para o agente
O agente deve:
1. Ler esta documentacao antes de alterar codigo.
2. Priorizar menor mudanca que feche o contrato.
3. Nao criar uma segunda implementacao para a mesma regra.
4. Manter compatibilidade com a arquitetura atual.
5. Registrar qualquer divergencia entre spec e codigo antes de corrigir.
6. Validar que CLI, web e desktop continuam coerentes entre si.

## Definicao curta da feature
IA local entra pelo terminal ou CLI, chama contexto e busca, gera preview, e o app valida e aplica tudo dentro do vault.

## Importante
Todos os comandos e sua descricao de funcionalidade devem estar em um arquivo em que a IA consiga acessar com facilidade.

## Politica beta do terminal
Nesta versao beta, e valido manter a IA operando por um terminal local comum aberto pelo desktop ou pela CLI.

Ainda assim, o comportamento esperado da IA e:
- ler `ai-start-here.md` ou rodar `/start` antes de agir quando precisar entender rapidamente o app
- ler `comandos.md` antes de agir quando precisar descobrir o fluxo disponivel
- reutilizar apenas os comandos e contratos ja existentes do produto
- evitar acesso direto a arquivos como estrategia principal
- tratar os comandos do app como caminho padrao para contexto, busca, preview e apply

A seguranca desta versao beta depende da validacao na fronteira do vault e do uso disciplinado dos contratos do produto, nao de um sandbox completo do terminal.
