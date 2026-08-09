# Change: agent-compatible-dev-mode

Status: draft
Date: 2026-08-09

## Objetivo

Fazer o `Modo dev` funcionar para agentes executados dentro do terminal do vault, com adapters oficiais para OpenCode e Claude Code.

## Problema

O `Modo dev` atual abre PowerShell no vault ativo, exporta `ORION_VAULT_ROOT` e define `orion` como funcao PowerShell. Isso funciona para uma pessoa digitando na mesma janela, mas nao para um agente.

Agentes como OpenCode executam ferramentas e shells filhos. Esses processos nao herdam funcoes PowerShell e o texto de onboarding impresso antes da sessao nao entra no contexto do modelo. O agente recebe apenas arquivos do vault e ferramentas genericas, entao nao descobre nem consegue executar comandos do Orion Vault.

Consequencias observadas:

- agente lista, le e busca arquivos diretamente em vez de usar `orion`
- agente declara que nao existem comandos do app na sessao
- catalogo, skills, preview e validacoes do produto ficam fora do fluxo efetivo do agente
- regra de preferir contratos do produto vira recomendacao sem mecanismo operacional

## Solucao proposta

O sistema ira entregar duas capacidades complementares.

### 1. Launcher herdavel por subprocessos

`orion` deve existir como executavel real disponivel no `PATH` da sessao, nao apenas como funcao PowerShell.

Requisitos:

- pacote deve disponibilizar launcher fisico fora de `app.asar`
- processo desktop deve exportar `ORION_VAULT_ROOT`, `ORION_APP_ROOT` e caminho absoluto de Node para terminal e filhos
- diretorio do launcher deve entrar no `PATH` da sessao
- launcher deve executar somente `dist/cli/main.mjs` desempacotado
- launcher nao deve depender de `tsx`, fonte TypeScript ou recursos dentro de `app.asar`
- launcher deve preservar argumentos, `stdin`, codigo de saida e diretorio atual do processo chamador
- CLI deve continuar validando toda operacao de escrita dentro de `ORION_VAULT_ROOT`

### 2. Onboarding como contexto do agente

OpenCode e Claude Code devem receber instrucao de sessao antes de primeira resposta. Texto exibido no PowerShell continua util para humanos, mas nao e mecanismo de contexto para agente.

Requisitos:

- adapters OpenCode e Claude Code devem iniciar agente por entrypoint oficial do Modo dev, com contexto de sessao injetado por mecanismo suportado pela CLI correspondente
- contexto deve informar vault ativo, comando `orion`, ordem leitura -> planejamento -> execucao e comando `/start`
- contexto deve orientar agente a executar `orion /start` e `orion /skills` antes de inspecao ampla do filesystem
- contexto deve instruir uso de `orion` para leitura, busca, escrita e organizacao quando existir comando equivalente
- contexto deve separar notas do vault, produto Orion Vault e codigo-fonte do app
- contexto deve ser efemero ou armazenado fora do vault do usuario; Modo dev nao deve criar `AGENTS.md`, configuracao ou nota operacional persistente no vault
- adapter deve falhar com mensagem acionavel quando agente nao estiver instalado ou versao suportada nao estiver disponivel

## Decisao de produto

Modo dev tera dois caminhos explicitos:

- `Terminal Orion`: terminal humano com `orion` no `PATH`
- `OpenCode no vault`: inicia OpenCode pelo adapter oficial, com mesmo ambiente e onboarding injetado
- `Claude Code no vault`: inicia Claude Code pelo adapter oficial, com mesmo ambiente e prompt de sistema injetado

Terminal generico continua disponivel, mas nao promete contexto automatico para agentes iniciados manualmente. Outros agentes terao adapters proprios; nao sera assumido que variaveis de ambiente ou texto do terminal viram contexto de qualquer ferramenta.

## Escopo

Incluido:

- launcher `orion` executavel e empacotado
- propagacao de ambiente para subprocessos
- adapters de sessao para OpenCode e Claude Code
- UX para iniciar OpenCode e Claude Code pelo Modo dev
- testes de launcher, ambiente, onboarding e build instalada

Excluido:

- sandbox do sistema operacional
- permissao de filesystem para comandos fora do Orion Vault
- suporte implicito a todos os agentes de IA
- arquivos de instrucao persistidos no vault do usuario
- mudanca de contratos existentes da CLI

## Seguranca

`ORION_VAULT_ROOT` limita comandos do Orion Vault, nao torna PowerShell, OpenCode nem Claude Code um sandbox. Agente iniciado no terminal ainda pode executar comandos nativos com permissoes do usuario. UI e onboarding devem declarar essa diferenca sem prometer isolamento inexistente.

Processo principal deve considerar vault ativo como fonte autoritativa ao abrir Modo dev. Renderer nao deve escolher outro diretorio para terminal ou adapter de agente.

## Criterios de aceitacao

1. Em instalacao Windows, shell filho encontra `orion` pelo `PATH` e `orion /start` executa CLI compilada sem `tsx`.
2. `orion /search`, `orion /skills` e `orion /prepare-edit-task` executam de shell filho usando vault ativo.
3. Abrir `OpenCode no vault` ou `Claude Code no vault` inicia agente no vault ativo com instrucoes de sessao antes de primeira resposta.
4. Quando usuario pede explorar app ou executar todos comandos, agente primeiro usa `/start`, `/route-intent` e `/skills`, em vez de concluir que so existem ferramentas genericas.
5. Adapter nao cria nem altera arquivos persistentes no vault durante onboarding.
6. Falha de OpenCode ou Claude Code ausente ou incompativel explica como instalar, atualizar ou usar `Terminal Orion`.
7. Build instalada valida launcher, ambiente e adapter sem caminho dentro de `app.asar`.

## Validacao

- teste unitario para construcao de ambiente e `PATH`
- teste de integracao que inicia shell filho e executa `orion /onboarding`
- teste de integracao para cada adapter com processo simulado
- teste E2E Electron para acionar fluxos OpenCode e Claude Code
- validacao manual em instalacao Windows com vault real e ambos agentes instalados

## Dependencias e riscos

- cada adapter depende de interface de inicializacao documentada e versionada por sua CLI
- mudancas nessa interface exigem deteccao de versao e teste de compatibilidade
- `orion` no `PATH` reduz friccao, mas nao obriga agente generico a usa-lo; garantia de descoberta existe apenas em adapters que injetam contexto

## Resultado esperado

Usuario abre Modo dev, escolhe OpenCode ou Claude Code e recebe agente que conhece capacidades do Orion Vault, executa comandos por `orion` em seus subprocessos e permanece focado no vault ativo sem poluir arquivos do usuario.
