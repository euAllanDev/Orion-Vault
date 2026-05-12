# Change: semantic-note-links

Status: draft
Date: 2026-05-11

## Objetivo
Adicionar uma camada local de relacionamento entre notas, com linkagem manual e automática, comando para descobrir notas relacionadas e um graph semântico global navegável.

## Problema
Hoje o vault já permite leitura, busca, backlinks e graph local, mas ainda não trata relacionamento semântico entre notas como uma feature central. Isso dificulta descobrir conexões relevantes, navegar por notas parecidas e transformar relações implícitas em links explícitos reutilizáveis.

## Solução proposta
O sistema irá:
- reconhecer e renderizar links manuais entre notas como navegação de primeira classe
- calcular uma representação vetorial local para cada nota, usando TF-IDF como estratégia inicial para medir similaridade e proximidade
- sugerir links automáticos a partir desse índice local sem mutar o markdown silenciosamente
- expor um comando para listar notas com alto nível de relacionamento a partir de uma nota de referência
- exibir um graph global de notas e pastas como diferencial visual do produto, com cores frias e quentes para indicar proximidade relativa ao foco atual

## Impacto no sistema
- melhora a descoberta de contexto dentro do vault
- transforma relações semânticas em navegação útil no dia a dia
- enriquece backlinks, graph e fluxo de organização com mais contexto local
- cria uma superfície visual global mais marcante para exploração do vault
- preserva o modelo local-first sem depender de internet para indexação ou navegação

## Escopo
Incluído:
- links manuais renderizados e clicáveis na interface
- sugestões de links automáticos com preview antes de escrita
- índice vetorial local por nota
- comando `related` para notas relacionadas
- graph global com notas, pastas e cores por proximidade
- graph global com composição esférica e orgânica inspirada em uma visualização neural

Excluído:
- escrita automática silenciosa no markdown sem confirmação do usuário
- dependência obrigatória de serviços externos de embeddings
- graph remoto ou sincronizado em nuvem
- mutação fora da fronteira segura do vault

## Resultado esperado
Ao final da mudança, o usuário deve conseguir enxergar, navegar e materializar relações entre notas de forma local, visual e auditável, tanto pelo conteúdo da nota quanto por uma visão global em graph.
