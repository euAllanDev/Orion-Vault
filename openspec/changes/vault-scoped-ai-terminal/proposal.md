# Change: vault-scoped-ai-terminal

Status: draft
Date: 2026-05-20

## Objetivo
Reduzir o escopo operacional da IA no terminal aberto pelo app, fazendo o fluxo padrão nascer dentro do vault ativo e não na raiz do repositório do Marika.

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
- separação explícita entre uso normal da IA e manutenção interna do app

Excluído:
- sandbox total do sistema operacional
- bloqueio absoluto de todo acesso manual fora do vault em terminais externos ao app
- redesign completo da CLI
- remoção dos comandos já existentes

## Resultado esperado
Ao final da mudança, a IA aberta pelo desktop deve começar e operar por padrão a partir do vault ativo, com acesso guiado aos comandos do produto sem depender de leitura do repositório do app.
