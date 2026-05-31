# Change: semantic-vault-retrieval

Status: draft
Date: 2026-05-20

## Objetivo
Adicionar um índice semântico local, leve e persistente para recuperar contexto por chunks de notas, melhorar a busca para IA e habilitar agentes especializados por assunto sem depender de carregar o vault inteiro no prompt.

## Problema
Hoje o projeto já possui busca textual local, relações semânticas por nota e graph, mas ainda fica frágil quando a IA ou o usuário precisam recuperar conhecimento mais granular para escrever, responder ou executar tasks. Buscar só por texto ou por nota inteira pode trazer contexto demais, contexto de menos ou contexto ruidoso, especialmente em vaults com rascunhos, notas curtas, testes e estrutura inconsistente.

## Solução proposta
O sistema irá:
- quebrar notas Markdown em chunks reutilizáveis para recuperação semântica local
- calcular e persistir um índice leve por chunk com sinais interpretáveis
- combinar busca textual, sinais estruturais e similaridade semântica local para ranquear contexto
- expor esse retrieval para CLI, desktop, IA e agentes sob o mesmo contrato local
- limitar o contexto retornado por orçamento e relevância, reduzindo desperdício de tokens

## Impacto no sistema
- melhora a qualidade de contexto entregue para IA e agentes
- reduz a necessidade de mandar notas inteiras para o modelo
- fortalece search, context, related e graph com base comum de recuperação
- cria uma base incremental para embeddings locais opcionais no futuro, sem tornar isso obrigatório agora

## Escopo
Incluído:
- índice local persistente por chunk
- pipeline incremental de indexação e reindexação
- filtros para ruído, notas muito curtas e caminhos excluídos
- retrieval híbrido para perguntas, escrita assistida e tasks de agentes
- orçamento de contexto para evitar prompts excessivos

Excluído:
- dependência obrigatória de embeddings remotos
- envio automático do vault inteiro para a IA
- execução autônoma cega sem validação dos contratos já existentes
- mutação do markdown durante indexação

## Resultado esperado
Ao final da mudança, o sistema deve conseguir transformar notas em unidades menores e reutilizáveis de contexto, recuperar apenas os trechos mais relevantes para uma tarefa e entregar esse material para IA e agentes com baixo custo operacional e melhor precisão local.
