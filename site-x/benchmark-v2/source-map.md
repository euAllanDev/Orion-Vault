# Site X Benchmark v2 Source Map

| Requisito | SourceRef | Documento | Seção/trecho relevante |
|---|---|---|---|
| REQ-AUTH-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | Must have: magic link e sessão 30 dias. |
| REQ-AUTH-001 | `orion:src_ZcFT0ORTgioDSRQQyb3edyyd` | `site-x/16-security.md` | Token único, 15 min, uso único, cookie JWT e rate limit. |
| REQ-AUTH-001 | `orion:src_SBUZu8yFlqZK56yWyLKlmkkT` | `site-x/decisions/004-authentication.md` | Decisão Auth.js + magic link + JWT seguro. |
| REQ-WORK-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | Must have: Owner cria workspace e convida por email. |
| REQ-WORK-001 | `orion:src_miuGxu8EakCaYD6gb4C07VV9` | `site-x/12-api.md` | `POST /workspaces/:slug/invitations`, Admin+, 429. |
| REQ-WORK-001 | `orion:src_ZcFT0ORTgioDSRQQyb3edyyd` | `site-x/16-security.md` | Convite expira em 7 dias e aceita email convidado. |
| REQ-PROJECT-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | Must have: Researcher cria, edita, arquiva e lista projetos autorizados. |
| REQ-PROJECT-001 | `orion:src_miuGxu8EakCaYD6gb4C07VV9` | `site-x/12-api.md` | Rotas projects e archive, papéis e 409. |
| REQ-PROJECT-001 | `orion:src_jQCBDwJYageg7ndM8YtOUA1V` | `site-x/01-product.md` | Projeto único por workspace; arquivado somente leitura. |
| REQ-SESSION-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | Must have: participante, data, método, status e guia. |
| REQ-SESSION-001 | `orion:src_z4ZETeH_D58mpmgxZrur5QZs` | `site-x/11-data-model.md` | Entidade Session e enums. |
| REQ-SESSION-001 | `orion:src_miuGxu8EakCaYD6gb4C07VV9` | `site-x/12-api.md` | `GET,POST /projects/:id/sessions`. |
| REQ-EVID-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | Must have: registrar, editar e apagar evidência. |
| REQ-EVID-001 | `orion:src_miuGxu8EakCaYD6gb4C07VV9` | `site-x/12-api.md` | Contratos evidence, limites, 422 e `Idempotency-Key`. |
| REQ-EVID-001 | `orion:src_9ixp6ZkORi5yKl4uL6MInPIg` | `site-x/09-interactions.md` | Retry não duplica e feedback de falha. |
| REQ-THEME-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | Must have: agrupar evidências e escrever síntese. |
| REQ-THEME-001 | `orion:src_z4ZETeH_D58mpmgxZrur5QZs` | `site-x/11-data-model.md` | Theme/ThemeEvidence N:N no mesmo projeto. |
| REQ-THEME-001 | `orion:src_miuGxu8EakCaYD6gb4C07VV9` | `site-x/12-api.md` | `GET,POST /projects/:id/themes`; 422 cross-project. |
| REQ-DASH-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | Must have: recentes, próximas, contagens e síntese. |
| REQ-DASH-001 | `orion:src_fhkNTw4igOejz1iqsYYPJ4o8` | `site-x/pages/dashboard.md` | Rota, métricas, sessões, atividade e dados API. |
| NFR-A11Y-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | WCAG 2.2 AA em teclado/leitor para P0. |
| NFR-A11Y-001 | `orion:src_FOwYDKt2HBP_Dq-z5aa5ikXd` | `site-x/14-accessibility.md` | Regras de teclado, semântica, foco, contraste, dialog e leitores. |
| NFR-A11Y-001 | `orion:src_eMoP8Mxjn-uhU07VUoDf76_6` | `site-x/17-testing.md` | Axe e cobertura manual NVDA/VoiceOver. |
| NFR-PERF-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | LCP público e dashboard interativo. |
| NFR-PERF-001 | `orion:src_3MA-RgUzdUTcpbfK9C8z08go` | `site-x/15-performance.md` | Metas p75, budgets e medição RUM/Lighthouse. |
| REQ-SEARCH-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | Should have: quatro campos de busca. |
| REQ-SEARCH-001 | `orion:src_9ixp6ZkORi5yKl4uL6MInPIg` | `site-x/09-interactions.md` | Debounce, cancelamento, teclado e URL. |
| REQ-NOTIF-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | Should have: convite e sessão em 24 h. |
| REQ-NOTIF-001 | `orion:src_z4ZETeH_D58mpmgxZrur5QZs` | `site-x/11-data-model.md` | Entidade Notification. |
| REQ-EXPORT-001 | `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp` | `site-x/02-requirements.md` | Should have: CSV para Pro. |
| REQ-EXPORT-001 | `orion:src_jQCBDwJYageg7ndM8YtOUA1V` | `site-x/01-product.md` | Pro permite exportação CSV. |

## Cross-cutting evidence

| Área | SourceRef | Documento | Uso no benchmark |
|---|---|---|---|
| Arquitetura | `orion:src_C4X9kJAvdP4nK89CVB1B6hEK` | `site-x/06-architecture.md` | Fronteiras RSC/client, Actions/API, Prisma/Postgres, sessão e erros. |
| Rotas/UX | `orion:src_mavK67oWPRkIvGjLv36lWu03` | `site-x/07-pages.md` | Acesso por rota, membership no servidor e SEO público. |
| Dados | `orion:src_z4ZETeH_D58mpmgxZrur5QZs` | `site-x/11-data-model.md` | Entidades, relações, índices e privacidade. |
| Segurança/RBAC | `orion:src_ZcFT0ORTgioDSRQQyb3edyyd` | `site-x/16-security.md` | Defesa server-side, headers, CSRF, rate limits, secrets e audit. |
| Testes/CI | `orion:src_eMoP8Mxjn-uhU07VUoDf76_6` | `site-x/17-testing.md` | Pirâmide de testes e gates CI. |
| SEO | `orion:src_DJdAKAVyik-zgOeecrb9qm47` | `site-x/13-seo.md` | Indexação, metadata, sitemap, robots e JSON-LD. |
| Implementação | `orion:src_Qn8zj7SjkL-Sj3531qJntQZo` | `site-x/18-implementation.md` | Ordem documentada e gate final. |
