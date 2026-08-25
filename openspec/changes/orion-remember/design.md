# Design: orion-remember

## Direcao
`orion_remember` e uma operacao semantica, nao CRUD publico. Agent informa conhecimento explicitamente autorizado; Orion escolhe destino interno e operacao limitada.

## Arquitetura
Fluxo futuro:

`Agent -> orion_remember -> Remember use case -> candidate search in write target -> noop/create/append/conflict -> VaultWorkspacePort -> transparent response`

Use case deve reutilizar `NoteSourcePort`, search/retrieval existentes, `VaultWorkspaceService`, `VaultWorkspacePort` e `NodeVaultWorkspace`. Nao deve existir writer de filesystem paralelo.

## Write target
`ORION_WRITE_VAULT_ROOT` deve ser configurado, valido e presente em `ORION_VAULT_ROOTS` efetivos. Read roots continuam disponiveis para leitura; remember procura candidatos e escreve somente no write target. Ausencia do write target deve retornar erro seguro `WRITE_TARGET_NOT_CONFIGURED`; alvo fora dos read roots deve retornar `WRITE_TARGET_NOT_READ_SOURCE`. Nenhuma dessas condicoes permite fallback pela ordem dos roots.

## Decisao de memoria
1. Normalizar `content`, `subject`, `project` e `kind` quando presentes.
2. Construir fingerprint logico da assertiva normalizada.
3. Buscar candidatos somente no write target com sinais lexical/hibrido.
4. Equivalencia exata ou forte, nao contraditoria, retorna `noop`.
5. Nota canonica unica com local seguro para adicao retorna `appended`.
6. Candidatos ambiguos, contradicao, edicao ampla ou mudanca concorrente retornam `conflict`.
7. Sem destino confiavel, criar Markdown sem sobrescrever retorna `created`.

Similarity, embeddings e retrieval apenas localizam candidatos. Nao autorizam append ou equivalencia por si mesmos.

## Append e concorrencia
Append representa adicao delimitada, mesmo se adaptador atual precisar montar arquivo completo para `editMarkdownFile`. Use case deve ler nota base, guardar fingerprint de conteudo, gerar proposta e confirmar que base nao mudou antes da escrita. Se mudou, deve recalcular seguramente ou retornar `conflict`; nunca sobrescrever alteracao externa silenciosamente.

## Formato e provenance
Notas continuam Markdown livre: titulo em primeiro `#`, frontmatter e tags opcionais, diretorios livres. Remember preserva estilo da nota alvo e nao adiciona frontmatter de `kind`, `project` ou provenance automaticamente. MVP retorna `source: user-explicit-agent`, sem persistir provenance.

## Confirmacao
Pedido explicito de salvar basta para create seguro e append inequivoco. Replace amplo, overwrite, remocao, move, rename, contradicao e ambiguidade exigem esclarecimento ou confirmacao nova; tais mutacoes ficam fora do MVP.
