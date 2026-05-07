# Change: organize-notes

Status: draft
Date: 2026-05-06

## Objetivo
Introduzir um MVP de observação e planejamento para notas Markdown dentro de um vault local, usando IA como geradora de sugestões estruturadas e o sistema como camada confiável de leitura, validação e relatório.

## Problema
Hoje o vault pode crescer sem uma estrutura consistente de pastas, dificultando navegação, manutenção e descoberta de conteúdo. A organização manual é lenta, sujeita a erro e tende a gerar inconsistência ao longo do tempo.

## Solução proposta
O sistema irá:
- ler notas Markdown dentro de um vault local
- coletar contexto relevante para análise
- expor estrutura, metadados e conteúdo útil para a IA e para o usuário
- enviar o contexto para a IA apenas como entrada
- receber uma resposta estruturada com ações sugeridas e justificativa
- validar cada resposta antes de transformá-la em plano
- suportar `dry-run` como saída padrão de planejamento, sem alterar o filesystem
- operar local-first, sem dependência obrigatória de serviços externos para validar o fluxo

## Impacto no sistema
- adiciona um novo fluxo de orquestração para observação e planejamento
- exige contratos fortes entre IA e aplicação
- introduz validação de segurança antes de qualquer intenção de alteração no filesystem
- amplia a camada de domínio com conceitos de contexto de vault, plano de organização e resposta estruturada da IA

## Escopo
Incluído:
- comando `inspect`
- comando `validate`
- comando `scan`
- comando `context`
- comando `search`
- comando `plan`
- comando `diff`
- comando `organize` em modo de planejamento/preview
- criação de pastas e arquivos Markdown
- edição de conteúdo de notas Markdown
- rename e move dentro do vault com segurança
- análise de notas Markdown do vault
- coleta de contexto do vault
- geração de plano estruturado
- modo `dry-run`
- validação de respostas sugeridas pela IA

Excluído:
- acesso direto da IA ao filesystem
- operação fora do vault
- suporte inicial a múltiplos vaults simultâneos
- sincronização remota ou colaboração em tempo real
- integração remota obrigatória para desenvolvimento ou testes

Futuro:
- `roots` semânticos para agrupar notas semelhantes e servir como contexto adicional à IA

## Resultado esperado
Ao final da mudança, o sistema deve ser capaz de observar um vault, explicar sua estrutura para a IA, gerar um plano confiável e auditável, e simular o impacto sem alterar o diretório raiz configurado.
