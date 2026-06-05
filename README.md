# Orion Vault

Orion Vault e um workspace local-first para notas Markdown que trata o vault como um sistema operavel, nao apenas como uma pasta de arquivos.

Ele combina leitura, busca, organizacao, relacoes entre notas, agenda, interface visual e automacao assistida por IA sob uma regra simples: a inteligencia pode sugerir, mas a seguranca e a execucao continuam sob controle do sistema.

## O Que E O Orion Vault

O Orion Vault nasce para quem quer mais profundidade do que um editor de texto e mais confiabilidade do que uma automacao cega.

Na pratica, ele transforma um vault local em uma base viva de conhecimento com:

- observacao do estado real do vault
- busca e recuperacao local de contexto
- organizacao preview-first
- operacoes seguras de workspace
- relacoes semanticas entre notas
- graph local e global
- agenda de notas com prazo
- experiencia desktop local-first
- governanca de comportamento por especificacao

O resultado e um produto que tenta equilibrar tres coisas ao mesmo tempo:

- fluidez de uso
- rigor arquitetural
- seguranca sobre o filesystem

## O Que O Projeto Entrega

### Observacao e diagnostico do vault

Antes de editar, mover ou planejar qualquer coisa, o Orion Vault consegue observar o vault e expor sinais uteis sobre ele.

Capacidades:

- inspecao estrutural do vault
- validacao da raiz e da fronteira de operacao
- leitura de arquivos Markdown elegiveis
- resumo de contexto do vault e de notas especificas
- diagnostico de situacoes problematicais antes de mutacao

Comandos centrais:

- `inspect`
- `validate`
- `scan`
- `context`
- `doctor`

### Busca e descoberta de contexto

O projeto trata descoberta como parte do fluxo principal de trabalho.

Capacidades:

- busca textual por termos, frases e tags
- recuperacao local de chunks e notas relevantes
- visao de backlinks
- descoberta de notas relacionadas por sinais locais
- montagem de contexto pronto para task
- roteamento explicito entre produto, vault e codigo do app quando a pergunta e ambigua

Comandos centrais:

- `search`
- `retrieve`
- `agent-context`
- `related`
- `/route-intent`
- `/product-context`

### Organizacao preview-first

O fluxo de organizacao do Orion Vault foi desenhado para reduzir risco. A ordem importa:

1. observar
2. entender contexto
3. planejar
4. validar
5. so entao executar quando fizer sentido

Capacidades:

- coleta de contexto do vault
- geracao de plano estruturado
- preview legivel antes de qualquer escrita relevante
- bloqueio de operacoes ambiguas, invalidas ou fora da fronteira
- protecao contra sobrescrita silenciosa

Comandos centrais:

- `organize`
- `plan`
- `diff`
- `/preview`
- `/apply`

### Workspace seguro para notas

O Orion Vault nao para no diagnostico. Ele tambem entrega o basico que precisa funcionar bem em um vault real.

Capacidades:

- criar pastas
- criar notas Markdown
- editar conteudo existente
- renomear arquivos e pastas
- mover notas entre diretorios
- preservar o vault como unica fronteira de escrita

Comandos centrais:

- `mkdir`
- `touch`
- `edit`
- `rename`
- `move`

### Relacoes entre notas

O projeto enriquece a navegacao do vault com uma camada de relacao explicita e inferida.

Capacidades:

- leitura de links manuais entre notas
- backlinks
- notas relacionadas com score e sinais explicativos
- preview para aplicacao de links sugeridos
- suporte a graph local e graph global

### Agenda e notas com prazo

O Orion Vault reserva uma superficie propria para notas ligadas a data.

Capacidades:

- pasta estrutural `Agenda/`
- criacao e listagem de notas com prazo
- estados como pendente, concluida e em atraso
- alertas locais no desktop
- separacao clara entre notas comuns e notas de agenda

### Interface local e shell desktop

O projeto ja possui uma experiencia desktop funcional e validada manualmente para a rodada atual, sem abandonar a CLI como superficie autoritativa.

Capacidades ja consolidadas na base atual:

- setup de vault
- workspace visual
- painel auxiliar com contexto
- busca global local
- graph view
- templates
- notas fixadas
- nota diaria
- onboarding para fluxo com IA local
- `Modo dev` abrindo no vault ativo
- launcher `orion` com onboarding, skills e flows
- terminal seguro com `ORION_VAULT_ROOT`

## Superficies Do Produto

### CLI

E a camada mais direta para automacao, inspecao, validacao, busca, retrieval, planejamento e operacoes seguras.

Entrypoint principal:

- `interfaces/cli/main.ts`

Guia rapido:

- `comandos.md`

Fluxos de IA e comandos compostos relevantes:

- `/start`
- `/guide`
- `/skills`
- `/flows`
- `/route-intent`
- `/product-context`
- `/analyze-note`
- `/prepare-edit-task`
- `/prepare-writing-task`
- `/maintenance-diagnose`
- `/organize-batch`

### Web local

Funciona como superficie visual local para navegar o vault, operar agenda, graph, busca, relacoes, templates e estados auxiliares.

Entrypoint principal:

- `interfaces/web/server.ts`

### Desktop

Empacota a experiencia em uma janela local-first, com bootstrap do vault padrao, integracao local e fluxo mais proximo de produto final.

Arquivos principais:

- `interfaces/desktop/main.ts`
- `interfaces/desktop/preload.ts`

## Diferenciais Do Orion Vault

- local-first de verdade
- vault como fronteira segura
- IA sem poder direto sobre o disco
- preview antes de automacao agressiva
- relacoes entre notas explicaveis
- especificacao como instrumento de produto e engenharia
- arquitetura pensada para evoluir sem colapsar responsabilidades

## Principios Fundamentais

O projeto repete alguns principios em toda a base:

- local-first
- domain first
- application orchestrates
- infrastructure is replaceable
- interfaces sao adaptadores finos
- IA sugere, sistema executa
- nenhuma mutacao sem validacao
- nenhuma operacao fora do vault
- specs como fonte de verdade para comportamento

Esses principios estao formalizados em:

- `openspec/constitution.md`

## Stack De Tecnologia

Base principal:

- TypeScript
- Node.js
- pnpm

Build, qualidade e verificacao:

- Vitest
- ESLint
- Prettier
- tsup
- TypeScript compiler

Contratos e validacao:

- Zod

Desktop:

- Electron

## Arquitetura

O repositorio segue uma separacao clara de camadas, com forte preocupacao em preservar responsabilidade e direcao de dependencias.

### Camadas

`domain`

- entidades
- invariantes
- regras puras

`application`

- casos de uso
- portas
- DTOs
- servicos de orquestracao

`infra`

- filesystem
- configuracao
- integracoes locais
- implementacoes concretas de portas

`interfaces`

- CLI
- web
- desktop
- apresentacao e adaptacao de entrada/saida

`openspec`

- governanca de mudancas
- proposals
- designs
- tasks
- specs

### Direcao de dependencias

- o dominio nao depende de infra nem de interfaces
- a aplicacao depende de contratos e do dominio
- a infra implementa os contratos da aplicacao
- as interfaces acionam casos de uso e apresentam resultado

### Modelo conceitual

Alguns conceitos estruturam o projeto:

- `Vault`: fronteira segura de operacao
- `Note`: unidade de conteudo Markdown
- `Action`: intencao atomica de mudanca
- `AIResponse`: sugestao estruturada, nao permissao de execucao
- `Command`: forma de acionar o sistema por CLI ou UI

## Seguranca E Confiabilidade

Filesystem local e uma area sensivel. O Orion Vault parte desse principio desde a fundacao.

Regras centrais:

- toda operacao deve permanecer dentro do vault configurado
- caminhos devem ser validados de forma canonica
- links simbolicos nao podem abrir escape de fronteira
- a IA nao acessa o filesystem diretamente
- conflitos nao devem resultar em sobrescrita automatica
- falhas devem retornar como mensagens controladas

Esse modelo nao tenta ser espetaculoso. Ele tenta ser confiavel.

## SDD E OpenSpec

O Orion Vault usa uma abordagem orientada a especificacao. Aqui, comportamento importante nao deveria nascer escondido em implementacao incidental.

Ele nasce e evolui por meio de artefatos explicitamente versionados.

### Estrutura de governanca

`openspec/constitution.md`

- define as regras imutaveis do projeto

`openspec/registry.md`

- registra changes e modulos relevantes

`openspec/changes/`

- concentra propostas em andamento
- cada change pode conter `proposal.md`, `design.md`, `tasks.md` e `specs/`

`openspec/specs/`

- reservado para comportamento consolidado e reutilizavel

### Por que isso importa

- reduz comportamento implicito
- cria uma linguagem comum entre produto, codigo e teste
- melhora rastreabilidade de decisoes
- facilita colaboracao entre engenharia e IA
- protege fluxos sensiveis de mudancas casuais

### Changes relevantes no repositorio

- `project-foundation`
- `organize-notes`
- `vault-interface`
- `desktop-app`
- `ai-cli-bridge`
- `vault-scoped-ai-terminal`
- `semantic-note-links`
- `semantic-vault-retrieval`
- `overview-dashboard`
- `date-notes-agenda`

## Estrutura Do Repositorio

```text
.
|-- application/
|-- domain/
|-- infra/
|-- interfaces/
|   |-- cli/
|   |-- web/
|   `-- desktop/
|-- openspec/
|   |-- constitution.md
|   |-- registry.md
|   |-- specs/
|   `-- changes/
|-- docs/
|-- scripts/
|-- tests/
`-- vault/
```

## Primeiros Passos

### Requisitos

- Node.js 20+
- pnpm

### Instalacao

```bash
pnpm install
```

### Sincronizacao de docs da IA

```bash
pnpm docs:sync-ai
```

### Desenvolvimento

Superficies principais durante desenvolvimento:

```bash
pnpm dev
pnpm dev:web
pnpm dev:desktop
```

Significado pratico:

- `pnpm dev`: CLI local do produto
- `pnpm dev:web`: interface web local
- `pnpm dev:desktop`: shell desktop Electron

### Verificacao

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Checklist tecnico recomendado antes de validacao manual ou distribuicao:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm docs:sync-ai
```

Se voce nao estiver usando o vault padrao configurado no app, informe `--vault <path>` nos comandos da CLI.

## Comandos Principais

### Observacao e contexto

```bash
pnpm dev inspect
pnpm dev validate
pnpm dev scan
pnpm dev context --path "MinhaNota.md"
pnpm dev doctor
```

### Busca, retrieval e relacoes

```bash
pnpm dev search --query "vault"
pnpm dev retrieve --query "clean architecture"
pnpm dev agent-context --query "sdd" --path "Architecture"
pnpm dev related --path "Docs/Alpha.md"
```

### Planejamento e organizacao

```bash
pnpm dev organize --dry-run
pnpm dev plan
pnpm dev diff
pnpm dev /preview
pnpm dev /apply --preview-id <id>
```

### Workspace

```bash
pnpm dev mkdir --path "Projetos"
pnpm dev touch --path "Projetos/minha-nota.md" --content "# Minha nota"
pnpm dev edit --path "Projetos/minha-nota.md" --content "# Minha nota\n\nAtualizada"
pnpm dev rename --source "Projetos/minha-nota.md" --destination "Projetos/nota-final.md"
pnpm dev move --source "Projetos/nota-final.md" --destination "Arquivo/nota-final.md"
```

### Modo dev e skills do produto

```bash
pnpm dev /start
pnpm dev /guide
pnpm dev /skills
pnpm dev /flows
pnpm dev /route-intent --query "o que voce acha desse app?"
pnpm dev /product-context
pnpm dev /analyze-note --path "Docs/Alpha.md"
pnpm dev /prepare-edit-task --path "Docs/Alpha.md" --query "revisar estrutura"
pnpm dev /prepare-writing-task --path "Docs/Alpha.md" --query "escrever resumo executivo"
pnpm dev /maintenance-diagnose
```

### Fluxo recomendado para IA

1. Comece por `/start`
2. Use `/route-intent` ou `/product-context` quando a pergunta for sobre o app
3. Use `search`, `retrieve`, `agent-context` ou `analyze-note` para montar contexto
4. Use `prepare-edit-task` ou `prepare-writing-task` antes de mutacao assistida
5. Use `preview` antes de `apply`

Para referencia operacional curta:

- `comandos.md`

## Para Quem O Projeto Faz Sentido

O Orion Vault faz sentido para quem quer:

- operar um vault Markdown com mais inteligencia local
- ter automacao assistida sem perder controle
- organizar notas com preview e auditabilidade
- navegar por busca, backlinks, relacoes e graph
- evoluir software com governanca tecnica real

## O Que O Orion Vault Nao Quer Ser

Neste momento, o projeto nao quer ser:

- um SaaS dependente de internet
- um backend remoto de IA travestido de app local
- uma caixa-preta que altera o vault sem explicacao
- um sistema que sobrescreve arquivos silenciosamente

## Estado Atual

O projeto esta em evolucao ativa, mas ja passou da fase de prova de conceito.

Ja existe uma base funcional real para CLI, web local, workspace, agenda, relacoes semanticas, retrieval local e shell desktop.

Estado operacional atual:

- `Manual Mode`: estavel para a rodada atual
- `Dev Mode`: beta, com validacao manual aprovada
- `organize-batch`: experimental
- base pronta para `teste fechado com usuario`

As proximas iteracoes devem ser guiadas principalmente por feedback real de uso, com foco em refinamento de UX, graph e evolucao de skills compostas.

## Referencias Importantes

- `package.json`
- `comandos.md`
- `openspec/constitution.md`
- `openspec/registry.md`
- `openspec/changes/`
- `interfaces/cli/`
- `interfaces/web/`
- `interfaces/desktop/`

## Resumo

Orion Vault e um produto para quem quer tratar notas Markdown como infraestrutura pessoal de conhecimento, e nao apenas como arquivos dispersos.

Ele combina produto, arquitetura e governanca num mesmo eixo:

- experiencia local-first
- seguranca de vault
- organizacao auditavel
- IA assistiva sob controle
- evolucao guiada por SDD + OpenSpec
