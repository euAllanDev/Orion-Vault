# Embedding Benchmark Runbook

## Objetivo
Repetir a medicao de custo e ganho real dos providers locais de embeddings antes de promover qualquer modo hibrido para beta.

## Script
- `pnpm benchmark:embeddings`

Para incluir um provider externo local no benchmark:
- `ORION_BENCHMARK_EMBEDDINGS_COMMAND=<comando local>`
- `ORION_BENCHMARK_EMBEDDINGS_LABEL=<rotulo opcional>`

Para limitar uma rodada de benchmark:
- `ORION_BENCHMARK_SIZES=small,medium`
- `ORION_BENCHMARK_PROVIDERS=noop,token-hash,external-command`

Para rodar apenas o corpus curado versionado:
- `ORION_BENCHMARK_SIZES=curated`

## O que o script mede
- tempo de indexacao fria do indice semantico
- tempo de reindexacao quente reaproveitando o indice local
- tempo de retrieval frio por vault pequeno, medio e maior
- tempo de retrieval quente apos reaproveitar o indice
- tamanho de `.orion/index/semantic-chunks.json`
- comportamento de queries diretas, conceituais e operacionais
- comportamento de queries `hard-conceptual`, onde a query usa alias e a nota canonica evita repetir essa mesma formulacao
- acerto esperado por dominio nas primeiras respostas do ranking
- tamanho medio e maximo do contexto realmente entregue ao prompt

## Corpus curado
O benchmark agora inclui um recorte `curated`, separado do corpus sintético.

Arquivos:
- `tests/fixtures/embedding-benchmark-curated/manifest.json`
- `tests/fixtures/embedding-benchmark-curated/**/*.md`

Uso:
- cada query curada tem `expectedPathPrefix` explícito como ground truth da nota canônica
- o corpus inclui também notas-distratoras com sobreposição lexical enganosa
- isso ajuda a distinguir melhor “achou o domínio” de “achou a nota certa”

## Providers comparados hoje
- `noop`
- `token-hash`
- `token-hash-body-only`
- `expanded-token-hash`
- `expanded-token-hash-body-only`
- `local-embedder-persistent`
- `local-embedder-persistent-body-only`
- `local-embedder-expanded-persistent`
- `local-embedder-expanded-persistent-body-only`
- `external-command` quando `ORION_BENCHMARK_EMBEDDINGS_COMMAND` estiver configurado

Observacao:
- `expanded-token-hash` e apenas prototipo de pesquisa; nao e provider oficial do runtime.
- `local-embedder-persistent` e `local-embedder-expanded-persistent` exercitam o mesmo contrato `external-command` do runtime usando os scripts de referencia do repositorio em modo persistente por stdio.
- os sufixos `-body-only` forcam o benchmark a embedar apenas o corpo do chunk, removendo `title`, `heading` e `tags` da entrada vetorial para medir se esses metadados estao ajudando ou contaminando o ranking.

## Saida
- console com JSON resumido
- arquivo salvo em `%TEMP%\opencode\orion-embedding-benchmark\results.json`
- cada tamanho de vault agora lista `providers[]`, com `key`, `providerName` e `result`
- cada tamanho de vault agora inclui tambem `comparisonSummary[]`, comparando cada provider contra o baseline `noop`
- cada `result` agora inclui `coldIndexMs`, `warmIndexMs`, `averageQueryMs`, `p95QueryMs` e `hybridQueryCount`
- cada `result` agora inclui `contextBudget`, com media e maximo de `chunks` e `characters` devolvidos nas queries do benchmark
- cada item de `quality[]` agora inclui `expectedDomain`, `top1DomainHit`, `top3DomainHit` e `relevantHitsInTop3`
- cada provider tambem inclui `qualitySummary`, com totais e agrupamento por `direct`, `conceptual` e `cross-domain`
- o agrupamento tambem inclui `hard-conceptual`, para separar casos em que a nota canonica nao compartilha a mesma sobreposicao lexical da query
- alguns casos agora tambem incluem `expectedPathPrefix`, `top1PathHit` e `top3PathHit` para validar notas manuais de ground truth

## Como interpretar
Promover um provider so faz sentido se ele mostrar ao mesmo tempo:
- ganho claro em queries conceituais
- degradacao aceitavel de latencia fria e quente
- custo de indexacao e reindexacao ainda razoavel para uso repetido no desktop
- tamanho de indice ainda razoavel para desktop local-first

Leitura pratica das novas metricas:
- `top1DomainHit=true`: o primeiro chunk retornado caiu no dominio esperado da query
- `top3DomainHit=true`: pelo menos um dos tres primeiros chunks caiu no dominio esperado
- `relevantHitsInTop3`: quantos dos tres primeiros chunks estavam no dominio esperado

Em geral:
- `top1DomainHit` ajuda a avaliar precisao imediata
- `top3DomainHit` ajuda a avaliar recall util para contexto de IA
- `relevantHitsInTop3` ajuda a ver densidade de contexto realmente aproveitavel
- `top1PathHit` ajuda a verificar se o primeiro resultado bateu exatamente em uma nota manual esperada
- `top3PathHit` ajuda a verificar se essa nota manual apareceu cedo o suficiente para ser util
- `coldIndexMs` e `warmIndexMs` ajudam a separar custo de indexacao do custo de consulta
- `averageQueryMs` e `p95QueryMs` ajudam a detectar providers instaveis ou com cauda alta
- `contextBudget.averageCharacters` e `contextBudget.maxCharacters` ajudam a medir impacto real em prompts maiores

Leitura dos casos manuais:
- os arquivos em `manual/*.md` funcionam como ground truth explicito para consultas conceituais e cross-domain
- neles, `expectedPathPrefix` e mais forte que o dominio, porque testa se o ranking encontrou a nota canônica que representa aquela intenção
- se `top3DomainHit=true` mas `top3PathHit=false`, o provider encontrou o assunto geral mas nao trouxe a nota manual mais representativa

Leitura do resumo agregado:
- `qualitySummary.top1Hits` e `qualitySummary.top3Hits` mostram o acerto total do provider no conjunto atual
- `qualitySummary.byType.direct` mostra se o provider preserva bem as queries faceis
- `qualitySummary.byType.conceptual` mostra se ele realmente melhora consultas semanticas
- `qualitySummary.byType.hard-conceptual` mostra se ele consegue aproximar aliases conceituais de notas canonicas com pouca ou nenhuma sobreposicao lexical direta
- `qualitySummary.byType.cross-domain` ajuda a detectar generalizacao fora do caso mais obvio do dominio principal

Leitura rapida para decisao:
- `comparisonSummary[].vsBaseline.bytesRatio > 1` mostra quanto o indice cresceu contra `noop`
- `comparisonSummary[].vsBaseline.coldIndexRatio` e `averageQueryRatio` mostram o multiplicador real de custo
- `comparisonSummary[].vsBaseline.conceptualTop1Delta` mostra se o provider ganhou ou perdeu nos casos conceituais normais
- `comparisonSummary[].vsBaseline.hardConceptualPathTop1Delta` mostra se ele realmente melhorou os casos mais importantes: acertar a nota canonica em consultas sem sobreposicao lexical direta
- se os deltas conceituais ficarem zerados ou negativos enquanto os ratios de custo sobem muito, o provider ainda nao justificou promocao
- comparar `full` vs `body-only` ajuda a decidir se o problema esta na forca do provider ou na composicao do texto enviado para embedding

Regra pratica:
- se um provider sobe muito o custo mas continua empatado no `qualitySummary.byType.conceptual`, ele ainda nao justificou promocao

Sinais de alerta:
- custo acima de 2x sem ganho evidente de relevancia
- reindexacao quente ainda alta demais para uso iterativo no vault
- contexto entregue cresce muito sem ganho equivalente de relevancia
- melhora apenas em consultas ja lexicais
- falha sistematica nos casos `hard-conceptual`, mesmo quando o provider promete ganho semantico
- falsos positivos conceituais persistentes

## Passos recomendados
1. Rodar `pnpm benchmark:embeddings`.
2. Comparar custo e qualidade do provider candidato contra `noop` e `token-hash`.
3. Registrar o resultado em `openspec/changes/semantic-vault-retrieval/tasks.md`.
4. So considerar promocao para beta se houver ganho real de relevancia com custo local aceitavel.

Exemplo com provider externo:
```powershell
$env:ORION_BENCHMARK_EMBEDDINGS_COMMAND = 'node scripts/local-embedder.js --stdio-server'
$env:ORION_BENCHMARK_EMBEDDINGS_LABEL = 'local-embedder-persistent'
$env:ORION_BENCHMARK_SIZES = 'small'
$env:ORION_BENCHMARK_PROVIDERS = 'noop,token-hash,local-embedder-persistent'
pnpm benchmark:embeddings
```

Exemplo sem variavel extra, usando os providers persistentes builtin do benchmark:
```powershell
$env:ORION_BENCHMARK_SIZES = 'small'
$env:ORION_BENCHMARK_PROVIDERS = 'noop,token-hash,local-embedder-persistent,local-embedder-expanded-persistent'
pnpm benchmark:embeddings
```

Exemplo focado só no corpus curado:
```powershell
$env:ORION_BENCHMARK_SIZES = 'curated'
$env:ORION_BENCHMARK_PROVIDERS = 'noop,token-hash'
pnpm benchmark:embeddings
```

Observacao pratica atual:
- o caminho `external-command` ja serve para validar contrato e relevancia comparativa
- porem, quando cada embedding ainda exige um novo processo local, a latencia pode continuar alta demais para promocao direta no desktop
- o `local-embedder` de referencia agora aceita `--stdio-server`, permitindo manter um processo persistente e reduzir bastante o custo por invocacao no benchmark
- o repositorio tambem inclui `scripts/local-embedder-expanded.js --stdio-server` como referencia mais rica para testes comparativos, ainda experimental
- se um provider externo mostrar relevancia boa mas custo ainda ruim mesmo em modo persistente, o proximo experimento deve avaliar batching adicional ou cache mais agressivo antes de promover esse caminho

## Integracao de provider mais forte
O runtime agora aceita um modo `external-command` apenas por configuracao explicita:
- `ORION_EMBEDDINGS_PROVIDER=external-command`
- `ORION_EMBEDDINGS_COMMAND=<comando local>`

Contrato esperado do comando:
- entrada via stdin em JSON com `kind`, `text`, `fingerprint` e metadados opcionais do chunk
- saida via stdout em JSON com `model`, `version`, `dimensions` e `vector`

Exemplo de uso:
```powershell
$env:ORION_EMBEDDINGS_PROVIDER = "external-command"
$env:ORION_EMBEDDINGS_COMMAND = "node scripts/local-embedder.js"
pnpm dev -- /retrieve --query "software design layers"
```

Se o comando nao estiver configurado, o provider externo nao ativa ganho vetorial e o retrieval continua caindo para `lexical-only`.

## Script de referencia
O repositorio agora inclui um comando local de referencia:
- `pnpm embedder:local`
- `pnpm embedder:ollama`

Ele implementa o contrato stdin/stdout esperado pelo modo `external-command` e serve como base segura para integrar depois um modelo local mais forte sem mudar o restante do app.

## Provider local mais forte via Ollama
O repositorio agora inclui `scripts/ollama-embedder.js`, um bridge `external-command` para o Ollama local.

Configuracao tipica:
- `ORION_EMBEDDINGS_PROVIDER=external-command`
- `ORION_EMBEDDINGS_COMMAND=node scripts/ollama-embedder.js --stdio-server`
- `OLLAMA_EMBED_MODEL=nomic-embed-text`
- `OLLAMA_HOST=http://127.0.0.1:11434`

Exemplo de benchmark:
```powershell
$env:ORION_BENCHMARK_EMBEDDINGS_COMMAND = 'node scripts/ollama-embedder.js --stdio-server'
$env:ORION_BENCHMARK_EMBEDDINGS_LABEL = 'ollama-nomic-persistent'
$env:OLLAMA_EMBED_MODEL = 'nomic-embed-text'
$env:ORION_BENCHMARK_SIZES = 'small,medium'
pnpm benchmark:embeddings
```

Observacao:
- se o Ollama local nao estiver disponivel ou nao devolver vetor valido, o bridge devolve vetor vazio e o runtime continua podendo cair para `lexical-only`
