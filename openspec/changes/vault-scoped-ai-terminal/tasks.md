# Tasks

## Spec
- [x] Atualizar `ai-cli-bridge` para tornar o vault o diretório padrão da IA no desktop
- [x] Atualizar `desktop-shell` para separar fluxo de notas e fluxo de manutenção do app
- [x] Atualizar `command-hub` para refletir o novo ponto de entrada curto da IA
- [x] Atualizar as specs para tratar comandos da IA como skills e recursos explícitos do app
- [x] Adicionar spec para catálogo local de skills e flows da IA

## Product
- [x] Definir o comando curto ou launcher exposto dentro da sessão do vault
- [x] Definir a cópia de onboarding da IA sem dependência da raiz do app
- [x] Definir como o fluxo de manutenção do app ficará separado do fluxo normal da IA
- [x] Definir a taxonomia inicial de skills de contexto, planejamento e execução segura
- [x] Definir a estrutura conceitual de catálogo para skills e flows recomendados

## Next Step
- [x] Definir o primeiro conjunto de skills compostas orientadas à intenção da task
- [x] Separar formalmente skills de notas e skills de manutenção do app no catálogo e nos flows
- [x] Especificar como skills compostas reutilizam as primitivas atuais sem criar uma segunda CLI concorrente
- [x] Decidir se a primeira exposição dessas composições será só no catálogo ou também em novos comandos dedicados
- [x] Formalizar o roteamento de intenção/escopo para distinguir produto, vault ativo e código do app em perguntas ambíguas sobre "o app"

Status da primeira leva:
- `analyze-note`, `prepare-edit-task`, `prepare-writing-task`, `maintenance-diagnose` e `organize-batch` já existem como comandos dedicados

## Estado real atual
- [x] `Modo dev` abre uma sessão PowerShell com helper `orion`
- [x] A sessão define `ORION_VAULT_ROOT` e nasce no vault ativo por padrão
- [x] O onboarding inicial usa `orion /onboarding`
- [x] O catálogo local de skills e flows já existe e alimenta CLI, docs geradas e endpoints web
- [x] `analyze-note` existe como comando dedicado e possui testes de integração
- [x] `prepare-edit-task` existe como comando dedicado e possui teste de integração da CLI
- [x] `prepare-writing-task` existe como comando dedicado e possui testes de integração
- [x] `maintenance-diagnose` existe como comando dedicado e possui testes de integração
- [x] `organize-batch` já existe como comando dedicado e possui teste de integração da CLI
- [x] O launcher do terminal desktop foi validado end-to-end no fluxo completo do Electron; a sessão abriu no vault ativo, exibiu onboarding completo, policy lines e helper `orion`, sem cair na raiz do app
- [x] O fluxo agora expõe `orion /route-intent --query "..."` para classificar explicitamente produto, vault ativo, código do app e casos ambíguos antes da resposta
- [x] O card principal do `Modo dev` passou a destacar `orion /route-intent` e os comandos compostos orientados à intenção (`analyze-note`, `prepare-edit-task`, `prepare-writing-task`, `organize-batch`) em vez de um resumo genérico mais antigo focado em `/context`, `/plan` e `/preview`
- [x] A build instalada disponibiliza script PowerShell, CLI compilada, `zod` e OpenSpec fora de `app.asar` para o runtime do `Modo dev`
- [x] O instalador Windows foi validado com `orion /onboarding` e inicialização PowerShell após instalação temporária

## Public MVP Readiness
- [ ] Validar o fluxo completo do usuário comum para escrita, agenda, dashboards e graph
- [ ] Validar o fluxo completo do usuário dev para pesquisa, criação e edição assistidas por IA
- [ ] Classificar explicitamente o que é estável, beta e experimental na versão pública inicial
- [ ] Executar o runbook `docs/runbooks/public-mvp-release-execution.md`
- [ ] Decidir `Go / No-Go` para divulgação pública do MVP

## Quality
- [ ] Revisar coerência com a constitution e com a fronteira do vault
- [ ] Revisar impacto no bootstrap do desktop e na descoberta de comandos
- [ ] Revisar se onboarding, guia e catálogo de comandos refletem corretamente a linguagem de skills
- [ ] Revisar se o catálogo proposto evita duplicação de vocabulário e mantém os comandos atuais como fonte operacional
- [ ] Revisar se perguntas ambíguas sobre o produto deixam de ser respondidas como leitura cega do vault atual

## Notes
- Nesta change, `analyze-note`, `prepare-edit-task`, `prepare-writing-task`, `maintenance-diagnose` e `organize-batch` já subiram para comandos reais.
- Nesta primeira versão, `organize-batch` funciona como entrada dedicada para preview em lote do vault ativo e continua dependendo de `apply` para qualquer mutação.
- Runbook operacional de validação manual do modo dev: `docs/runbooks/dev-mode-desktop-validation.md`
- A spec base de `desktop-app` foi alinhada com esta change para refletir o comportamento já consolidado: o terminal do `Modo dev` nasce no vault ativo, não na raiz do app.
- Validação manual confirmada: launcher visual coerente com o posicionamento do produto, terminal aberto no vault ativo `C:\Users\as409\MarikaVault`, onboarding completo carregado e sem erro residual de `openspec/registry.md`.
- O gap principal de intenção/escopo foi coberto com `orion /route-intent`; a próxima validação deve confirmar se esse passo fica suficientemente visível para usuários dev no fluxo manual do desktop.
- A visibilidade de `route-intent` no launcher melhorou: o fluxo recomendado do card principal do `Modo dev` agora começa por `orion /start`, traz `orion /route-intent --query "o que voce quer descobrir?"` logo na sequência e prioriza comandos compostos orientados à task.
- O runtime instalado do `Modo dev` não pode usar `tsx` ou scripts dentro de `app.asar`; o launcher deve usar a CLI compilada e recursos desempacotados em `app.asar.unpacked`.
