# Site X Benchmark v2 Plan

| Fase | Pré-requisitos | Artefatos esperados | Testes | Critério de saída |
|---|---|---|---|---|
| Phase 0 — requirement manifest | Documentação Orion recuperada. | Cinco artifacts v2, contagem mecânica e source map. | Validação IDs/sourceRefs/aceite/teste. | 12 requisitos formais rastreáveis; lacunas marcadas. |
| Phase 1 — local infrastructure | Phase 0 aprovada; decisões de ambiente fornecidas. | Estrutura Next, validação env, CI e diretórios documentados. | Typecheck, lint, boot env inválido. | Nenhum segredo no repo; CI inicia. |
| Phase 2 — database/persistence | PostgreSQL/`DATABASE_URL` aprovados. | Prisma schema, migrations, seed sintético e banco teste isolado. | Migração, constraints, isolamento. | Entidades e índices documentados persistem. |
| Phase 3 — auth | Email provider, domínio/remetente e segredo aprovados. | Auth.js magic link/JWT, proteção de sessão e rate limits. | Token/sessão/expiração/E2E login. | REQ-AUTH-001 aceita. |
| Phase 4 — authorization | Phases 2-3. | Membership, `requireWorkspaceRole`, políticas query. | Matriz Owner/Admin/Researcher/Viewer e cross-workspace. | RBAC server-side comprovado. |
| Phase 5 — API/server logic | Phases 2-4. | Serviços domínio, Actions, `/api/v1`, Zod, erros/idempotência. | Integração CRUD, 403/422/409, auditoria. | P0 server-side aceita exceto UI. |
| Phase 6 — frontend integration | Phase 5 por fluxo. | RSC/client, loading/error, URL state e dados reais. | Componentes e E2E fluxos P0. | Nenhum P0 depende de memória/mock. |
| Phase 7 — accessibility | Phase 6 fluxos P0. | Correções semântica, foco, diálogo, feedback. | Axe/Testing Library/NVDA/VoiceOver. | NFR-A11Y-001 aceita. |
| Phase 8 — security | Phases 3-6. | Headers, CSP, CSRF, rate limits, logs/segredos/audit. | Testes negativos, headers, origem e enumeração. | Threat review sem P0 aberto. |
| Phase 9 — automated tests | Phases 1-8. | Suites Vitest, integração, visuais e CI gates. | Typecheck/lint/unit/integration. | Todos gates verdes e requisitos cobertos. |
| Phase 10 — E2E | Ambiente teste e dados sintéticos. | Playwright crítico e fixtures seguras. | Login, workspace/projeto/sessão/evidência/tema, mobile, exclusão. | Fluxos críticos verdes. |
| Phase 11 — performance/SEO | Deploy de medição e marketing final. | Metadata, sitemap, robots, JSON-LD, Lighthouse/RUM. | Lighthouse CI, budgets, RUM p75, crawler. | NFR-PERF-001 e SEO passam. |
| Phase 12 — independent review | Phases 1-11 e evidências disponíveis. | Revisão independente de código, segurança e matriz. | Reexecução seletiva. | Findings classificados; nenhum P0 não tratado. |
| Phase 13 — correction loop | Findings Phase 12. | Correções e evidências novas, sem apagar histórico. | Regressão de cada finding. | Findings bloqueadores fechados ou aceitos explicitamente. |
| Phase 14 — final acceptance | Phases 0-13 completas. | Pacote de evidências, matriz final e decisão. | Reexecução CI/E2E/a11y/perf. | Todos P0 aprovados; P1 com status explícito; unknowns não escondidos. |

## Gates permanentes

- Nunca aceitar requisito server-side por UI visual, mock, estado local ou documentação.
- Não introduzir Postgres/Auth.js, provider, segredo, mock ou implementação nesta fase de manifesto.
- Não avançar fase dependente enquanto unknown crítico não tiver decisão explícita de ambiente.
