# Spec: semantic retrieval

## Regra de negócio
O sistema deve manter um índice semântico local e persistente por chunks de notas para recuperar contexto relevante de forma barata, previsível e auditável antes de enviar material para IA, agentes ou superfícies de navegação.

## Regras
1. O índice deve operar apenas sobre notas Markdown dentro do vault ativo.
2. A unidade principal de recuperação deve ser o chunk, preservando referência clara para a nota de origem.
3. O chunking deve ser determinístico para o mesmo conteúdo de entrada.
4. O índice deve persistir localmente sem alterar o conteúdo Markdown das notas.
5. O índice deve suportar atualização incremental quando notas forem criadas, editadas, movidas, renomeadas ou removidas.
6. A recuperação deve combinar pelo menos texto e sinais estruturais; relações locais conhecidas podem reforçar o escopo e o ranking quando disponíveis.
7. O resultado deve priorizar trechos relevantes e não apenas notas inteiras quando isso reduzir ruído.
8. O sistema deve poder excluir caminhos configuráveis de baixo valor semântico, como testes, rascunhos ou diretórios explicitamente ignorados.
9. Notas muito curtas, vazias ou predominantemente ruidosas podem receber peso reduzido ou serem ignoradas conforme política local.
10. O índice deve continuar local-first e não exigir internet para construir ou consultar o retrieval.
11. A recuperação deve ser auditável o suficiente para explicar por que um chunk apareceu no ranking.
12. O índice pode armazenar embeddings locais opcionais por chunk sob o mesmo contrato persistido, sem tornar a camada vetorial obrigatória.
13. Quando embeddings locais estiverem habilitados, o ranking pode operar em modo híbrido, combinando score lexical e score vetorial.
14. Quando embeddings não estiverem disponíveis, o sistema deve continuar operando em modo `lexical-only` sem quebrar os contratos de `retrieve` e `agent-context`.
15. O sistema deve expor de forma explícita o modo de retrieval efetivamente usado, como `lexical-only` ou `hybrid`, em respostas estruturadas ou diagnósticos equivalentes.
16. O sistema pode aceitar providers locais de embeddings plugáveis por configuração explícita, incluindo comandos externos locais, sem tornar esse provider o padrão automaticamente.
17. Providers vetoriais experimentais só devem ser promovidos além de modo experimental quando benchmarks repetíveis mostrarem ganho real de relevância com custo local aceitável.
18. O reaproveitamento de embeddings persistidos deve considerar a identidade efetiva do provider configurado, incluindo mudanças relevantes de modelo, versão, dimensões ou configuração externa que alterem o vetor produzido.
19. Se um provider externo local ficar pendurado sem responder, o sistema deve encerrar a tentativa em tempo razoável e continuar conseguindo operar em `lexical-only`.

## Pontos de atenção
- O índice precisa ser leve o suficiente para não degradar a experiência desktop em vaults comuns.
- Exclusões por ruído não podem esconder contexto importante sem mecanismo claro de revisão.
- Chunks não devem perder o vínculo com título, heading e nota de origem.
- A base inicial deve ser simples o bastante para caber na arquitetura atual sem depender de banco externo.
- A camada vetorial inicial pode ser experimental, mas não deve comprometer a auditabilidade nem a previsibilidade do ranking atual.
- Um provider externo local mal configurado ou indisponível não deve quebrar o retrieval; o sistema deve continuar conseguindo operar em `lexical-only`.

## Cenários

### Cenário 1: indexar notas em chunks locais
Given um vault com notas Markdown válidas
When o sistema constrói ou atualiza o índice local
Then cada nota elegível é dividida em chunks determinísticos
And cada chunk fica associado à nota, headings, tags e sinais locais relevantes

### Cenário 2: recuperar trechos mais relevantes
Given uma pergunta ou intenção de tarefa
When o sistema executa o retrieval local
Then ele retorna chunks ranqueados por relevância
And cada chunk mantém referência para a nota de origem
And o ranking continua explicável por sinais locais
And a resposta pode indicar se o ranking operou em modo `lexical-only` ou `hybrid`

### Cenário 3: reindexação incremental
Given uma nota já indexada foi alterada
When o sistema atualiza o índice
Then apenas a nota afetada e os sinais globais necessários são recalculados
And o restante do vault não precisa ser reprocessado integralmente

### Cenário 4: ruído conhecido é excluído
Given o vault contém diretórios ou notas marcadas como rascunho, teste ou ruído
When o sistema constrói ou consulta o índice
Then esses caminhos podem ser excluídos ou receber peso reduzido conforme política local
And o retrieval principal fica menos contaminado

### Cenário 5: índice não muta notas
Given o sistema está indexando ou reindexando o vault
When o processo termina
Then nenhuma nota Markdown foi alterada por causa da indexação

### Cenário 6: embeddings opcionais não quebram o retrieval
Given o vault possui suporte local a embeddings por chunk
When o sistema constrói ou consulta o índice
Then ele pode persistir embeddings locais opcionais por chunk
And o contrato principal de retrieval continua compatível com o modo lexical atual

### Cenário 7: fallback lexical continua ativo
Given embeddings locais não estão disponíveis ou estão desabilitados
When o sistema executa o retrieval
Then ele continua retornando chunks ranqueados por sinais lexicais e estruturais
And a resposta informa que o modo usado foi `lexical-only`

### Cenário 8: provider externo falha sem derrubar o retrieval
Given o app está configurado para usar um provider local externo de embeddings
When esse provider não está disponível, retorna erro ou não devolve vetor válido
Then o retrieval continua funcionando com o ranking lexical e estrutural atual
And o modo efetivo exposto ao consumidor permanece `lexical-only`

### Cenário 9: benchmark decide promoção de provider experimental
Given existe um provider vetorial experimental local
When o time executa o benchmark repetível de embeddings em vaults pequeno, médio e maior
Then a promoção desse provider depende de ganho claro em consultas conceituais
And depende também de custo local aceitável de latência e tamanho de índice

### Cenário 10: mudança de modelo invalida embeddings persistidos
Given o índice local já possui embeddings persistidos para um provider externo configurado
When a identidade efetiva desse provider muda, como em troca de modelo ou configuração vetorial relevante
Then o sistema não reaproveita silenciosamente os vetores antigos
And os embeddings e caches de query passam a ser recalculados para a nova identidade

### Cenário 11: comando externo pendurado não bloqueia retrieval
Given o app está configurado para usar um provider local externo de embeddings
When esse comando inicia mas não devolve resposta válida em tempo razoável
Then a tentativa vetorial é encerrada
And o retrieval continua funcionando com o ranking lexical e estrutural atual
And o modo efetivo exposto ao consumidor permanece `lexical-only`

## Refinamento futuro
- suportar políticas configuráveis por pasta, tag e tipo de nota
- suportar camadas separadas de retrieval para conhecimento estável e memória operacional
