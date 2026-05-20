# Design

## Visão geral
O app desktop é um shell instalável em TypeScript com estética dark, tátil e local-first. A interface envolve a base atual e concentra a experiência em uma janela nativa com profundidade visual, cartões em camadas e acesso rápido aos fluxos principais.

## Estratégia arquitetural
- `domain`: regras e invariantes do vault
- `application`: casos de uso e orquestração
- `infra`: filesystem, config, IA e implementação local
- `interfaces/desktop` e `interfaces/web`: janela, navegação, apresentação e eventos de UI

## Superfície do app
- tela de setup/home com criação/abertura do vault como fallback
- workspace com árvore, editor central e painel auxiliar
- busca global local
- graph view local
- painel de comandos agrupados por intenção
- entrada fixa de `Modo dev` na sidebar e onboarding da IA local
- cards de métricas, novidades e estado do vault

Na experiência desktop, o workspace deve ser a primeira superfície visível quando o vault ativo já existir; `Home` fica como resumo/fallback e entrada de recuperação.

## Linguagem visual
- superfícies e painéis principais usam o tom base `#131316`
- a cor dos painéis deve permanecer consistente entre workspace, editor e telas auxiliares
- contrastes e acentos continuam vindo da paleta existente, sem alterar a hierarquia visual
- a sidebar principal pode recolher para um modo de ícones apenas, reduzindo ruído visual sem perder navegação
- o editor central deve adotar leitura minimalista, com fundo contínuo e sem um cartão interno competindo com a área de escrita
- a Home/Overview em desktop deve caber com densidade confortável dentro de uma janela 16:9 comum, evitando vazios laterais e inferiores exagerados

## Princípios do shell desktop
- local-first por padrão
- sem internet obrigatória para uso principal
- sem expor caminho completo de forma agressiva na interface
- hierarquia visual clara, profunda e focada em leitura
- comandos, árvore, busca e grafo devem ser operáveis por mouse e teclado
- a IA local deve permanecer opcional e acionável sem quebrar o fluxo principal
- o acesso à IA no desktop deve nascer da própria shell, em um ponto fixo e previsível da sidebar

## Persistência
- notas e pastas permanecem no filesystem do usuário
- configurações do app ficam localmente
- o shell não deve depender de um banco para o MVP

## Bootstrap do vault padrão
- o desktop deve tratar `config.vaultRoot` como raiz autoritativa do shell
- o frontend não deve assumir que o vault já está pronto apenas por receber uma query string ou montar a tela
- o bootstrap automático precisa passar pelo mesmo contrato local de abertura (`bootstrap` + `setup/open`) usado depois pela interface
- a árvore do workspace só deve ser considerada pronta depois que o backend devolver a raiz validada e o refresh real do vault terminar
- enquanto esse bootstrap estiver em andamento, botões de criação e outras escritas precisam permanecer bloqueados ou aguardar a conclusão

## Estado visual e sincronização
- o estado visual inicial do workspace deve preferir `loading` controlado a um vazio enganoso
- a raiz ativa mostrada pela UI precisa ser sincronizada com a raiz devolvida pelo backend após cada refresh do workspace
- criar uma pasta vazia deve atualizar a árvore no refresh seguinte, sem depender de abrir outra tela
- a lista local de atividade e outros estados auxiliares não devem sugerir outro vault nem reidratar caminhos que não existam na árvore atual

## Diálogos internos
- os diálogos internos de input precisam operar com apenas uma sessão ativa por vez
- abrir um novo diálogo deve invalidar callbacks pendentes do anterior
- essa regra evita ações cruzadas, como confirmar uma criação de pasta e disparar também uma criação de nota pendente

## Alternativas consideradas
### Manter apenas web
Adiado. Útil como protótipo, mas menos adequado como produto final instalável.

### Migrar para Java
Adiado. Possível, mas aumenta custo de reescrita sem necessidade imediata.

### App desktop com backend remoto
Rejeitado. Contraria o objetivo local-first.
