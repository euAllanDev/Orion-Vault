# Site X Benchmark v2 Security Phase

## Scope and threat model

Phase 8 evaluates local benchmark attack paths against real Next.js HTTP handlers, Auth.js Email/Mailpit, JWT, PostgreSQL and Prisma. Attacker models: unauthenticated caller, member of another workspace, lower-privilege member, malicious browser origin, malformed API client and user-controlled stored text. No destructive database attacks, Auth.js bypass, production access or Performance work occurred.

## Formal requirements

Formal security-relevant acceptance criteria remain those already declared in `benchmark-v2/manifest.md`; no new formal requirement ID was invented.

| Requirement | Verified security property | Evidence |
|---|---|---|
| REQ-AUTH-001 | Magic links are 15-minute, single-use tokens; JWT session is 30 days; tokens do not appear in JSON/log output; rate limit tested. | `test:auth`, `test:security` |
| REQ-WORK-001 | Membership and role resolve server-side. | `test:rbac`, `test:api`, `test:security` |
| REQ-PROJECT-001 | Queries/mutations use authorized workspace scope; role and archived state enforced. | `test:rbac`, `test:api`, `test:security` |
| REQ-SESSION-001 | Project/participant and workspace chain is server-authorized. | `test:api`, `test:security` |
| REQ-EVID-001 | Session chain, limits, idempotency and mutation scope enforced. | `test:api`, `test:security` |
| REQ-THEME-001 | Project scope and same-project evidence relation enforced. | `test:api`, `test:security` |

## Auxiliary controls

- `HttpOnly`, `SameSite=Lax`, path `/` JWT cookie. `Secure=false` is correct only for local HTTP.
- JWT carries `authVersion`; Auth.js `signOut` increments persisted user version; custom JWT decode rejects copied pre-logout cookies.
- API mutations require exact `Origin` match to local `AUTH_URL`/`NEXTAUTH_URL`.
- Strict Zod schemas reject unknown authority fields and malformed values before repository operations.
- Prisma/repositories derive workspace from resource relations and include workspace predicates in authorization queries.
- CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `X-Frame-Options` are set in `next.config.ts`.
- React renders controlled project/evidence/theme/participant text as text; no user-controlled `dangerouslySetInnerHTML` exists.
- PostgreSQL FKs, membership compound key, Evidence constraints, ThemeEvidence cross-project trigger and idempotency FK cascade remain database controls.

## Attacks and evidence

| Area | Attack | Result |
|---|---|---|
| Authentication | No cookie, altered JWT cookie, expired/reused/invalid magic link | PASS: `401` or generic verification failure. |
| Session | Copied JWT reused after Auth.js logout | FIXED/PASS: version invalidation returns `401`. |
| Enumeration | Existing versus missing `@benchmark.test` email | FIXED/PASS: missing address sends no Mailpit email and receives generic verify redirect, not `error=AccessDenied`. |
| Authorization/IDOR | Project, session, evidence and theme resources from workspace B accessed by workspace A | PASS: generic `403`, no resource body; B archive/update denied. |
| Client authority | Fake `workspaceId`, role, owner, membership and timestamps | PASS: strict Zod returns `422`; server derives authority. |
| Validation | Empty/null/wrong type/invalid JSON, oversized text/tags, excessive fields and invalid UUID coverage | PASS: `422` public envelope, no server error. |
| XSS/SQL input | Script/HTML/attribute/`javascript:` and SQL-like project values | PASS: values persist as literal text; Prisma query remains parameterized; CSP and React text rendering prevent execution. |
| CSRF | Authenticated cross-site mutation with `Origin: https://attacker.example` | PASS: `403`; project state unchanged. Auth.js CSRF protects magic-link and logout forms. |
| Data leakage | Cross-workspace IDs, absent resources, error responses | PASS: same generic `403`; no stack traces, SQL errors, secrets, `AUTH_SECRET` or `DATABASE_URL` in HTTP evidence. |
| Rate limit | Six magic-link requests in one 15-minute local process | PASS: five emails only. Simple process restart remains a documented local limitation. |
| Headers | CSP/frame restrictions/nosniff/referrer/permissions | PASS locally. HSTS intentionally absent on HTTP. |

## Findings and corrections

| Severity | Finding | Correction | Regression evidence |
|---|---|---|---|
| Medium | Copied JWT remained valid after logout because JWT session was stateless. | Persisted `User.authVersion`, JWT decode validation and Auth.js sign-out version increment. Logout revokes all sessions for that user. | `test:security` copied-cookie assertion. |
| Low | Magic-link request exposed Auth.js `error=AccessDenied` for missing benchmark identity. | Auth route normalizes only that external redirect to generic verify-request while retaining no-email policy. | `test:security` missing-address assertion. |
| Hardening | No response security headers. | Added CSP, frame, MIME, referrer and permissions headers. | `test:security` header assertions. |
| Critical dependency advisory | `next@15.5.9` had critical audit findings. | Updated to `next@15.5.25`; critical Next finding no longer reported. | `npm audit --omit=dev --audit-level=high`. |

## Dependencies

After Next update, `npm audit --omit=dev --audit-level=high` reports 9 high and 1 moderate transitive findings. Remaining paths include Prisma config (`deepmerge-ts`/`effect`), `nodemailer` through `next-auth`, and `postcss`/`sharp` through Next. No safe non-breaking automatic remediation is available for all findings; `npm audit fix --force` proposes incompatible Prisma/Next changes. This is an open dependency-risk finding, not behavioral proof of exploitability in local Site X.

## Production unknowns and local limits

- TLS deployment, HSTS, production `Secure` cookie flag, trusted origin/domain and reverse-proxy behavior are UNKNOWN. HSTS cannot be validated on `http://127.0.0.1`.
- SMTP provider, `AUTH_SECRET` rotation/storage, production email sender/domain and secret injection are UNKNOWN.
- Rate limit is per-process in memory; distributed/edge rate limiting, shared keying and abuse monitoring are UNKNOWN.
- CSP currently retains `'unsafe-inline'` for Next runtime compatibility. Nonce/hash CSP is recommended deployment hardening, not formal requirement.
- No WAF, DDoS protection, centralized logs, alerting, audit retention, backup/restore, database roles/network policy or external penetration test is locally verifiable.
- Browser cross-site policy was verified with explicit malicious Origin HTTP request. Full deployed browser/CORS/proxy behavior remains UNKNOWN.

## SourceRefs

- `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp`
- `orion:src_ZcFT0ORTgioDSRQQyb3edyyd`
- `orion:src_SBUZu8yFlqZK56yWyLKlmkkT`
- `orion:src_7B03GeZIKvPw1cwdowTJTvGG`
- `benchmark-v2/manifest.md`, `benchmark-v2/auth-phase.md`, `benchmark-v2/rbac-phase.md`, `benchmark-v2/api-phase.md`, `benchmark-v2/database-phase.md`

## Commands

All completed after corrections on 2026-09-13: `db:migrate`, `db:seed`, `test:integration` (4), `test:auth` (9), `test:rbac` (7), `test:api` (9), `test:frontend` (1), `test:a11y` (5 passed, 1 intentional mobile-only skip, 16 Axe scans zero violations), `test:security` (1), `lint`, `build`, `git diff --check`.
