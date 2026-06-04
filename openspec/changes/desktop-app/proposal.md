# Change: desktop-app

Status: draft
Date: 2026-05-07

## Objetivo
Criar um app desktop local-first em TypeScript para o Orion Vault, com armazenamento no dispositivo do usuario, sem dependencia de internet para uso, validacao ou execucao dos fluxos principais.

## Problema
A experiência atual depende de uma superfície web local e de um fluxo ainda fragmentado entre visualização, comandos e persistência. Para distribuição ao usuário final, o projeto precisa de um shell desktop simples, instalável e orientado ao vault local.

## Solução proposta
O sistema irá:
- empacotar uma interface desktop em TypeScript
- manter a lógica de domínio, aplicação e infraestrutura local
- permitir criar, abrir e validar um vault diretamente no dispositivo
- armazenar notas, pastas e configurações localmente
- expor os fluxos de inspeção, organização e workspace numa janela desktop
- operar sem exigir serviços externos para o uso principal

## Impacto no sistema
- melhora a distribuição para o usuário final
- reduz fricção de uso ao remover a necessidade de navegador como camada principal
- preserva o reaproveitamento da base atual em TypeScript
- abre caminho para empacotamento desktop sem reescrever o core

## Escopo
Incluído:
- shell desktop em TypeScript
- janela principal com setup e workspace
- integração local com vault, filesystem e comandos
- armazenamento local de configurações
- execução local-first sem internet obrigatória

Excluído:
- migração obrigatória para Java ou outra linguagem
- sincronização remota
- colaboração em tempo real
- dependência de banco externo

## Resultado esperado
Ao final da mudança, o usuário deve conseguir instalar e abrir um app desktop que cria, abre, organiza e edita notas localmente, com a mesma fronteira segura de vault e sem depender de internet.
