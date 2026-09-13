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
| Public Axe | `/`, `/pricing`, `/login` | BLOCKED | Playwright web server stopped at Prisma `P1001` before Chrome launch. |
| Authenticated Axe | dashboard, projects, project detail, settings, create-project dialog | BLOCKED | Playwright web server stopped at Prisma `P1001` before Chrome launch. |
| Protected route | unauthenticated dashboard redirects to login and does not render dashboard metrics | NOT TESTED in Playwright; historical PASS in `npm run test:auth` and `npm run test:frontend` HTTP integration evidence | Current run stopped at Prisma `P1001` before Chrome launch. |
| Keyboard | Tab, Shift+Tab, Enter, Space, Escape; skip link; dialog focus trap and return focus | BLOCKED | Playwright web server stopped at Prisma `P1001` before Chrome launch. |
| Forms | login, project creation, participant selector, evidence fields, theme tab | BLOCKED | Playwright web server stopped at Prisma `P1001` before Chrome launch. |
| Responsive | desktop and mobile controls/focus | BLOCKED | Playwright web server stopped at Prisma `P1001` before Chrome launch. |
| Async errors | 401, 403, validation, network error feedback | PARTIAL | Existing API/frontend integration covers 401/403/validation HTTP behavior; accessible browser announcement not tested. Network failure remains untested. |

### Axe Results

No Axe browser scan completed. Counts before and after corrections are `UNKNOWN`, not zero. Playwright listed six configured cases but executed zero: its `webServer` stopped before test code, browser launch and Axe attachment generation.

- Violations: `UNKNOWN`.
- Incomplete: `UNKNOWN`.
- Passes: `UNKNOWN`.

On 2026-09-13, `npx playwright test --list` validated six configured desktop/mobile cases using the Chrome channel. `npm run test:a11y` then stopped in `npm run db:migrate` with Prisma `P1001`: PostgreSQL at `127.0.0.1:54329` was unavailable. Docker status confirmed Docker Desktop daemon unavailable. Chrome was detected but was not launched; no result is represented as PASS.

## Corrections Implemented

- Added `AccessibleDialog` for focus initialization, Tab/Shift+Tab containment, Escape closure, pointer backdrop closure and trigger focus return.
- Replaced mobile menu and project-creation dialog behavior with `AccessibleDialog`.
- Added programmatic labels to project edit fields and evidence type, timestamp and tag fields.
- Added Playwright/Axe test plumbing. These changes are implementation corrections; they are not evidence that Axe has passed.
- Added `channel: "chrome"` to both Chromium projects. This is configuration-only correction for installed Google Chrome; no functional accessibility test changed.

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

- Google Chrome is installed and selected with `channel: "chrome"`; Chromium bundle download is no longer required for these projects. Current Playwright/Axe execution is blocked by unavailable PostgreSQL and Docker Desktop before Chrome launch.
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
| `npm run test:integration` | BLOCKED before tests: Prisma seed returned `P1001` for PostgreSQL `127.0.0.1:54329`. |
| `npm run test:auth` | BLOCKED before tests: Prisma migrate returned `P1001` for PostgreSQL `127.0.0.1:54329`. |
| `npm run test:rbac` | BLOCKED before tests: Prisma migrate returned `P1001` for PostgreSQL `127.0.0.1:54329`. |
| `npm run test:api` | BLOCKED before tests: Prisma migrate returned `P1001` for PostgreSQL `127.0.0.1:54329`. |
| `npm run test:frontend` | BLOCKED before tests: Prisma migrate returned `P1001` for PostgreSQL `127.0.0.1:54329`. |
| `npm run test:a11y` | BLOCKED before browser launch: Playwright web server Prisma migrate returned `P1001` for PostgreSQL `127.0.0.1:54329`; Axe counts remain `UNKNOWN`. |
| `npm run lint` | PASS. |
| `npm run build` | PASS. |
| `git diff --check` | PENDING. |
