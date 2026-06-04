# Change: vault-scoped-ai-terminal

Status: draft
Date: 2026-05-20

## Objetivo
Reduzir o escopo operacional da IA no terminal aberto pelo app, fazendo o fluxo padrao nascer dentro do vault ativo e nao na raiz do repositorio do Orion Vault.

## Problema
Hoje o terminal aberto por `Modo dev` nasce na raiz do app e preserva o vault ativo por contrato ou ambiente. Isso facilita descoberta de arquivos do produto, specs e código-fonte que não fazem parte do contexto normal de trabalho sobre notas.

Na prática, a IA consegue misturar duas fronteiras diferentes:
- o vault do usuário, que deveria ser o espaço de trabalho principal
- o repositório do app, que contém implementação, documentação interna e artefatos que não deveriam entrar no fluxo padrão de leitura das notas

Isso aumenta o caminho cognitivo da IA, cria respostas fora de escopo e enfraquece a fronteira de segurança do produto.

## Solução proposta
O sistema irá:
- abrir o terminal da IA na raiz do vault ativo, não na raiz do app
- tratar o vault ativo como contexto primário e diretório de trabalho padrão da sessão
- expor um ponto de entrada curto e explícito para os comandos do produto sem exigir navegação pelo repositório
- apresentar os comandos do produto como skills e recursos operacionais explícitos para a IA
- expor um catálogo local de skills e flows recomendados para descoberta operacional previsível
- manter a fronteira do vault como limite operacional do fluxo padrão da IA
- separar claramente o fluxo de notas do fluxo de manutenção do app

## Impacto no sistema
- reduz vazamento de contexto entre notas do usuário e arquivos internos do produto
- encurta o caminho da IA para contexto, busca, plano e aplicação
- melhora previsibilidade das respostas da IA em sessões abertas pelo desktop
- preserva o diferencial do produto como copiloto de vault, não como terminal genérico do repositório

## Escopo
Incluído:
- terminal da IA iniciando no vault ativo
- onboarding da IA orientado ao contexto do vault
- ponto de entrada curto para comandos do produto a partir do vault
- modelagem explícita das capacidades do app como skills e recursos para IA
- catálogo local de skills e fluxos recomendados para IA
- separação explícita entre uso normal da IA e manutenção interna do app

Excluído:
- sandbox total do sistema operacional
- bloqueio absoluto de todo acesso manual fora do vault em terminais externos ao app
- redesign completo da CLI
- remoção dos comandos já existentes

## Resultado esperado
Ao final da mudança, a IA aberta pelo desktop deve começar e operar por padrão a partir do vault ativo, com acesso guiado aos comandos do produto sem depender de leitura do repositório do app.

## Estado consolidado na base atual
Hoje a base já consolidou a maior parte desta mudança:
- o terminal do `Modo dev` abre a sessão com `ORION_VAULT_ROOT` e helper `orion`
- a sessão nasce no vault ativo como diretório de trabalho padrão
- o onboarding inicial e o guia local já usam `orion /start`, `orion /skills`, `orion /flows` e `orion /onboarding`
- o catálogo local de skills e flows já alimenta CLI, docs geradas e endpoints web
- as composed skills `analyze-note`, `prepare-edit-task`, `prepare-writing-task` e `maintenance-diagnose` já existem como comandos reais

Pontos ainda não encerrados nesta mesma linha:
- a abertura real do terminal desktop dentro do fluxo completo do Electron ainda depende de validação manual end-to-end, embora o script `start-ai-terminal.ps1` já tenha teste automatizado

## Próximo passo programado
Após consolidar launcher, onboarding e catálogo operacional do `Orion Vault`, a próxima etapa recomendada passa a ser:
- introduzir skills compostas orientadas à intenção da task, acima das primitivas atuais
- separar de forma mais explícita skills de notas e skills de manutenção do app
- preservar o catálogo atual como base autoritativa para composições futuras

Primeira leva sugerida:
- `analyze-note`
- `prepare-edit-task`
- `prepare-writing-task`
- `organize-batch`
- `maintenance-diagnose`

Status da primeira leva na base atual:
- `analyze-note` implementado
- `prepare-edit-task` implementado
- `prepare-writing-task` implementado
- `maintenance-diagnose` implementado
- `organize-batch` implementado como comando dedicado, ainda em versão inicial e experimental

## Preparação para MVP público
Depois da primeira leva de skills compostas e dos ajustes críticos de UX, a mudança entra em fase de readiness para uma versão pública testável.

Essa fase deve validar duas trilhas oficiais:
- usuario comum: escrita manual, organizacao manual, agenda, dashboards e graph como visualizacao
- usuario dev: pesquisa, criacao e edicao assistidas por IA via terminal seguro no vault

O criterio operacional dessa fase deve seguir o runbook:
- `docs/runbooks/public-mvp-release-checklist.md`
- `docs/runbooks/public-mvp-release-execution.md`
