# Semantic Retrieval Manual Demo

## Objetivo
Visualizar manualmente o ganho recente de retrieval semantico e reranking em um caso conceitual dentro da interface do Orion Vault.

## Notas de demo
O repositorio agora inclui um pequeno conjunto em:
- `vault/Demo Semantic Retrieval/product/discovery-loop.md`
- `vault/Demo Semantic Retrieval/learning/practice-routine.md`
- `vault/Demo Semantic Retrieval/operations/incident-playbook.md`
- `vault/Demo Semantic Retrieval/operations/recovery-language.md`

## Caso principal
Query conceitual:
- `customer learning assumption testing`

Resultado esperado:
- a nota principal deve ser `Demo Semantic Retrieval/product/discovery-loop.md`
- a nota `learning/practice-routine.md` nao deve aparecer acima dela

## Caso secundario
Query conceitual:
- `support diagnosis during outage`

Resultado esperado:
- a nota principal deve ser `Demo Semantic Retrieval/operations/incident-playbook.md`
- a nota `operations/recovery-language.md` pode aparecer como apoio, mas nao acima da playbook

## Validacao sugerida no desktop ou web local
1. Abra o vault que aponta para a pasta `vault/` deste repositorio ou importe essas notas para o seu vault ativo.
2. Navegue ate `Demo Semantic Retrieval/` na arvore para confirmar que as quatro notas estao visiveis.
3. Use a busca global da interface com `customer learning assumption testing`.
4. Confirme que `product/discovery-loop.md` aparece antes de `learning/practice-routine.md`.
5. Repita com `support diagnosis during outage`.
6. Confirme que `operations/incident-playbook.md` aparece antes de `operations/recovery-language.md`.

## Validacao sugerida no Modo dev
Se quiser visualizar os sinais de retrieval com mais detalhe dentro do app:

```powershell
orion /retrieve --path "Demo Semantic Retrieval" --query "customer learning assumption testing" --debug
orion /retrieve --path "Demo Semantic Retrieval" --query "support diagnosis during outage" --debug
```

Sinais esperados no debug:
- `rerank reasons` contendo `concept alias: product-discovery` no primeiro caso
- `rerank reasons` contendo `concept alias: operations-incident` no segundo caso

## Criterio de saida
- o resultado principal da query conceitual aponta para a nota canonica esperada
- a nota distratora continua aparecendo apenas como apoio ou abaixo da nota correta
- o debug mostra razoes de reranking interpretaveis
