# Orion Vault Stable User Test Readiness Checklist

## Objetivo
Transformar o estado atual do Orion Vault em uma versao suficientemente estavel para teste com usuario real, com foco em fechamento de gaps de produto, validacao manual e disciplina de release.

## Status recomendado hoje
- Core tecnico: pronto o bastante para continuar
- Retrieval semantico: pronto o bastante para teste
- Modo dev: beta
- Batch AI organization: experimental
- Release estavel para publico amplo: ainda nao
- Teste fechado com usuario: viavel apos fechar os bloqueadores abaixo

## Regra de uso
- execute os blocos na ordem
- nao mover um item para concluido sem evidencia pratica
- quando um item exigir validacao manual, registrar resultado e bug encontrado
- se um bloco falhar, nao avance para release; volte ao gap concreto

## Bloco 1: Fechar escopo da rodada

### Objetivo
Definir exatamente o que entra no primeiro teste com usuario e o que fica explicitamente fora.

### Checklist
- [ ] confirmar que o objetivo da rodada e `teste fechado com usuario`, nao release publica ampla
- [ ] confirmar que `Manual Mode` entra como superficie principal
- [ ] confirmar que `Dev Mode` entra rotulado como beta
- [ ] confirmar que `organize-batch` continua rotulado como experimental
- [ ] confirmar se `graph` entra no teste ou se fica limitado por risco conhecido
- [ ] remover da narrativa qualquer promessa de automacao autonoma ponta a ponta
- [ ] escrever uma frase curta e verdadeira descrevendo a build de teste

### Criterio de saida
- existe uma definicao fechada do que sera testado
- a equipe consegue explicar a rodada sem contradicao

## Bloco 2: Corrigir bloqueadores de entrada no produto

### Objetivo
Garantir que o usuario consegue entrar no produto sem ajuda do repositorio.

### Checklist
- [ ] implementar ou fechar o fallback quando o vault padrao estiver ausente
- [ ] definir e validar a pagina de setup/fallback do vault
- [ ] validar visualmente a raiz selecionada antes de abrir o workspace
- [ ] garantir que a UI nunca pareca `ready` antes do vault ativo terminar de abrir
- [ ] cobrir mensagens controladas para erro de configuracao e fronteira
- [ ] revisar se a abertura do app permite criar ou abrir vault sem ajuda externa

### Referencias
- `openspec/changes/desktop-app/tasks.md`
- `openspec/changes/vault-interface/tasks.md`
- `docs/runbooks/public-mvp-release-checklist.md`

### Criterio de saida
- um usuario consegue abrir ou criar um vault sem orientacao do time

## Bloco 3: Fechar fluxo do usuario comum

### Objetivo
Garantir que a experiencia manual funciona bem sem depender da IA.

### Checklist
- [ ] criar pasta manualmente
- [ ] criar nota apenas pelo titulo
- [ ] editar nota sem friccao grave
- [ ] renomear nota
- [ ] mover nota
- [ ] validar estados vazios compreensiveis
- [ ] validar responsividade minima em janela reduzida
- [ ] validar que nao ha perda de conteudo em fluxos normais
- [ ] validar branding consistente como `Orion Vault`

### Agenda, dashboard e graph
- [ ] criar nota de agenda
- [ ] validar que nota futura nao gera notificacao incoerente
- [ ] navegar overview/dashboard sem bug grave
- [ ] abrir graph sem crash
- [ ] decidir se eventuais problemas de legibilidade do graph bloqueiam ou apenas limitam o teste

### Criterio de saida
- um usuario comum consegue usar o produto do inicio ao fim sem precisar entender o modo dev

## Bloco 4: Fechar fluxo do usuario dev

### Objetivo
Garantir que o modo dev entrega valor real e previsivel no desktop.

### Checklist
- [ ] abrir `Modo dev` pelo launcher desktop
- [ ] confirmar que o terminal nasce no vault ativo
- [ ] confirmar que `ORION_VAULT_ROOT` corresponde ao vault ativo
- [ ] rodar `orion /start`
- [ ] rodar `orion /skills`
- [ ] rodar `orion /flows`
- [ ] rodar `orion /search`
- [ ] rodar `orion /retrieve`
- [ ] rodar `orion /agent-context`
- [ ] rodar `orion /analyze-note`
- [ ] rodar `orion /prepare-edit-task`
- [ ] rodar `orion /prepare-writing-task`
- [ ] rodar `orion /maintenance-diagnose`
- [ ] criar ou editar nota usando apenas comandos do produto
- [ ] confirmar que o onboarding empurra skills antes de filesystem direto
- [ ] confirmar que manutencao do app aparece separada do fluxo normal de notas

### Referencias
- `docs/runbooks/dev-mode-desktop-validation.md`
- `openspec/changes/vault-scoped-ai-terminal/tasks.md`

### Criterio de saida
- um usuario dev consegue pesquisar, criar e editar notas sem improvisar fora dos contratos do produto

## Bloco 5: Fechar pendencias de interface mais visiveis

### Objetivo
Reduzir os pontos que passam sensacao de prototipo em vez de produto testavel.

### Checklist
- [ ] revisar se a navegacao desktop nao parece um navegador bruto
- [ ] revisar modais e encaixe visual do desktop
- [ ] decidir se o hub visual de comandos precisa entrar antes da rodada
- [ ] decidir se a busca global local precisa entrar antes da rodada
- [ ] atualizar o README do desktop para refletir o estado real da implementacao
- [ ] revisar `ai-start-here.md` e `comandos.md` contra o catalogo atual de skills

### Criterio de saida
- a superficie principal esta apresentavel o bastante para feedback de usuario, nao apenas validacao interna

## Bloco 6: Fechar higiene tecnica de release

### Objetivo
Evitar falsa sensacao de estabilidade com pipeline frouxo.

### Checklist
- [ ] rodar `pnpm docs:sync-ai`
- [ ] rodar `pnpm typecheck`
- [ ] rodar `pnpm test`
- [ ] rodar `pnpm build`
- [ ] revisar o discovery do Vitest para nao executar testes dentro de artefatos de `release/` e `release-test/`
- [ ] revisar branding residual e nomes antigos na base ativa
- [ ] registrar bugs encontrados nessa rodada com severidade: bloqueador, importante ou pos-teste

### Observacao
- hoje `typecheck`, `test` e `build` ja passam localmente, mas a configuracao de testes ainda merece endurecimento antes de uma rotina de release mais seria

### Criterio de saida
- a build de teste e repetivel e nao depende de sorte local

## Bloco 7: Classificar riscos aceitos

### Objetivo
Separar claramente o que bloqueia o teste do que pode entrar como risco conhecido.

### Bloqueadores candidatos
- [ ] abertura/criacao de vault falha ou confunde usuario
- [ ] escrita manual perde conteudo ou falha em fluxos normais
- [ ] agenda gera comportamento incoerente grave
- [ ] `Modo dev` abre fora do vault ativo
- [ ] onboarding do modo dev induz uso de filesystem direto em vez dos comandos do produto
- [ ] graph ou dashboard causam crash da janela

### Riscos que podem entrar como conhecidos, se controlados
- [ ] graph ainda com legibilidade limitada em vaults maiores
- [ ] `organize-batch` mantido como experimental
- [ ] embeddings continuam opcionais e sem promocao automatica

### Criterio de saida
- existe uma decisao consciente do que bloqueia o teste e do que entra como limitacao conhecida

## Bloco 8: Go para teste fechado

### Perguntas finais
- [ ] o usuario comum consegue usar a experiencia principal sem depender da IA?
- [ ] o usuario dev consegue usar o modo dev sem explorar o repositorio?
- [ ] os bugs abertos restantes estao classificados e comunicados?
- [ ] a build esta apresentavel o bastante para feedback real?
- [ ] a mensagem da rodada esta curta, verdadeira e sem promessas exageradas?

### Decisao
- [ ] Go para teste fechado com usuario
- [ ] No-Go

## Ordem pratica recomendada
1. Bloco 2: entrada no produto
2. Bloco 3: fluxo do usuario comum
3. Bloco 4: fluxo do usuario dev
4. Bloco 5: acabamento visivel
5. Bloco 6: higiene tecnica
6. Bloco 7: classificacao de risco
7. Bloco 8: decisao final

## Definicao de pronto desta rodada
Esta rodada termina quando:
- a abertura do produto estiver confiavel
- os fluxos comum e dev estiverem validados manualmente
- os riscos restantes estiverem explicitamente classificados
- a equipe puder dizer `Go para teste fechado` sem depender de suposicao

## Proximo passo explicito
- o proximo passo recomendado desta checklist e sair de implementacao incremental e entrar em validacao manual guiada
- a ordem sugerida agora e:
1. rodar `manual-common-user-validation.md`
2. rodar `dev-mode-desktop-validation.md`
3. classificar bugs em `bloqueador`, `importante` e `pos-teste`
4. voltar para implementacao apenas se a validacao revelar gaps reais

## Sugestao da IA
- minha sugestao atual e nao expandir mais escopo antes da rodada manual
- a base tecnica ja parece madura o bastante para aprender mais com uso real do que com novas mudancas preventivas
- portanto, a melhor alocacao da proxima rodada e validar, consolidar achados e corrigir so o que vier com severidade alta
