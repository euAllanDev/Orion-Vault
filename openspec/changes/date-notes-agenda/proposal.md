# Change: date-notes-agenda

Status: draft
Date: 2026-05-08

## Objetivo
Criar uma área de agenda para notas com data, status e lembretes fixos no desktop.

## Problema
Hoje as notas existem, mas não há um fluxo dedicado para registrar prazos, acompanhar vencimentos e receber alertas locais quando uma nota estiver perto do horário.

## Solução proposta
O sistema irá:
- adicionar uma nova área na sidebar para agenda de datas
- fixar a pasta `Agenda/` como estrutura obrigatória do vault para armazenar e listar notas com prazo
- expor um menu de opções premium na fila de prazos com filtro e ações rápidas
- criar notas Markdown com metadados mínimos de prazo e status
- mostrar itens pendentes, concluídos e em atraso em uma lista própria
- emitir notificações nativas no desktop em 1 dia, 1 hora e no horário do prazo
- emitir um resumo nativo da agenda ao abrir ou reexibir a janela desktop quando houver itens relevantes
- permitir abrir a área de agenda ao clicar na notificação nativa
- manter o browser fora do escopo inicial, com suporte futuro documentado no spec

## Impacto no sistema
- adiciona um novo fluxo de criação de notas com data
- introduz leitura de metadados leves sem quebrar notas existentes
- permite alertas locais sem depender de backend remoto
- garante que a agenda tenha uma origem de verdade única (`Agenda/`) para criação, listagem e navegação

## Escopo
Incluído:
- botão de agenda na sidebar
- tela própria para criar notas com data
- pasta fixa `Agenda/` no vault para armazenar as notas da agenda
- menu de opções para atualizar, focar criação e filtrar a fila
- status pendente, concluída e em atraso
- notificações nativas apenas no desktop
- clique da notificação nativa levando o usuário para a agenda

Excluído:
- notificações no browser nesta fase
- calendário mensal completo
- recorrência avançada

## Resultado esperado
O usuário deve conseguir criar e acompanhar notas com prazo a partir de uma área dedicada, com alertas locais previsíveis e sem alterar o comportamento das notas normais. As notas de agenda devem ficar sempre sob `Agenda/` e aparecer na lista própria da agenda sem depender de navegação adicional.
