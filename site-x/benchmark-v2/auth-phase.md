# Site X Benchmark v2 Authentication Phase

## Scope and evidence

Phase 3 implements REQ-AUTH-001 for local benchmark infrastructure only.

- Source requirement: `REQ-AUTH-001` from `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp`, `orion:src_ZcFT0ORTgioDSRQQyb3edyyd`, and `orion:src_SBUZu8yFlqZK56yWyLKlmkkT`.
- Dependent future requirements: REQ-WORK-001, REQ-PROJECT-001, REQ-SESSION-001, REQ-EVID-001, REQ-THEME-001 and REQ-DASH-001 require identity/session but remain unimplemented for authorization or business access.
- `npm run test:auth` passed against Docker PostgreSQL, Docker Mailpit and a real Next/Auth.js server.

## Architecture

- Auth.js implementation: NextAuth.js v4 `EmailProvider`, configured in `src/lib/auth.ts`.
- Delivery: Nodemailer connects only to local Mailpit SMTP at `MAILPIT_SMTP_HOST:MAILPIT_SMTP_PORT`.
- Callback route: `src/app/api/auth/[...nextauth]/route.ts`.
- Session: Auth.js JWT strategy, `maxAge` 30 days. JWT session cookie is `HttpOnly`, `SameSite=Lax`, path `/`, and `Secure=false` only because this benchmark is HTTP on `127.0.0.1`.
- Server validation: `getServerSession(authOptions)` protects `GET /api/benchmark/authenticated`; `/w/*` is protected by Auth.js middleware.
- Login form invokes `signIn("email")`, which posts to Auth.js server endpoint. It does not create client-side sessions.

## Tables and migration

Migration: `prisma/migrations/20260911215401_add_auth_magic_link/migration.sql`.

| Model/table | Purpose |
|---|---|
| `User` | Existing synthetic identity; adds nullable `emailVerified`; `image` remains mapped to pre-existing `imageUrl` column. |
| `VerificationToken` | Auth.js identifier, hashed token and expiration. Auth.js consumes token atomically, preventing reuse. |

No Auth.js session table exists because session strategy is JWT. Existing domain `Session` model remains research-session data, not authentication state.

## Flow

1. Synthetic seeded user submits `@benchmark.test` address on `/login`.
2. Auth.js checks that address belongs to an existing synthetic user and applies local rate limit.
3. Auth.js persists verification token, expiring in 15 minutes, then Nodemailer delivers magic link to Mailpit.
4. Auth.js validates and consumes callback token. Invalid, expired, or consumed tokens redirect to generic verification failure.
5. Valid link sets 30-day JWT cookie. Server route recognizes session; logout clears cookie.

## Benchmark decisions

These are benchmark decisions, not original product requirements.

- Use Auth.js Email Provider with Nodemailer and Mailpit; no external SMTP/provider.
- Permit only existing deterministic `@benchmark.test` seed identities. No person or new production-style identity is created.
- Use JWT rather than database sessions for required 30-day session. `VerificationToken` remains PostgreSQL-backed.
- Set rate limit to five link requests per email per 15 minutes. Requirement mandates rate-limit testing but does not define threshold.
- Use `127.0.0.1` URLs and an ignored local `AUTH_SECRET`; no production domain, credential, or secret is committed.

## Automated tests

`tests/integration/auth.test.mjs` starts built Next server on local port 3010 and exercises real Auth.js endpoints, PostgreSQL and Mailpit:

- unauthenticated protected access returns 401;
- magic-link request stores token and Mailpit receives email;
- valid email callback creates JWT session and authenticated server access;
- invalid, expired and reused tokens fail;
- session JSON does not contain magic-link token;
- logout removes authenticated access;
- sixth request in rate-limit window sends no mail.

## Limitations and unknowns

- Manual login/error/retry/focus accessibility validation remains pending.
- In-memory rate limiting is valid for one local benchmark process only; distributed storage/edge policy is UNKNOWN.
- Production SMTP provider, sender/domain, Auth.js secret management, TLS/HSTS, host/deploy and credential policy remain UNKNOWN.
- RBAC, workspace authorization, invitations, business APIs, frontend data integration, notifications, search and CSV are intentionally out of scope.
