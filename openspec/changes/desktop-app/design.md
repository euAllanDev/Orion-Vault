# Design

## Visão geral
O app desktop é um shell instalável em TypeScript com estética dark, tátil e local-first. A interface envolve a base atual e concentra a experiência em uma janela nativa com profundidade visual, cartões em camadas e acesso rápido aos fluxos principais.

## Estratégia arquitetural
- `domain`: regras e invariantes do vault
- `application`: casos de uso e orquestração
- `infra`: filesystem, config, IA e implementação local
- `interfaces/desktop` e `interfaces/web`: janela, navegação, apresentação e eventos de UI

## Superfície do app
- tela de setup com criação/abertura do vault
- workspace com árvore, editor central e painel auxiliar
- busca global local
- graph view local
- painel de comandos agrupados por intenção
- launcher e onboarding da IA local
- cards de métricas, novidades e estado do vault

## Princípios do shell desktop
- local-first por padrão
- sem internet obrigatória para uso principal
- sem expor caminho completo de forma agressiva na interface
- hierarquia visual clara, profunda e focada em leitura
- comandos, árvore, busca e grafo devem ser operáveis por mouse e teclado
- a IA local deve permanecer opcional e acionável sem quebrar o fluxo principal

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
