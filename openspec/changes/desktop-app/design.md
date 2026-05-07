# Design

## Visão geral
O app desktop é um shell instalável em TypeScript que envolve a base atual e concentra a experiência do usuário em uma janela nativa/local.

## Estratégia arquitetural
- `domain`: regras e invariantes do vault
- `application`: casos de uso e orquestração
- `infra`: filesystem, config, IA e implementação local
- `interfaces/desktop`: janela, navegação, apresentação e eventos de UI

## Superfície do app
- primeira tela: criação/abertura do vault
- segunda tela: workspace com árvore, editor e painel auxiliar
- ações de escrita: criar, editar, renomear e mover dentro da fronteira do vault
- ações de observação: inspect, validate, scan, context, plan e organize

## Princípios do shell desktop
- local-first por padrão
- sem internet obrigatória para uso principal
- sem expor caminho completo de forma agressiva na interface
- hierarquia visual discreta, limpa e focada em leitura
- comandos e árvore devem ser operáveis por mouse e teclado

## Persistência
- notas e pastas permanecem no filesystem do usuário
- configurações do app ficam localmente
- o shell não deve depender de um banco para o MVP

## Alternativas consideradas
### Manter apenas web
Adiado. Útil como protótipo, mas menos adequado como produto final instalável.

### Migrar para Java
Adiado. Possível, mas aumenta custo de reescrita sem necessidade imediata.

### App desktop com backend remoto
Rejeitado. Contraria o objetivo local-first.
