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
- reranking por nota canônica com sinais agregados por `notePath`
- embeddings locais opcionais em modo experimental
- fallback explícito para `lexical-only`
- indicação do modo efetivo de retrieval como `lexical-only` ou `hybrid`
- benchmark local de custo e relevância, incluindo casos sintéticos e um conjunto manual de ground truth
- provider externo por comando local, com modo persistente por stdio para reduzir o custo de experimentação
- identidade efetiva do provider externo refletida no cache persistido para evitar reuso silencioso ao trocar modelo/configuração relevante
- timeout defensivo também no modo `single-request`, preservando fallback quando o comando externo trava
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
- reranking heurístico por nota canônica, com diferenciação entre notas estruturais/operacionais e notas de referência

O resultado consolidado agora é:
- a infraestrutura híbrida está funcional
- o retrieval continua auditável e com fallback seguro
- o baseline heurístico atual chegou a `8/8` em `top1Hits` e `8/8` em `top1PathHits` no corpus `curated`
- esse salto final veio do reranking por nota canônica, não de promoção vetorial
- as variantes vetoriais atuais continuam sem mostrar ganho relevante que justifique custo extra sobre o baseline atualizado

Isso desloca a próxima fase de investigação para:
- chunking mais forte
- preservar e refinar o reranking por nota canônica como baseline principal
- possivelmente outra unidade de recuperação antes de promover qualquer provider vetorial

A rodada imediatamente seguinte passa a comparar explicitamente o baseline atual contra uma variante experimental `sentence-tight`, que reduz o tamanho alvo dos chunks mantendo o mesmo reranking. Essa comparacao existe para responder se o próximo ganho vem da unidade de recuperação antes de reabrir a discussão sobre novos providers vetoriais.

Depois de ampliar o corpus `curated` com notas longas e queries orientadas a boundaries de chunk, a resposta ficou mais clara: a variante `sentence-tight` alterou custo e exercitou mais a indexacao, mas nao mudou os acertos de nota canônica contra o baseline equivalente. O novo corpus, porém, revelou uma falha mais valiosa para a próxima etapa: uma generalizacao excessiva de notas estruturais como `knowledge/relationship-map`, que passaram a competir bem demais em queries abstratas de outros domínios. Com isso, a prioridade prática sai de `chunkingStrategy` e volta para calibragem de reranking/alias estrutural.

Com a rodada de ajuste seguinte, esse falso positivo cross-domain foi contido sem depender de promover embeddings ou `sentence-tight`. O baseline voltou a acertar o dominio em `12/12` no corpus curado ampliado e ficou em `11/12` na nota canônica esperada. O erro remanescente ficou intra-domínio: `layers-glossary` ainda supera `runtime-guidance` em uma query abstrata de arquitetura. Isso desloca a próxima fase para diferenciar melhor notas de referência vs notas de execução dentro do mesmo domínio, especialmente quando a query usa linguagem conceitual parecida com a do glossário.

## Evolução futura
O contrato deve permitir adicionar depois:
- reranking mais forte
- recuperação específica por agente
- memória operacional resumida por domínio

Antes de promover um novo provider além de experimento, a trilha atual passa a depender menos de expansão rápida de implementação e mais de avaliação curada de relevância, com comparação explícita entre custo local, acerto por domínio e acerto na nota canônica esperada.

Com a rodada atual, essa avaliação curada passa a registrar explicitamente que a fronteira de valor do retrieval melhorou por heurística local explicável. Portanto, qualquer próxima promoção vetorial precisa superar um baseline que já fecha o corpus curado em nota canônica, e não apenas empatar com ele.
