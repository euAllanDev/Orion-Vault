# Step 2: Embeddings Locais Hibridos

## Objetivo
Evoluir o retrieval semantico atual de `chunks + termos + sinais estruturais` para uma estrategia hibrida com embeddings locais opcionais, sem perder previsibilidade, auditabilidade e operacao local-first.

## Por que este step existe
Hoje o Orion Vault ja consegue:
- quebrar notas em chunks determinísticos
- persistir um indice local por chunk
- ranquear chunks por termos, tags, title, heading, path e peso de qualidade
- entregar contexto reduzido para `retrieve` e `agent-context`

Esse baseline ja e bom o bastante para:
- perguntas diretas com termos parecidos
- foco por pasta, nota ou tag
- reducao de ruido por rascunhos e testes

Mas ele ainda fica mais fraco quando a pergunta:
- usa sinonimos
- descreve um conceito sem repetir as mesmas palavras da nota
- mistura contexto conceitual com termos diferentes

## Resultado esperado
Ao final deste step, o projeto deve ser capaz de:
- gerar embeddings locais por chunk sem depender de internet
- persistir esses embeddings sob o mesmo indice local do vault
- combinar score lexical atual com score vetorial
- continuar explicando por que um chunk apareceu
- cair de volta para o retrieval atual quando embeddings nao estiverem disponiveis

## Principios obrigatorios
1. O retrieval atual continua sendo a baseline segura.
2. Embeddings entram como camada adicional, nao como substituicao cega.
3. O fluxo continua local-first e sem dependencia obrigatoria de servicos remotos.
4. O contrato de `retrieve` e `agent-context` nao deve quebrar.
5. A indexacao nao pode mutar o Markdown das notas.
6. O sistema deve continuar auditavel mesmo com score vetorial.
7. O custo local de indexacao e consulta precisa ser mensuravel antes de promover o recurso.

## Estado atual resumido
Hoje a base ja possui:
- chunking por sections e paragrafos
- persistencia em `.orion/index/semantic-chunks.json`
- fingerprint por nota para reaproveitar chunks nao alterados
- budget por `maxChunks` e `maxCharacters`
- comandos reais `orion /retrieve` e `orion /agent-context`

Hoje ela ainda nao possui:
- embeddings densos por chunk
- score vetorial no ranking
- politica configuravel para ligar ou desligar embeddings
- validacao forte de custo em vaults maiores

## Arquitetura alvo
### 1. Manter o indice atual como baseline
O indice atual continua armazenando:
- `chunkId`
- `notePath`
- `title`
- `heading`
- `tags`
- `text`
- `tokenCount`
- `terms`
- `fingerprint`

Ele continua sendo suficiente para:
- fallback
- debug
- ranking lexical
- auditoria legivel

### 2. Adicionar embeddings por chunk
Cada chunk passa a poder carregar opcionalmente:
- `embeddingModel`
- `embeddingVersion`
- `embeddingDimensions`
- `embedding`
- `embeddingFingerprint`

O `embeddingFingerprint` deve permitir reaproveitar vetores quando o chunk nao mudou.

### 3. Score hibrido
O ranking deve combinar pelo menos:
- score lexical atual
- score vetorial por similaridade
- reforco estrutural atual
- peso de qualidade por ruido conhecido

Formula inicial sugerida:
- `finalScore = lexicalScore * 0.55 + vectorScore * 0.35 + structuralBoost * 0.10`

Observacao:
- os pesos sao apenas ponto de partida
- devem ser ajustados por validacao real

### 4. Fallback explicito
Se embeddings nao estiverem disponiveis:
- o retrieval continua funcionando com o ranking atual
- nenhuma interface deve quebrar
- o sistema deve marcar no diagnostico que operou em modo lexical-only

## Escopo funcional
### Incluido
- embeddings locais por chunk
- persistencia local de embeddings
- ranking hibrido
- fallback lexical
- medicao de custo de indexacao e consulta
- diagnostico simples do modo ativo: `lexical-only` ou `hybrid`

### Excluido
- dependencia obrigatoria de API externa
- troca completa do pipeline atual
- reranker remoto
- embeddings por nota inteira como unidade principal
- ajuste fino por GPU como requisito inicial

## Sequencia recomendada
1. Extrair o indice atual para suportar campos vetoriais opcionais sem quebrar o formato existente.
2. Criar um provider local de embeddings substituivel em `infra`.
3. Gerar embeddings por chunk durante a indexacao somente quando o provider estiver habilitado.
4. Persistir embeddings e metadados de modelo no indice local.
5. Adicionar score vetorial ao `SemanticRetrievalService`.
6. Implementar modo hibrido com fallback transparente para lexical-only.
7. Medir tempo, tamanho do indice e qualidade de retrieval em vaults reais.
8. Ajustar pesos e politicas antes de promover o recurso no produto.

## Mudancas provaveis no codigo
- `application/services/chunked-note-index.service.ts`
- `application/services/semantic-retrieval.service.ts`
- `application/dto/semantic-retrieval.dto.ts`
- `application/services/ai-bridge.service.ts`
- `infra/ai/local-models/*`
- `infra/filesystem/index-store/*` se o indice persistido for extraido para modulo dedicado
- `interfaces/cli/commands/retrieve.ts`
- `interfaces/cli/commands/agent-context.ts`

## Contrato tecnico minimo
### Novo provider local de embeddings
Deve receber:
- `chunkId`
- `text`
- `title?`
- `heading?`
- `tags[]`

Deve devolver:
- `model`
- `dimensions`
- `vector`
- `fingerprint`

### Indice persistido
O indice deve continuar legivel sem embeddings.

Se embeddings estiverem presentes, cada chunk pode armazenar:
- `embeddingModel`
- `embeddingVersion`
- `embeddingDimensions`
- `embedding`
- `embeddingFingerprint`

### Retrieval
O contrato de saida atual pode continuar igual para o consumidor final.

Internamente, o ranking deve passar a conhecer:
- `lexicalScore`
- `vectorScore`
- `finalScore`

Se fizer sentido, esses campos podem aparecer em modo debug sem poluir a saida padrao.

## Estrategia de rollout
### Fase 1: experimental
- embeddings atras de flag local
- comparacao lado a lado com o ranking atual
- sem mudar a narrativa principal do produto

Resultado atual do benchmark inicial:
- `token-hash-local` validou bem o contrato tecnico de embeddings e o fluxo `hybrid`
- o custo local cresceu de forma relevante em latencia e tamanho de indice
- o ganho percebido apareceu mais em consultas ja lexicais do que em consultas conceituais
- por isso, o recurso deve continuar experimental enquanto novos providers locais sao comparados
- um benchmark comparativo com o prototipo `expanded-token-hash-local` mostrou custo ainda maior, sem melhora consistente de relevancia, entao esse caminho nao deve ser promovido como proximo default
- o caminho `external-command` passou a aceitar um modo persistente por stdio, reduzindo fortemente a latencia do experimento externo em comparacao com o modelo one-shot por processo
- mesmo com provider externo persistente e com um embedder comparativo mais rico, o benchmark atual ainda nao mostrou melhora clara nas queries conceituais frente ao baseline leve existente
- por isso, antes de promover um novo provider, a base agora recomenda investir em avaliacao mais curada de relevancia, com ground truth manual e comparacao por nota canonica esperada
- a avaliacao curada posterior confirmou a mesma leitura: `noop`, `token-hash` e `ollama:nomic-embed-text` continuaram empatados nos principais erros de nota canonica esperada, apesar de custos muito diferentes
- experimentos de composicao (`full` vs `body-only`), prefixos de query/documento e pesos `vector-heavy` tambem nao destravaram esses erros
- por isso, a trilha futura mais promissora deixa de ser "trocar provider de embedding" e passa a ser "rever chunking e reranking"
- a rodada seguinte confirmou essa aposta: reforcos de chunking deterministico por sentenca, deduplicacao de contexto, reranking em segunda passada e um sinal interpretavel de `concept alias` destravaram os casos `product` e `learning` no corpus `curated`, elevando o baseline atualizado para `8/8` em `top1Hits` e `6/8` em `top1PathHits` sem depender de promover embeddings
- a validacao manual no vault real repetiu o mesmo comportamento em `lexical-only`, com `customer learning assumption testing` apontando para `product/discovery-loop.md` e `support diagnosis during outage` priorizando `operations/incident-playbook.md`
- por outro lado, a rodada sintetica em `small`, `medium` e `large` manteve a mesma leitura de custo: `token-hash` continua perto de `2.8x` o tamanho do indice baseline e `expanded-token-hash` perto de `4.5x`, sem um delta de relevancia que justifique promovê-los antes de novas evidencias

### Fase 2: beta
- embeddings hibridos disponiveis para usuario dev
- runbooks medindo ganho real em consultas conceituais
- promover o ganho atual de retrieval lexical/reranking para o fluxo dev antes de reabrir a discussão sobre provider vetorial default

### Fase 3: promocao
- embeddings deixam de ser apenas experimento se mostrarem:
  - ganho claro de relevancia
  - custo local aceitavel
  - indice ainda leve o bastante

## Criterios de aceite
Este step so deve ser considerado concluido quando:
- o sistema consegue indexar embeddings localmente sem internet
- `retrieve` continua funcionando com e sem embeddings
- o ranking hibrido melhora pelo menos parte das consultas conceituais sem degradar demais as consultas diretas
- o custo local fica documentado para vault pequeno, medio e maior
- o indice persistido continua suportando reaproveitamento incremental
- o consumidor final de `retrieve` e `agent-context` nao precisa aprender um segundo contrato

## Testes esperados
- testes unitarios para score vetorial e score hibrido
- testes unitarios para fallback lexical-only
- testes de persistencia para chunks com e sem embeddings
- testes de reaproveitamento por fingerprint de chunk
- testes de integracao para `retrieve` e `agent-context` em modo hibrido
- testes de custo local com amostras de vault pequeno, medio e maior

## Perguntas abertas
- qual provider local de embeddings cabe melhor no desktop sem elevar demais o peso do app?
- o embedding deve ser calculado so do texto do chunk ou tambem de `title + heading + tags`?
- os embeddings devem ficar no mesmo arquivo `.orion/index/semantic-chunks.json` ou em um artefato separado?
- vale a pena suportar rebuild parcial por chunk em vez de apenas por nota?
- qual modo de diagnostico o produto deve expor para deixar claro quando operou em `lexical-only`?

Estado da investigacao atual:
- `token-hash-local` segue util como baseline experimental e para exercitar persistencia, score vetorial e fallback
- um prototipo `expanded-token-hash-local` foi criado apenas para benchmark comparativo, sem promover ainda um novo provider para o runtime oficial
- o prototipo comparativo atual nao mostrou relacao custo-beneficio melhor que o baseline `token-hash-local`
- o benchmark agora possui tambem casos manuais de ground truth e metricas como `top1PathHit` e `top3PathHit`, que ajudam a separar melhor acerto por dominio de acerto na nota canonica esperada
- o corpus `curated` versionado passou a ser a referencia mais confiavel para decidir promocao, porque ele mostra com mais clareza os erros de nota canonica que o corpus sintetico escondia
- a hipotese de que o problema estava so em metadados extras no embedding, em prefixos de input do modelo ou nos pesos do score hibrido ficou enfraquecida pelos experimentos atuais

## Recomendacao pratica
O melhor proximo passo nao e substituir o retrieval atual.

O melhor proximo passo e:
- preservar o pipeline atual
- adicionar embeddings como camada opcional
- validar ganho real com benchmark sintetico e com avaliacao manual curada
- usar o corpus `curated` para decidir qualquer promocao futura
- priorizar, numa proxima etapa, experimentos de chunking e reranking antes de insistir em nova troca de provider
- so depois decidir se o modo hibrido vira padrao
