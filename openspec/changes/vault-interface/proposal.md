# Change: vault-interface

Status: draft
Date: 2026-05-07

## Objetivo
Criar a experiência de vault em uma interface Web/App de duas páginas: uma para criar ou abrir o vault com segurança e outra para acessar os comandos já existentes de inspeção, organização e workspace.

## Problema
Os comandos do sistema já existem, mas ainda não há uma interface guiada que una a criação do vault, a validação da fronteira e a navegação pelos fluxos operacionais principais.

## Solução proposta
O sistema irá:
- permitir criar ou abrir um vault local
- validar a raiz do vault antes de torná-la ativa
- mostrar o estado do vault e seus sinais básicos na primeira página
- expor os comandos existentes em uma segunda página organizada por intenção
- priorizar `inspect` e `organize` como fluxos de observação e planejamento
- manter a execução local-first e sem acesso direto da UI ao filesystem

## Impacto no sistema
- adiciona um fluxo de onboarding para o vault
- organiza os comandos em uma superfície de uso mais clara
- reduz fricção para validar, inspecionar e organizar notas
- prepara a base para futuras interfaces além do CLI

## Escopo
Incluído:
- página de criação/abertura do vault
- validação da raiz do vault
- página de comandos do vault
- agrupamento dos comandos por intenção
- exibição de resultados, previews e erros controlados

Excluído:
- multi-vault simultâneo
- colaboração em tempo real
- sincronização remota obrigatória
- mutação automática sem validação

## Resultado esperado
Ao final da mudança, o usuário deve conseguir iniciar um vault com segurança e operar os comandos existentes em uma interface de duas páginas, com feedback claro e sem quebrar as fronteiras do vault.
