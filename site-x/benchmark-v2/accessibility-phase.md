# Site X Benchmark v2 Accessibility Phase

## Formal Requirement

`NFR-A11Y-001` requer WCAG 2.2 AA, teclado e leitor de tela nos fluxos P0. Os critérios formais documentados para login, criação de projeto, evidência e exclusão são: teclado, skip link, foco, nomes programáticos, dialog, mensagens e contraste.

Critérios adicionais nesta fase são boas práticas ou cobertura auxiliar; não são requisitos formais novos.

## Environment

- Data and auth: PostgreSQL local, Prisma migration/seed, Next production server, Auth.js magic link and Mailpit.
- Browser automation: Playwright `1.63.0`, `@axe-core/playwright` `4.13.0`, config in `playwright.config.ts`.
- Browser configuration (2026-09-13): Playwright Chromium with `channel: "chrome"` for desktop (`Desktop Chrome`) and mobile (`iPhone 13` viewport). Google Chrome was detected at `C:\Program Files\Google\Chrome\Application\chrome.exe`; channel selection uses this installed Chrome and avoids unavailable Playwright bundled Chromium/headless-shell downloads. No `executablePath` is configured.
- Suite: `tests/accessibility/a11y.spec.ts`; each Axe scan attaches raw `violations`, `incomplete`, and `passes` JSON to Playwright output. `incomplete` is recorded separately and never asserted as a pass.

## Automated Evidence

| Case | Scope | Result | Evidence |
|---|---|---|---|
| Public Axe | `/`, `/pricing`, `/login` | PASS | Zero violations in Chrome desktop and iPhone 13 viewport: six scans. |
| Authenticated Axe | dashboard, projects, project detail, settings, create-project dialog | PASS | Zero violations in Chrome desktop and iPhone 13 viewport: ten scans after real Auth.js/Mailpit login. |
| Protected route | unauthenticated dashboard redirects to login and does not render dashboard metrics | PASS | Browser test redirects to `/login` and confirms dashboard metrics are absent. |
| Keyboard | Tab, Shift+Tab, Enter, Space, Escape; skip link; dialog focus trap and return focus | PASS | Browser suite verifies skip link, create-project dialog focus trap/Escape/return, and mobile menu focus trap/Escape/return. |
| Forms | login, project creation, participant selector, evidence fields, theme tab | PASS | Browser suite completes login, project creation, seeded-project participant selection, session, evidence, theme, edit and deletion. |
| Responsive | desktop and mobile controls/focus | PASS | Desktop Chrome and iPhone 13 projects both pass public and authenticated flows; mobile menu test passes. |
| Async errors | 401, 403, validation, network error feedback | PARTIAL | Existing API/frontend integration covers 401/403/validation HTTP behavior; accessible browser announcement not tested. Network failure remains untested. |

### Axe Results

On 2026-09-13, `npm run infra:up` and `npm run infra:smoke` established PostgreSQL and Mailpit before browser execution. `npm run test:a11y` then ran six configured cases with Chrome: five passed and one desktop execution was intentionally skipped because it is mobile-only.

- Violations: `0` in all 16 relevant Axe scans: public pages (six) plus authenticated routes and create-project dialog (ten).
- Incomplete: recorded separately in Playwright attachments; not treated as a pass.
- Passes: recorded separately in Playwright attachments; no aggregate count is asserted here.

## Corrections Implemented

- Added `AccessibleDialog` for focus initialization, Tab/Shift+Tab containment, Escape closure, pointer backdrop closure and trigger focus return.
- Replaced mobile menu and project-creation dialog behavior with `AccessibleDialog`.
- Added programmatic labels to project edit fields and evidence type, timestamp and tag fields.
- Added Playwright/Axe test plumbing. These changes are implementation corrections; they are not evidence that Axe has passed.
- Added `channel: "chrome"` to both Chromium projects. This is configuration-only correction for installed Google Chrome; no functional accessibility test changed.
- Replaced the central orange `--signal` token with `#ad3f28`. It preserves the warm accent while meeting WCAG AA contrast against canvas, white surfaces, and white button text.
- Corrected async session, evidence and theme form handlers to retain their form element before awaiting a request. React clears `event.currentTarget` after the synchronous handler segment; the old code therefore threw after successful mutations and skipped refresh.
- Corrected browser fixtures: participant selection now uses the seeded project that owns `Participant A`; isolated concurrent logins use distinct seeded member emails and select their own Mailpit message.

## Planned Browser Cases

- Public: home, pricing and login Axe scans; skip-link keyboard activation.
- Authenticated: dashboard, projects, project detail and settings Axe scans after Auth.js/Mailpit magic-link login.
- Interactions: mobile menu; project dialog; project creation; session/participant selector; evidence create/edit/delete; evidence selection; theme creation.
- Dialog assertions: initial focus, Tab/Shift+Tab containment, Escape, close and trigger focus return. Background pointer interaction is intercepted by dialog backdrop; browser verification remains pending.
- Form assertions: accessible labels, native required validation, visible/announced errors and disabled/loading states. Server field-to-input association is not implemented and must be checked during browser execution.
- Responsive assertions: desktop and iPhone 13 viewport; controls and focus remain usable.

## Manual Required

- NVDA with Chrome: login, project creation, evidence creation/deletion; verify headings, landmarks, names, status/error announcements and focus order.
- VoiceOver with Safari: same P0 flows.
- Contrast in rendered states, including focus, disabled, success, error and mobile drawer.
- Native browser edit/delete evidence dialogs: focus, Escape/cancel, confirmation and return focus.
- 401, 403, validation and simulated network-error announcements through assistive technology.

## Unknowns And Limits

- Google Chrome is installed and selected with `channel: "chrome"`; Chromium bundle download is not required for these projects. Local PostgreSQL and Mailpit evidence applies only to this benchmark environment.
- No NVDA/Chrome or VoiceOver/Safari test environment/accounts were supplied. This is documented as an existing benchmark unknown.
- No production browser, deployment or RUM evidence was used.
- NFR-A11Y-001 is not accepted. Formal evidence remains incomplete.

## SourceRefs

- `orion:src_cEv1wLOM3vPhN0pD0PdRVOSY`: Site X requirements, including `NFR-A11Y-001`.
- `orion:src_nmGOv0avzZj16PKC5YyUZa5F`: testing strategy, requiring Playwright flow coverage and Axe on home, login, dashboard and dialog.
- `benchmark-v2/manifest.md`: formal acceptance criteria and required evidence. Declared sourceRefs there could not be recovered by their original IDs in this session; no content was invented from them.

## Commands And Results

| Command | Result |
|---|---|
| `npm run db:migrate` | PASS: no pending migrations. |
| `npm run db:seed` | PASS: deterministic fixtures seeded. |
| `npx playwright test --list` | PASS: configuration parses and lists 6 desktop/mobile cases. |
| `npm run infra:up` | PASS: local PostgreSQL and Mailpit containers healthy. |
| `npm run infra:smoke` | PASS: PostgreSQL connected and Mailpit API healthy. |
| `npm run test:integration` | PASS: 4 persistence tests. |
| `npm run test:auth` | PASS: 9 Auth.js/Mailpit tests. |
| `npm run test:rbac` | PASS: 7 repository/RBAC tests. |
| `npm run test:api` | PASS: 9 HTTP/Auth.js/RBAC/PostgreSQL tests. |
| `npm run test:frontend` | PASS: authenticated frontend integration test. |
| `npm run test:a11y` | PASS: 5 cases passed, 1 desktop mobile-only case skipped; 16 Axe scans have zero violations. |
| `npm run lint` | PASS. |
| `npm run build` | PASS. |
| `git diff --check` | PASS. |
