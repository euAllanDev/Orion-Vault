# Change: overview-dashboard

Status: draft
Date: 2026-05-08

## Objetivo
Transformar a página `Overview` em um painel vivo com prazos, atividade recente, resumo do vault e gráficos visuais.

## Problema
A tela inicial atual está vazia demais e não entrega contexto útil logo na entrada do app.

## Solução proposta
O sistema irá:
- preencher o `Overview` com cartões de informação prioritária
- usar uma distribuição em estilo bento para hierarquizar os cards
- reservar um canto da página para gráficos leves e bonitos
- mover as ações rápidas para um botão de opções no topo do `Overview`
- concentrar o resumo do vault e os gráficos em uma coluna lateral única
- mostrar próximos prazos, atividade recente e resumo do vault sem exigir a abertura do workspace

## Impacto no sistema
- melhora o valor imediato da primeira tela
- reduz a sensação de vazio na entrada do app
- reutiliza dados já disponíveis de agenda, vault e atividade local

## Escopo
Incluído:
- card de próximos prazos
- card de atividade recente
- card de resumo do vault
- área de gráficos no Overview
- layout em distribuição bento para prioridade visual

Excluído:
- remodelagem completa do workspace
- gráficos em tempo real com streaming
- dependência de biblioteca externa obrigatória

## Resultado esperado
Ao final da mudança, o `Overview` deve parecer um painel principal do app, com informação útil, leitura rápida e composição visual mais rica.
