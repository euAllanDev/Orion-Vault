# Change: ai-cli-bridge

Status: draft
Date: 2026-05-07

## Objetivo
Definir a ponte local entre uma IA executada via CLI e as notas do Orion Vault, usando os mesmos contratos de leitura, busca, plano e workspace ja existentes.

## Problema
A proposta diferencial do projeto depende de uma IA local conseguir ler o vault, levantar contexto, sugerir planos e, quando necessário, propor mutações sem sair da fronteira segura.

## Solução proposta
O sistema irá:
- expor um fluxo local de contexto para IA via CLI
- permitir busca e recuperação de notas relevantes antes de qualquer ação
- gerar um plano de intenção antes de mutações
- exigir validação de fronteira antes de aplicar qualquer escrita
- reutilizar os comandos existentes em vez de criar um caminho paralelo

## Impacto no sistema
- torna a IA um copiloto local e previsível
- reduz duplicação de regras entre CLI, desktop e automações
- facilita integração futura com modelos locais ou externos, sem acoplar o core a um fornecedor específico

## Escopo
Incluído:
- fluxo `context` para reunir estado do vault e nota ativa
- fluxo `search` para recuperar notas relevantes
- fluxo `plan` para gerar intenção de ação
- fluxo `preview` antes de escrita
- fluxo `apply` somente após validação de segurança

Excluído:
- backend remoto de IA
- sincronização em nuvem
- mutação fora da fronteira do vault
- API pública sem autenticação local

## Resultado esperado
Ao final da mudança, uma IA local via CLI deve conseguir consultar o vault, receber contexto útil, propor um plano e, se for o caso, executar alterações com segurança.
