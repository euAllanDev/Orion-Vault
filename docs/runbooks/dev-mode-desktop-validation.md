# Orion Vault Dev Mode Desktop Validation

## Objetivo
Validar manualmente o fluxo end-to-end do `Modo dev` no desktop Electron, garantindo coerencia com as specs de tunelamento, onboarding e command hub.

## Specs de referencia
- `openspec/changes/vault-scoped-ai-terminal/specs/desktop-shell/spec.md`
- `openspec/changes/vault-scoped-ai-terminal/specs/ai-cli-bridge/spec.md`
- `openspec/changes/vault-scoped-ai-terminal/specs/command-hub/spec.md`
- `openspec/changes/vault-scoped-ai-terminal/tasks.md`

## Criterio principal
O fluxo padrao da IA deve nascer no vault ativo, apresentar Orion Vault como app de notas local-first adaptado para IA e agentes, e orientar a sessao por skills do produto antes de qualquer execucao.

## Preparacao
- [ ] garantir que existe um vault ativo valido no desktop
- [ ] abrir o app desktop pelo fluxo normal
- [ ] confirmar que o nome exibido do produto e `Orion Vault`
- [ ] confirmar que o botao `Modo dev` esta visivel

## Bloco 1: Launcher visual

### Objetivo
Verificar se o launcher do `Modo dev` apresenta o contexto correto antes de abrir o terminal.

### Passos
- [ ] clicar em `Modo dev`
- [ ] confirmar que o launcher abre sem quebrar layout
- [ ] confirmar que o launcher mostra o `vault ativo`
- [ ] confirmar que o texto apresenta o Orion Vault como app de notas local-first adaptado para IA e agentes
- [ ] confirmar que o fluxo recomendado comeca por `orion /start`
- [ ] confirmar que o resumo visual tambem destaca `orion /route-intent --query "o que voce quer descobrir?"` logo no inicio
- [ ] confirmar que o foco principal menciona notas, agenda, relacoes, busca e organizacao local
- [ ] confirmar que o catalogo visual nao trata a sessao como terminal generico
- [ ] confirmar que o card principal prioriza comandos compostos orientados a task, como `analyze-note`, `prepare-edit-task`, `prepare-writing-task` e `organize-batch`

### Critério de saída
- o launcher deixa claro o contexto do vault e a natureza do produto antes da abertura do terminal

### Evidencias da rodada
- terminal observado com:

```text
Orion Vault AI ready.
Orion Vault e um app de notas local-first adaptado para IA e agentes.
Vault ativo: C:\Users\as409\MarikaVault
Helper: orion

Resumo rapido:
- orion /start
- orion /guide
- orion /skills
- orion /context
- orion /preview
- orion /apply --preview-id <id>
PS C:\Users\as409\MarikaVault>
```

- leitura desta rodada:
  - o vault ativo apareceu no terminal
  - a mensagem inicial do terminal apresentou Orion Vault como app de notas local-first adaptado para IA e agentes
  - o resumo rapido comecou por `orion /start`
  - ainda e necessario validar visualmente, no launcher antes da abertura do terminal, se essa mesma linguagem aparece de forma clara

## Bloco 2: Catalogo e skills

### Objetivo
Verificar se o command hub reflete a separacao correta entre fluxo normal de notas e manutencao.

### Passos
- [ ] abrir `Ver comandos` no launcher
- [ ] confirmar a secao `O que e este produto`
- [ ] confirmar que os atalhos principais aparecem antes de execucao agressiva
- [ ] confirmar que as skills aparecem agrupadas por contexto, planejamento e execucao segura
- [ ] confirmar que manutencao do app aparece separada do fluxo normal de notas
- [ ] confirmar que o vocabulario do catalogo reforca o vault como contexto principal

### Critério de saída
- o command hub orienta a IA a partir do vault e reduz ambiguidade de intencao

## Bloco 3: Terminal real

### Objetivo
Validar o tunelamento real do terminal desktop.

### Passos
- [ ] clicar em `Abrir terminal da IA`
- [ ] confirmar que o terminal abre sem cair na raiz do app
- [ ] confirmar visualmente que o diretório inicial e o vault ativo
- [ ] rodar `Get-Location` no Windows ou `pwd` no Linux
- [ ] confirmar que o path retornado e o vault ativo
- [ ] rodar `echo $env:ORION_VAULT_ROOT` no Windows ou `echo "$ORION_VAULT_ROOT"` no Linux
- [ ] confirmar que a variavel aponta para o mesmo vault ativo
- [ ] confirmar que a mensagem inicial diz que Orion Vault e um app de notas local-first adaptado para IA e agentes
- [ ] confirmar que o helper `orion` aparece disponivel

### Critério de saída
- a sessao nasce dentro do vault ativo e preserva o contrato de vault da sessao

## Bloco 4: Onboarding curto

### Objetivo
Garantir que a IA descobre o fluxo do produto sem inspecionar o repositório do app.

### Passos
- [ ] rodar `orion /start`
- [ ] confirmar que a resposta descreve o Orion Vault como app de notas adaptado para IA e agentes
- [ ] confirmar que a resposta prioriza contexto, planejamento e execucao segura
- [ ] rodar `orion /guide`
- [ ] confirmar que o guia reforca uso de skills e comandos do produto
- [ ] rodar `orion /skills`
- [ ] confirmar que o catalogo esta organizado por categorias coerentes
- [ ] rodar `orion /flows`
- [ ] confirmar que o fluxo recomendado nao exige descoberta da raiz do app

### Critério de saída
- a IA encontra o caminho operacional a partir do vault, sem depender de descoberta do repositório

## Bloco 5: Task real de leitura e escrita

### Objetivo
Validar que o fluxo serve a uma task real de notas.

### Passos
- [ ] rodar `orion /search --query "<tema real>"`
- [ ] rodar `orion /analyze-note --path "<nota real>"`
- [ ] rodar `orion /prepare-edit-task --path "<nota real>" --query "<objetivo>"`
- [ ] criar uma pasta de teste com `orion mkdir --path "<pasta>"`
- [ ] criar uma nota de teste com `orion touch --path "<pasta>/<nota>.md" --content "# teste"`
- [ ] editar a nota criada com `orion edit --path "<pasta>/<nota>.md" --content "# teste\n\nconteudo"`
- [ ] confirmar que a task foi completada sem navegar pela raiz do app
- [ ] confirmar que a IA usa os comandos do produto em vez de filesystem direto

### Critério de saída
- o modo dev entrega valor real para leitura, criacao e edicao assistidas dentro do vault

## Bloqueadores
- o terminal abre fora do vault ativo
- `ORION_VAULT_ROOT` nao corresponde ao vault da sessao
- o launcher induz exploracao da raiz do app
- o onboarding nao deixa claro que o produto e um app de notas adaptado para IA e agentes
- manutencao do app aparece misturada ao fluxo normal de notas

## Resultado esperado
Ao final desta validacao, o time deve conseguir responder `sim` para estas perguntas:
- o fluxo padrao da IA nasce no vault ativo?
- a IA entende que esta dentro de um app de notas orientado a IA e agentes?
- o produto apresenta skills antes de execucao?
- o usuario dev consegue pesquisar, criar e editar notas sem improvisar fora dos contratos do Orion Vault?

## Proximo passo apos a validacao
- atualizar `openspec/changes/vault-scoped-ai-terminal/tasks.md` se o launcher end-to-end estiver validado
- registrar bugs encontrados como bloqueadores, importantes ou pos-validacao
- usar o resultado para o bloco de `usuario dev` dos runbooks de MVP publico

## Proximo passo explicito
- depois desta validacao, o projeto deve decidir uma destas trilhas:
1. `Modo dev` esta claro e previsivel o bastante para seguir para teste fechado
2. `Modo dev` ainda precisa de mais uma rodada focada em clareza de launcher, catalogo ou task real

## Sugestao da IA
- minha sugestao e avaliar o `Modo dev` principalmente por descoberta e previsibilidade, nao por quantidade de comandos
- se o usuario dev entende rapidamente `start`, `route-intent`, `skills`, `flows` e consegue concluir uma task real no vault ativo, isso vale mais do que adicionar novas surfaces agora
