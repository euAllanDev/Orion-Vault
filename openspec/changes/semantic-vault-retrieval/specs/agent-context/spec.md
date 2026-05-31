# Spec: agent context retrieval

## Regra de negócio
IA e agentes devem receber apenas o contexto local mais relevante para uma pergunta ou task, em vez de depender de notas inteiras ou do vault completo, preservando baixo custo de tokens e boa precisão operacional.

## Regras
1. Antes de responder ou executar uma task orientada a conhecimento, a IA pode consultar o retrieval local para montar contexto.
2. O contexto retornado deve respeitar um orçamento máximo configurado por quantidade de chunks e tamanho agregado.
3. O sistema deve preferir trechos específicos e suficientes para a tarefa em vez de enviar notas inteiras por padrão.
4. O contexto deve incluir metadados mínimos para auditoria, como nota de origem, heading relevante e score.
5. O sistema deve permitir escopo por pasta, tags, nota focal ou coleção quando isso reduzir ambiguidade.
6. O retrieval para agentes deve reutilizar os mesmos contratos locais da aplicação, sem criar um caminho paralelo fora da fronteira do vault.
7. Se o orçamento de contexto for insuficiente, o sistema pode devolver os melhores candidatos iniciais e permitir nova rodada de recuperação.
8. O sistema deve evitar duplicar trechos quase idênticos no mesmo pacote de contexto.
9. O contexto entregue deve continuar local-first e não depender de chamada remota para ser selecionado.
10. O sistema deve expor um contrato explícito de retrieval, como `retrieve` ou `agent-context`, para que IA e agentes peçam contexto sem depender de interpretar a semântica de comandos voltados a busca humana.
11. O sistema pode expor um contrato mais alto, como `agent-context`, que devolve um pacote pronto para task com foco, chunks principais, relações úteis e orçamento aplicado.
12. Quando possível, `agent-context` deve incluir um resumo curto e determinístico do contexto montado para acelerar a leitura inicial da IA ou do agente.
13. O pacote de contexto deve indicar explicitamente se o retrieval operou em modo `lexical-only` ou `hybrid`.
14. Se um provider vetorial local opcional falhar ou estiver indisponível, `agent-context` deve continuar funcionando com o mesmo contrato e cair para `lexical-only`.

## Pontos de atenção
- Mais contexto nem sempre melhora a resposta; o orçamento precisa ser tratado como parte do contrato.
- Agentes especializados podem precisar de escopo por domínio para não receber material irrelevante.
- O sistema deve evitar que a recuperação de chunks esconda totalmente a navegação para a nota original.

## Cenários

### Cenário 1: pergunta usa contexto reduzido
Given uma IA local recebe uma pergunta sobre um assunto presente no vault
When o sistema monta o contexto para a resposta
Then ele seleciona apenas os chunks mais relevantes
And evita mandar o vault inteiro para o modelo

### Cenário 2: agente especializado recebe escopo relevante
Given existe um agente focado em um domínio como Clean Architecture ou SDD
When ele solicita contexto para executar uma task
Then o sistema pode restringir a recuperação por pasta, tag, nota focal ou coleção
And o agente recebe material mais específico para aquela tarefa

### Cenário 3: orçamento limita tokens
Given o retrieval encontrou muitos trechos relevantes
When o sistema monta o pacote final de contexto
Then ele respeita o orçamento máximo configurado
And mantém os chunks de maior valor primeiro

### Cenário 4: nova rodada quando o contexto inicial é insuficiente
Given a primeira recuperação não trouxe contexto bastante para a task
When a IA ou o agente solicita mais contexto
Then o sistema pode executar nova rodada de retrieval
And continuar sem depender de carregar o vault inteiro de uma vez

### Cenário 5: comando explícito de retrieval
Given uma IA local ou agente precisa apenas montar contexto para uma task
When ela chama um comando dedicado como `retrieve`
Then o sistema devolve chunks ranqueados, escopo aplicado e orçamento de contexto
And a resposta continua separada de comandos de mutação ou planejamento
And a resposta pode indicar se os chunks vieram de ranking `lexical-only` ou `hybrid`

### Cenário 6: pacote pronto para task
Given uma IA local ou agente precisa iniciar uma task orientada a conhecimento
When ela chama um comando como `agent-context`
Then o sistema devolve um pacote com nota focal quando houver, chunks principais e notas relacionadas
And o resultado já vem limitado por orçamento total
And o agente pode começar a task sem montar manualmente várias respostas intermediárias
And o pacote indica o modo efetivo de retrieval usado para montar os chunks

### Cenário 7: resumo curto do pacote
Given o sistema conseguiu montar um pacote de agent-context
When a resposta é devolvida
Then ela pode incluir um resumo curto e determinístico do foco, assunto e sinais principais
And esse resumo ajuda a IA a entender rapidamente o contexto antes de ler todos os chunks

### Cenário 8: fallback preserva contrato do agent-context
Given o app tenta usar um provider local opcional de embeddings durante a montagem do pacote
When esse provider falha ou não devolve vetor válido
Then `agent-context` continua devolvendo foco, chunks e orçamento no mesmo formato
And o pacote indica que o modo efetivo usado foi `lexical-only`

## Refinamento futuro
- adaptar orçamento por tipo de modelo
- adicionar reranking específico por agente
- gerar memória resumida por domínio com base no índice local
