# Change: orion-remember

Status: draft
Date: 2026-08-25

## Objetivo
Definir capacidade futura de registrar conhecimento persistente no Orion somente quando usuario pedir escrita explicitamente.

## Problema
MCP atual permite leitura autorizada de multiplos Vaults, mas nao possui contrato seguro para persistir decisao, fato ou aprendizado. Escrita precisa evitar autonomia do Agent, destino arbitrario, duplicacao e sobrescrita silenciosa.

## Solucao proposta
Adicionar futuramente uma unica tool `orion_remember`, apoiada por use case de aplicacao. Tool recebe conteudo e hints semanticos, decide `noop`, `created`, `appended` ou `conflict`, e escreve somente no write target configurado.

## Escopo
Incluido:
- contrato publico MVP e respostas transparentes
- autorizacao explicita de escrita por informacao referida
- write target unico configurado
- dedupe conservador e idempotencia
- create seguro, append delimitado e protecao de concorrencia

Excluido:
- delete, move, rename, replace arbitrario, overwrite e edicao livre
- escrita em lote, sync, cloud, remote MCP e versionamento de notas
- taxonomia obrigatoria, provenance persistida e escolha de path pelo Agent

## Resultado esperado
Implementacao futura tera contrato pequeno e seguro para lembrar conhecimento, sem expor filesystem nem transformar leitura autorizada em permissao de escrita.
