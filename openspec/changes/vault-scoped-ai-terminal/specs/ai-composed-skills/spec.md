# Spec Delta: ai-composed-skills

## Contexto
Depois de consolidar skills primitivas para contexto, planejamento, execução segura e manutenção, o Orion Vault deve poder expor uma primeira camada de skills compostas orientadas à intenção da task.

## ADDED Regras
1. O sistema deve poder descrever skills compostas como composições explícitas de capabilities já existentes.
2. Skills compostas não podem substituir nem ocultar as primitives existentes como superfície autoritativa do produto.
3. Cada skill composta deve declarar quais primitives usa para montar seu fluxo.
4. Skills compostas de notas devem aparecer separadas das skills compostas de manutenção do app.
5. O sistema deve deixar claro se uma skill composta termina em leitura, preview ou mutação.
6. Se uma skill composta envolver mutação, ela deve continuar respeitando preview validado e fronteira do vault.
7. A primeira leva de skills compostas deve privilegiar tarefas recorrentes e de baixo risco conceitual.
8. O catálogo deve poder expor skills compostas sem exigir a criação imediata de uma segunda CLI paralela.

## ADDED Pontos de atenção
- A composição deve reduzir ambiguidade, não aumentar o vocabulário desnecessariamente.
- O valor principal está em explicitar intenção e sequência recomendada para a IA.
- Skills compostas podem começar como capacidades descritas em catálogo antes de virarem comandos dedicados.
- O fluxo de manutenção deve continuar explicitamente separado do fluxo normal de notas.

## ADDED Cenários

### Cenário 1: analyze-note compõe leitura de contexto
Given a IA precisa entender uma nota ou escopo com rapidez
When ela consulta ou usa a skill composta `analyze-note`
Then o sistema a orienta a combinar `context`, `related` e `agent-context`
And a saída deixa claro foco, supporting chunks e related notes

### Cenário 2: prepare-writing-task prepara escrita sem mutar cedo demais
Given a IA precisa responder, escrever ou editar com mais contexto
When ela consulta ou usa a skill composta `prepare-writing-task`
Then o sistema a orienta a combinar contexto e retrieval antes de qualquer execução
And o fluxo só avança para preview quando a task realmente exigir mutação

### Cenário 2b: prepare-edit-task prepara revisão de nota existente
Given a IA precisa revisar, expandir ou corrigir uma nota já existente
When ela consulta ou usa a skill composta `prepare-edit-task`
Then o sistema a orienta a combinar contexto, agent-context, retrieval e related antes da edição
And a saída deixa claros riscos, alvos de revisão e o próximo passo recomendado

### Cenário 3: organize-batch preserva preview-first
Given a IA quer organizar várias notas com segurança
When ela consulta ou usa a skill composta `organize-batch`
Then o sistema a orienta a passar por `context`, `plan` ou `preview` e `apply`
And nenhuma mutação ocorre sem confirmação válida

### Cenário 4: maintenance-diagnose não contamina o fluxo normal
Given a IA precisa investigar o estado técnico do app ou do vault
When ela consulta ou usa a skill composta `maintenance-diagnose`
Then o sistema a orienta a combinar `inspect`, `validate`, `scan` e `doctor`
And essa composição aparece separada das composições normais de notas

### Cenário 5: skill composta explicita suas dependencies
Given a IA consulta o catálogo de skills compostas
When ela abre a descrição de uma capability composta
Then ela encontra a lista de primitives usadas por essa composição
And entende se o fluxo termina em leitura, preview ou mutação
