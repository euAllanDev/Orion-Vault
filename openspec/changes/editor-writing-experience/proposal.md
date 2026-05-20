# Change: editor-writing-experience

Status: draft
Date: 2026-05-17

## Objetivo
Melhorar a experiência de escrita no editor da vault desktop com comandos inline, marcação rápida de notas e atalhos de Markdown que reduzam atrito durante a digitação.

## Problema
O editor atual permite escrever Markdown puro, mas ainda exige que o usuário lembre sintaxe manualmente e faça várias operações repetitivas para estruturar notas, inserir links e manter ritmo de escrita.

## Solução proposta
O sistema irá:
- expor slash commands diretamente no editor para ações estruturais comuns
- usar `@` como ponto de entrada para mencionar notas do vault ativo durante a escrita
- aplicar atalhos básicos de formatação sem sair do teclado
- continuar listas e checklists automaticamente ao pressionar `Enter`
- manter a experiência local e compatível com o conteúdo Markdown já existente

## Impacto no sistema
- melhora a velocidade de captura e organização de notas
- reduz a dependência de memorização da sintaxe Markdown
- aproxima o editor de uma experiência mais assistida sem trocar o core atual
- prepara o terreno para futuras ações de escrita mais ricas no desktop

## Escopo
Incluído:
- slash commands inline no editor
- marcação de notas por `@`
- atalhos básicos de Markdown
- continuação automática de listas e checklists

Excluído:
- editor rich text completo
- colaboração em tempo real
- autocomplete remoto ou dependente de rede
- interpretação semântica de menções fora do vault ativo

## Resultado esperado
Ao final da mudança, o usuário deve conseguir estruturar notas, mencionar outras notas do vault e continuar fluxos comuns de escrita com menos fricção, usando principalmente teclado dentro do editor desktop.
