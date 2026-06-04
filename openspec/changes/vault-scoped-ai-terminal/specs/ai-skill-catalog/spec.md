# Spec Delta: ai-skill-catalog

## Contexto
O Orion Vault deve poder apresentar suas capacidades para IA como um catalogo local de skills e flows recomendados, sem exigir leitura do repositorio do app para descoberta operacional.

## ADDED Regras
1. O sistema deve expor um catálogo local de skills disponíveis para a IA no contexto do vault ativo.
2. O catálogo deve descrever capabilities já existentes do produto, sem criar um vocabulário paralelo obrigatório.
3. Cada skill deve informar categoria, objetivo de uso, entradas esperadas e natureza da saída.
4. Cada skill deve informar se muta o vault e se depende de preview validado.
5. O sistema deve poder expor flows recomendados compostos por steps ordenados de skills.
6. O catálogo deve priorizar a descoberta de skills de contexto e planejamento antes de recursos de execução.
7. Skills de manutenção do app, quando existirem, devem aparecer separadas das skills normais de notas.
8. A apresentação do catálogo deve continuar tratanto o vault ativo como contexto primário da IA.
9. O catálogo deve ser consumível por humanos e por IA em formato textual, estruturado ou ambos.
10. A existência do catálogo não pode remover nem substituir os comandos atuais do produto como superfície operacional autoritativa.

## ADDED Pontos de atenção
- O catálogo não deve virar uma segunda CLI concorrente.
- O valor do catálogo está em explicitar intenção, ordem e limites de uso.
- Flows recomendados ajudam a reduzir improviso da IA em tarefas comuns.
- Skills compostas podem evoluir por cima das primitivas existentes, não no lugar delas.
- A próxima evolução natural do catálogo é suportar skills compostas orientadas à intenção da task.
- Quando uma skill composta real já existir, como `prepare-edit-task`, o catálogo deve tratá-la como capability operacional concreta, não apenas como ideia futura.

## ADDED Cenários

### Cenário 1: IA descobre skills sem explorar o repositório
Given a sessão da IA foi aberta no vault ativo
When a IA consulta o catálogo de skills do produto
Then ela encontra as capacidades disponíveis com objetivo e categoria explícitos
And não precisa inferir o fluxo operacional a partir de arquivos internos do app

### Cenário 2: skill informa risco operacional
Given uma skill de execução segura está listada no catálogo
When a IA lê seus metadados
Then ela entende se a skill muta o vault
And entende se ela exige preview validado antes da execução

### Cenário 3: flow recomendado orienta a ordem das ações
Given a IA precisa operar sobre notas do vault
When ela consulta os flows recomendados do produto
Then o sistema apresenta uma sequência explícita de leitura, planejamento e execução
And o fluxo recomendado prioriza contexto e preview antes de mutação

### Cenário 4: manutenção do app aparece separada
Given o produto possui fluxos voltados ao próprio app
When a IA consulta o catálogo de skills
Then as capabilities de manutenção aparecem separadas das capabilities normais de notas
And o vault continua sendo a fronteira principal do fluxo padrão

### Cenário 5: skills compostas reutilizam primitivas existentes
Given o produto evoluiu para suportar skills compostas
When a IA consulta o catálogo de capabilities
Then ela encontra skills de nível mais alto descritas como composições sobre capacidades já existentes
And o sistema preserva as primitivas atuais como superfície operacional autoritativa

### Cenário 6: catálogo expõe preparação de edição como skill real
Given o produto já possui uma skill composta real para preparar edição de nota
When a IA consulta o catálogo de skills
Then ela encontra `prepare-edit-task` com categoria, inputs, saída e dependencies explícitos
And consegue distingui-la de `prepare-writing-task` e `analyze-note`
