# Design: semantic-vault-retrieval

## Direção
Esta mudança separa explicitamente:
- representação semântica local
- recuperação de contexto
- projeção visual do graph

O índice semântico não deve depender de coordenadas visuais nem de um único valor escalar por nota. A representação precisa ser multidimensional e interpretável, enquanto o graph pode continuar derivando posições 2D a partir de relações e layout.

## Unidade principal
A unidade de recuperação passa a ser o chunk, não apenas a nota inteira.

Cada chunk deve carregar, no mínimo:
- `chunkId`
- `notePath`
- `title`
- `headings`
- `tags`
- `text`
- `tokenCount`
- `signals`
- `fingerprint`

## Estratégia inicial
A estratégia inicial deve permanecer leve e local-first:
- chunking determinístico por seções e tamanho aproximado
- vetores esparsos locais baseados em TF-IDF ou estrutura equivalente já interpretável
- reforço por tags, headings, links manuais, backlinks e pasta
- orçamento de contexto por número máximo de chunks e tamanho máximo agregado

## Estado atual da implementação
Na base atual, o retrieval já opera com:
- índice persistido por chunk em `.orion/index/semantic-chunks.json`
- reaproveitamento incremental por fingerprint de nota
- reaproveitamento incremental de embeddings por chunk inalterado
- ranking lexical e estrutural como baseline
- embeddings locais opcionais em modo experimental
- fallback explícito para `lexical-only`
- indicação do modo efetivo de retrieval como `lexical-only` ou `hybrid`
- benchmark local de custo e relevância, incluindo casos sintéticos e um conjunto manual de ground truth
- provider externo por comando local, com modo persistente por stdio para reduzir o custo de experimentação
- benchmark curado versionado com nota canônica esperada e notas-distratoras
- modo de debug na CLI para inspecionar score total, lexical, vetorial e modo de ranking
- diagnóstico do índice semântico local em `maintenance-diagnose`

## Leitura atual da investigação
Até o estado atual, a trilha experimental já comparou:
- providers leves internos
- providers externos persistentes equivalentes
- um embedder neural local real via Ollama
- composição `full` vs `body-only`
- prefixos `query/document` para o Ollama
- reranking `vector-heavy`

O resultado permanece o mesmo:
- a infraestrutura híbrida está funcional
- o retrieval continua auditável e com fallback seguro
- porém os casos curados de nota canônica continuam empatados entre baseline lexical e variantes vetoriais atuais

Isso desloca a próxima fase de investigação para:
- chunking mais forte
- reranking mais forte e separado do embedding base
- possivelmente outra unidade de recuperação antes de promover qualquer provider vetorial

## Evolução futura
O contrato deve permitir adicionar depois:
- reranking mais forte
- recuperação específica por agente
- memória operacional resumida por domínio

Antes de promover um novo provider além de experimento, a trilha atual passa a depender menos de expansão rápida de implementação e mais de avaliação curada de relevância, com comparação explícita entre custo local, acerto por domínio e acerto na nota canônica esperada.
