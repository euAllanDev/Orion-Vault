<!-- GENERATED FILE: run `pnpm docs:sync-ai` -->
<!-- Source of truth: application/ai/skills/skill-registry.ts and skill-catalog.ts -->

# Comandos da Aplicacao

Este guia e gerado a partir do catalogo interno de skills e flows do Orion Vault.

## Como a IA deve comecar
- rode `orion /start` para a orientacao inicial
- rode `orion /skills` para ver o catalogo de capabilities
- rode `orion /flows` para ver sequencias recomendadas
- priorize contexto e planejamento antes de execucao
- trate o Orion Vault como um app de notas orientado a IA e agentes, nao como um terminal generico
- quando o pedido mencionar o app, diferencie produto, vault ativo e codigo-fonte antes de responder
- use as skills e comandos do Orion Vault como caminho principal
- considere notas, agenda, relacoes, busca e organizacao como superficies principais do produto
- nao crie, edite, mova ou renomeie arquivos diretamente se existir comando equivalente do produto
- para pesquisar, use orion /search, /retrieve, /agent-context ou /analyze-note
- para editar uma nota existente com mais seguranca, comece por orion /prepare-edit-task
- para preparar escrita, use orion /prepare-writing-task antes de mutar o vault
- para organizar varias notas com preview-first, use orion /organize-batch antes de apply
- para criar ou editar notas manualmente, use orion mkdir, touch, edit, rename e move
- use orion /apply somente com previewId validado

## Exemplos por intencao
- Classificar escopo da pergunta: `orion /route-intent --query "o que voce acha desse app?"`
- Entender o produto: `orion /product-context`
- Entender uma nota: `orion /analyze-note --path Estudos/Clean Architecture.md`
- Preparar edicao: `orion /prepare-edit-task --path Estudos/SDD.md --query "revisar resumo"`
- Pesquisar um tema: `orion /search --query "clean architecture"`
- Montar contexto para resposta: `orion /agent-context --query "sdd" --path Estudos`
- Preparar escrita: `orion /prepare-writing-task --path Estudos/SDD.md --query "resumo"`
- Organizar em lote: `orion /organize-batch --path Inbox --query "projeto"`
- Criar pasta: `orion mkdir --path Financeiro`
- Criar nota: `orion touch --path Financeiro/gastos.md --content "# Gastos"`
- Editar nota: `orion edit --path Financeiro/gastos.md --stdin`

## Contexto

Skills para onboarding, leitura, busca e montagem de contexto.

### start
- descricao: Abre a orientacao inicial da IA para o fluxo do produto.
- tipo: primitive
- quando usar: Use no inicio da sessao para lembrar a estrategia principal.
- inputs: (none)
- output: Markdown curto com orientacao operacional.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion /start

### guide
- descricao: Abre o guia completo de comandos e fluxo recomendado.
- tipo: primitive
- quando usar: Use quando precisar rever os contratos disponiveis.
- inputs: (none)
- output: Markdown com catalogo e exemplos de uso.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion /guide

### product-context
- descricao: Explica o que e o Orion Vault, distingue produto, vault e codigo do app, e orienta perguntas sobre o app.
- tipo: primitive
- quando usar: Use quando a pergunta mencionar o app, o produto, a ferramenta ou quando houver ambiguidade entre vault e codigo-fonte.
- inputs: (none)
- output: Resumo estruturado do produto, superficies principais, fronteiras da sessao e proximo passo recomendado.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion /product-context

### route-intent
- descricao: Classifica se a pergunta parece ser sobre produto, vault ativo, codigo do app ou se ainda esta ambigua.
- tipo: primitive
- quando usar: Use quando a pergunta mencionar o app ou quando quiser decidir explicitamente entre contexto de produto, notas do vault e manutencao do codigo.
- inputs: query
- output: Classificacao de intencao, motivo curto, proximo comando recomendado e necessidade de esclarecimento.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion /route-intent --query "o que voce acha desse app?"

### context
- descricao: Carrega contexto estruturado do vault ou de uma nota foco.
- tipo: primitive
- quando usar: Use antes de responder, editar ou planejar algo no vault.
- inputs: path?
- output: Resumo do vault, nota foco, backlinks, related notes e chunks de apoio.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion /context | orion /context --path Architecture/clean.md

### search
- descricao: Busca notas por consulta, frase, tag e escopo.
- tipo: primitive
- quando usar: Use para ampliar contexto antes de decidir a proxima acao.
- inputs: query?, phrase?, tags?, path?
- output: Lista de matches e chunks relevantes.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion /search --query "arquitetura local" | orion /search --tag architecture --path Architecture

### retrieve
- descricao: Recupera um pacote enxuto de chunks relevantes para a task.
- tipo: primitive
- quando usar: Use quando quiser reduzir leitura e custo de contexto.
- inputs: query?, tags?, path?
- output: Chunks ranqueados com score, reasons e snippet.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion /retrieve --query "clean architecture" --path Architecture

### agent-context
- descricao: Monta um pacote pronto para task com foco, chunks e relacionadas.
- tipo: primitive
- quando usar: Use antes de uma task orientada a conhecimento ou execucao por agente.
- inputs: query?, tags?, path?
- output: Resumo curto, nota foco, supporting chunks, related notes e budget.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion /agent-context --query "clean architecture" --path Architecture

### related
- descricao: Lista notas relacionadas a uma nota foco.
- tipo: primitive
- quando usar: Use para navegar relacoes antes de decidir o recorte da task.
- inputs: path, limit?
- output: Lista de notas relacionadas com score.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion /related --path alpha.md --limit 5

### analyze-note
- descricao: Compõe leitura de contexto para entender rapidamente uma nota ou escopo.
- tipo: composed
- quando usar: Use quando precisar montar compreensão rápida antes de responder ou decidir próximos passos.
- inputs: path?, query?
- output: Foco principal, resumo curto, supporting chunks, related notes e limites do contexto.
- muta vault: nao
- exige preview: nao
- dependencies: context, related, agent-context
- termina em: read
- exemplos: orion /analyze-note --path alpha.md

## Planejamento

Skills para preview, plano e inspecao da intencao antes de mutacao.

### prepare-writing-task
- descricao: Prepara contexto e próximo passo antes de escrita assistida ou resposta longa.
- tipo: composed
- quando usar: Use quando a task exige reunir contexto, lacunas e possíveis riscos antes de escrever.
- inputs: path?, query?, tags?
- output: Foco da escrita, chunks principais, lacunas de contexto e próximo passo recomendado.
- muta vault: nao
- exige preview: nao
- dependencies: context, agent-context, search, retrieve, preview
- termina em: preview
- exemplos: orion /prepare-writing-task --path alpha.md --query "draft summary"

### prepare-edit-task
- descricao: Prepara contexto, riscos e próximos alvos antes de editar uma nota existente.
- tipo: composed
- quando usar: Use quando quiser revisar, expandir ou corrigir uma nota com mais contexto antes de editar.
- inputs: path?, query?, tags?
- output: Foco da edição, supporting chunks, related notes, riscos e próximo passo recomendado.
- muta vault: nao
- exige preview: nao
- dependencies: context, agent-context, retrieve, related
- termina em: read
- exemplos: orion /prepare-edit-task --path alpha.md --query "review summary"

### plan
- descricao: Gera um plano estruturado de organizacao sem mutar o vault.
- tipo: primitive
- quando usar: Use para revisar a intencao da IA antes de qualquer escrita.
- inputs: (none)
- output: Preview estruturado com actions e previewId.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: preview
- exemplos: orion /plan

### preview
- descricao: Alias operacional de preview do plano atual sem mutacao.
- tipo: primitive
- quando usar: Use como passo final de validacao antes do apply.
- inputs: (none)
- output: Preview estruturado com actions e previewId.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: preview
- exemplos: orion /preview

### diff
- descricao: Mostra diferencas relevantes do fluxo de organizacao.
- tipo: primitive
- quando usar: Use quando precisar inspecionar a mudanca planejada ou recente.
- inputs: (none)
- output: Saida textual de diferencas.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: preview
- exemplos: orion diff

## Execucao Segura

Recursos de escrita e execucao validada dentro do vault.

### organize-batch
- descricao: Encapsula o fluxo preview-first para organizar o vault ativo em lote com confirmação válida.
- tipo: composed
- quando usar: Use quando quiser gerar um preview de organização em lote antes de aplicar o plano no vault ativo.
- inputs: path?, query?
- output: Preview estruturado com ações sugeridas, previewId, escopo opcional, query opcional e próximo passo para apply.
- muta vault: sim
- exige preview: sim
- dependencies: context, search, plan, preview, apply
- termina em: mutation
- exemplos: orion /organize-batch

### apply
- descricao: Executa somente um preview validado ou payload forcado.
- tipo: primitive
- quando usar: Use apenas depois de revisar o previewId.
- inputs: previewId?, force?
- output: Actions executadas, puladas, conflitos e previewId.
- muta vault: sim
- exige preview: sim
- dependencies: (none)
- termina em: mutation
- exemplos: orion /apply --preview-id <id>

### mkdir
- descricao: Cria uma pasta dentro do vault ativo.
- tipo: primitive
- quando usar: Use para escrita direta e objetiva no workspace.
- inputs: path
- output: Confirmacao textual da pasta criada.
- muta vault: sim
- exige preview: nao
- dependencies: (none)
- termina em: mutation
- exemplos: orion mkdir --path Projetos

### touch
- descricao: Cria uma nota Markdown dentro do vault ativo.
- tipo: primitive
- quando usar: Use para criar notas novas com conteudo controlado.
- inputs: path, content? | content-file? | stdin?
- output: Confirmacao textual do arquivo criado.
- muta vault: sim
- exige preview: nao
- dependencies: (none)
- termina em: mutation
- exemplos: orion touch --path Projetos/minha-nota.md --content "# Minha nota"

### edit
- descricao: Substitui o conteudo de uma nota existente dentro do vault.
- tipo: primitive
- quando usar: Use para escrita direta quando a tarefa nao depende de preview.
- inputs: path, content? | content-file? | stdin?
- output: Confirmacao textual do arquivo editado.
- muta vault: sim
- exige preview: nao
- dependencies: (none)
- termina em: mutation
- exemplos: orion edit --path Projetos/minha-nota.md --stdin

### rename
- descricao: Renomeia arquivo ou pasta dentro do vault.
- tipo: primitive
- quando usar: Use para ajustes de nome mantendo a fronteira do vault.
- inputs: source, destination
- output: Confirmacao textual da operacao.
- muta vault: sim
- exige preview: nao
- dependencies: (none)
- termina em: mutation
- exemplos: orion rename --source Projetos/a.md --destination Projetos/b.md

### move
- descricao: Move arquivo ou pasta entre caminhos validos do vault.
- tipo: primitive
- quando usar: Use para reorganizacao manual e objetiva.
- inputs: source, destination
- output: Confirmacao textual da operacao.
- muta vault: sim
- exige preview: nao
- dependencies: (none)
- termina em: mutation
- exemplos: orion move --source Projetos/a.md --destination Arquivo/a.md

## Manutencao

Capacidades tecnicas e de diagnostico, separadas do fluxo normal de notas.

### maintenance-diagnose
- descricao: Compõe um pacote de leitura técnica para diagnosticar app e vault sem contaminar o fluxo normal de notas.
- tipo: composed
- quando usar: Use quando precisar investigar issues técnicas, fronteira do vault ou estado estrutural.
- inputs: (none)
- output: Resumo técnico, issues encontradas e ações de manutenção sugeridas.
- muta vault: nao
- exige preview: nao
- dependencies: inspect, validate, scan, doctor
- termina em: read
- exemplos: orion /maintenance-diagnose

### inspect
- descricao: Inspeciona o estado estrutural do vault.
- tipo: primitive
- quando usar: Use para diagnostico manual do workspace.
- inputs: (none)
- output: Resumo estrutural textual.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion inspect

### validate
- descricao: Valida a raiz e a fronteira operacional do vault.
- tipo: primitive
- quando usar: Use antes de operacoes sensiveis ou diagnostico de ambiente.
- inputs: (none)
- output: Resultado textual de validacao.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion validate

### scan
- descricao: Escaneia o vault e consolida informacoes estruturais.
- tipo: primitive
- quando usar: Use para inventario local e verificacao de estado.
- inputs: (none)
- output: Saida textual de scan.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion scan

### doctor
- descricao: Roda um diagnostico local de saude do ambiente.
- tipo: primitive
- quando usar: Use quando o comportamento do app ou do vault parecer inconsistente.
- inputs: (none)
- output: Relatorio textual de diagnostico.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion doctor

### sync
- descricao: Executa fluxo tecnico de sincronizacao do registry.
- tipo: primitive
- quando usar: Use em manutencao interna do app.
- inputs: (none)
- output: Confirmacao textual de sincronizacao.
- muta vault: nao
- exige preview: nao
- dependencies: (none)
- termina em: read
- exemplos: orion sync

## Flows Recomendados

### default-note-workflow
- descricao: Fluxo padrao para operar sobre notas com contexto, planejamento e execucao segura.
- steps: start -> guide -> context -> search | retrieve | agent-context -> plan | preview -> apply
- notas: Priorize leitura antes de mutacao. | Use apply somente com previewId validado.

### knowledge-task-workflow
- descricao: Fluxo enxuto para tasks orientadas a conhecimento ou resposta de agente.
- steps: start -> agent-template -> agent-context -> related
- notas: Use quando a tarefa pede resposta ou analise com menos ruido. | Evite carregar o vault inteiro sem necessidade.

### direct-write-workflow
- descricao: Fluxo para escrita manual objetiva dentro do vault ativo.
- steps: context -> mkdir | touch | edit | rename | move
- notas: Prefira content-file ou stdin para textos longos. | Mantenha caminhos dentro do vault ativo.

### analyze-note-workflow
- descricao: Fluxo composto para entendimento rápido de nota ou escopo.
- steps: analyze-note -> context -> related -> agent-context
- notas: Termina em leitura. | Use antes de escrever, responder ou planejar.

### prepare-writing-task-workflow
- descricao: Fluxo composto para preparar escrita assistida ou resposta longa.
- steps: prepare-writing-task -> context | agent-context -> search | retrieve -> preview?
- notas: Use preview apenas quando a task realmente envolver mutação. | Explicita lacunas antes de escrever.

### prepare-edit-task-workflow
- descricao: Fluxo composto para preparar edição segura de nota existente.
- steps: prepare-edit-task -> context | agent-context -> retrieve | related -> edit
- notas: Termina em leitura orientada para edição. | Ajuda a decidir se já vale editar ou se ainda falta contexto.

### organize-batch-workflow
- descricao: Fluxo composto para organização em lote com preview-first.
- steps: organize-batch -> context -> plan | preview -> apply
- notas: Exige confirmação válida antes de mutação. | Preserva o fluxo preview-first.

### maintenance-diagnose-workflow
- descricao: Fluxo composto separado para diagnóstico técnico de app e vault.
- steps: maintenance-diagnose -> inspect -> validate -> scan -> doctor
- notas: Aparece separado do fluxo normal de notas. | Termina em leitura técnica.

## Respostas estruturadas
- `success`: comando executado com sucesso
- `conflict`: o plano ou a escrita exigem revisao ou confirmacao
- `noop`: nao havia mudancas validas para executar
- `error`: houve falha de validacao ou execucao
