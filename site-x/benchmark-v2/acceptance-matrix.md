# Site X Benchmark v2 Acceptance Matrix

Regra de evidência: UI visual não aceita persistência, auth, RBAC, API real, sincronização ou mutação server-side. Estado local/memória, mock de API e documentação não são evidência de implementação.

## Phase 5 — API/server layer

`npm run test:api` passa com servidor Next, Auth.js Email/Mailpit, sessão JWT, RBAC, repositories e PostgreSQL reais. A evidência cobre CRUD API, validação, autorização, isolamento e idempotência de evidência, incluindo DELETE com remoção cascata de `EvidenceRequest`. Nenhum requisito recebe aceite final nesta fase: UI, E2E e critérios ainda pendentes permanecem fora deste teste. Ver `api-phase.md`.

## Phase 6 — frontend integration

`npm run test:frontend` passa com servidor Next construído, Auth.js/Mailpit, PostgreSQL e handlers HTTP reais. O teste protege rota `/w/*`, autentica por magic link, cria/edita/arquiva projeto, lista participantes, cria sessão com e sem participante, cria/edita/remove evidência, cria tema e prova 403 cross-workspace. Páginas de projetos, detalhe, sessões, evidências, temas e dashboard não importam `demo-data.ts`; após cada mutação recarregam estado autorizado do backend. Ver `frontend-phase.md` e `participant-selection.md`.

## Phase 7 — accessibility

`@playwright/test` e `@axe-core/playwright` estão configurados em `tests/accessibility/a11y.spec.ts` para Chromium desktop e mobile, ambos com `channel: "chrome"`, servidor Next, PostgreSQL, Auth.js e Mailpit locais. Em 2026-09-13, Google Chrome foi detectado em `C:\Program Files\Google\Chrome\Application\chrome.exe` e Playwright listou seis casos, mas `npm run test:a11y` parou no Prisma `P1001` para PostgreSQL `127.0.0.1:54329` antes de abrir Chrome ou executar testes. Portanto não há resultado Axe, teste de teclado ou leitor de tela válido; `NFR-A11Y-001` continua `PARTIAL` e sem aceite. Ver `accessibility-phase.md`.

## Evidência Phase 3 — authentication

| Requisito | Evidência real registrada | Limite atual |
|---|---|---|
| REQ-AUTH-001 | Auth.js Email Provider envia magic link por Nodemailer ao Mailpit local; `VerificationToken` persiste no PostgreSQL; link de uso único e 15 min cria JWT HttpOnly/SameSite=Lax de 30 dias. `npm run test:auth` usa servidor Next/Auth.js, PostgreSQL e Mailpit reais para token válido, inválido, expirado, reutilizado, sessão, rota protegida, logout e rate limit. | Ambiente exclusivamente local; rate limit está em memória de processo. Provider, segredo, SMTP, domínio e política para produção continuam UNKNOWN. |

## Evidência Phase 4 — authorization / RBAC

| Requisito | Evidência real registrada | Limite atual |
|---|---|---|
| REQ-WORK-001 | `Membership` é resolvido server-side por `(workspaceId, userId)` e aplica OWNER/ADMIN/RESEARCHER/VIEWER para operações protegidas. | Convites persistidos, aceite e expiração de 7 dias não implementados. |
| REQ-PROJECT-001 | Repository requer membership e papel: VIEWER lê, RESEARCHER cria/edita, ADMIN/OWNER arquivam; `workspaceId` do recurso é sempre incluído na query. | CRUD/API completo, paginação, Zod e frontend seguem pendentes. |
| REQ-SESSION-001 | Leitura de sessões exige membership e escopo `Project.workspaceId`; ID de projeto de outro workspace falha. | Mutation de sessão e validações de domínio permanecem Phase 5. |
| REQ-EVID-001 | Criação/leitura de evidência exige membership e cadeia `Session -> Project -> workspaceId`; sessão de B enviada por A falha. | CRUD completo, limites API, idempotência e frontend pendentes. |
| REQ-THEME-001 | Update/criação de tema exige RESEARCHER+ e `Theme.project.workspaceId`; tema de B não é alterável por A. | Relação ThemeEvidence via serviço/API e UI seguem pendentes. |

## Evidência Phase 2 — persistence

| Requisito | Evidência real registrada | Limite atual |
|---|---|---|
| REQ-WORK-001 | `Workspace`, `User` e `Membership` migrados e testados no PostgreSQL; chave composta impede membership duplicada. | Convites, auth e RBAC não implementados. |
| REQ-PROJECT-001 | `Project` persiste, atualiza e filtra por `workspaceId` em teste real. | Nenhuma UI/API/RBAC foi conectada. |
| REQ-SESSION-001 | `Session` e relações com `Project`/`Participant` persistem no seed e testes. | Sem mutation service/API ou validação de negócio. |
| REQ-EVID-001 | `Evidence` persiste; banco rejeita texto fora de 1..5000 e mais de 10 tags. | Sem edição/exclusão via produto, autorização ou idempotência. |
| REQ-THEME-001 | `ThemeEvidence` persistido; trigger PostgreSQL rejeita evidência de outro projeto. | Sem builder/UI/API. |
| REQ-DASH-001 | Dados constituintes persistem em relações reais. | Agregação de dashboard e definição de tarefas de síntese continuam UNKNOWN. |

Estes registros não alteram aceite final dos requisitos: autenticação, autorização, APIs e integração frontend continuam pendentes.

| ID | Aceite quando | Rejeitado quando | Evidência necessária | Teste automático esperado | Teste manual necessário |
|---|---|---|---|---|---|
| REQ-AUTH-001 | IMPLEMENTADO PARA BENCHMARK LOCAL: magic link único/15 min cria JWT de 30 dias. | Token reutilizável/expirado funciona, token vaza, cookie inseguro ou só UI. | `VerificationToken` PostgreSQL, Mailpit e cookie real evidenciados por `npm run test:auth`. | `tests/integration/auth.test.mjs`: Mailpit, token, sessão, expiração, reutilização, inválido, logout, acesso e rate limit. | Login, erro, reenvio e foco permanecem pendentes de validação manual. |
| REQ-WORK-001 | PARCIAL: membership server-side protege recursos; convite autorizado persiste, expira em 7 dias e cria membership só para email convidado. | Convite local, link aceita outro email ou duplica membership. | Membership PostgreSQL e `npm run test:rbac`; convite/email ainda ausentes. | Integração convite/aceite/expiração/RBAC; E2E. | Fluxo de convite e mensagem recebida. |
| REQ-PROJECT-001 | PARCIAL: UI lista/cria/edita/arquiva por API real; estado final vem do backend e arquivado é read-only. | Mutação cliente, cross-workspace, Viewer muta ou arquivado aceita edição. | `test:api` + `test:frontend` atravessam HTTP/Auth.js/RBAC/PostgreSQL; páginas possuem loading/error/empty. | E2E navegador ainda pendente. | Filtros e acessibilidade. |
| REQ-SESSION-001 | PARCIAL: UI lista participantes do projeto e cria sessão por API autorizada, com ou sem participante; backend valida projeto e participante quando fornecido. | Dados somem ao recarregar, valores inválidos aceitos ou vínculo externo. | `test:api` + `test:frontend` com HTTP/Auth.js/RBAC/PostgreSQL; ver `participant-selection.md`. | E2E navegador ainda pendente. | Acessibilidade/UX do seletor ainda requer validação manual. |
| REQ-EVID-001 | PARCIAL: UI lê/cria/edita/exclui evidência por API e gera `Idempotency-Key`; recarrega backend após mutação. | Estado memória, duplicata no retry, tags/limites inválidos ou cross-workspace. | `test:api` + `test:frontend` cobrem persistência, idempotência, DELETE e isolamento reais. | E2E navegador ainda pendente. | Retry/foco manual. |
| REQ-THEME-001 | PARCIAL: UI lista/cria tema com IDs de evidência selecionados; servidor aplica escopo same-project. | N:N somente visual ou evidência de outro projeto aceita. | `test:api` + `test:frontend` cobrem handler, PostgreSQL e rejeição cross-project. | E2E tema-fonte ainda pendente. | Seleção e responsividade manual. |
| REQ-DASH-001 | PARCIAL: dashboard usa projetos/sessões autorizados reais; tarefas de síntese exibe `UNKNOWN`. | Cards fixos, dados de outro workspace ou agregação inventada. | Página busca API real; `test:frontend` prova sessão e isolamento. | Integração de todas métricas/E2E pendente. | Empty/error/retry e navegação. |
| NFR-A11Y-001 | Fluxos P0 atendem WCAG 2.2 AA documentado. | Falha crítica Axe, teclado/foco quebrado, rótulo ausente ou leitor não anuncia. | Relatórios Axe e execução NVDA/Chrome + VoiceOver/Safari. | Axe, Testing Library para nome/foco/estados. | Leitor de tela e teclado nos quatro fluxos. |
| NFR-PERF-001 | Metas e budgets documentados passam em produção/CI. | Métrica excede meta, sem RUM p75 ou apenas medição local. | Lighthouse CI, budgets e RUM/web-vitals produção. | Lighthouse CI e budget checks. | Revisão de dashboard em perfil 4G. |
| REQ-SEARCH-001 | Quatro campos autorizados pesquisáveis; URL, debounce, cancelamento e teclado funcionam. | Só filtro cliente/projetos, resultados externos ou URL não reproduz estado. | Índice/consulta real; contrato endpoint ainda UNKNOWN. | Integração escopo; E2E URL/teclado. | Relevância e estado vazio. |
| REQ-NOTIF-001 | Notificação de convite/sessão elegível ocorre dentro de 24 h. | Apenas botão/Toast, sem registro/entrega, duplicata ou atraso. | Registro Notification e trilha de entrega; canal é UNKNOWN. | Integração tempo/controlador/deduplicação. | E2E somente após canal definido. |
| REQ-EXPORT-001 | Workspace Pro autorizado recebe CSV de evidências autorizadas. | Plano Free exporta, CSV inclui dados externos ou botão sem exportação. | Consulta autorizada, arquivo CSV e checagem plano. | Integração Pro/escopo/formato; E2E download após contrato. | Abrir CSV e conferir experiência download. |
