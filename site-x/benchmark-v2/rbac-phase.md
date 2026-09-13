# Site X Benchmark v2 Authorization / RBAC Phase

## Scope and source requirements

Phase 4 implements server-side workspace authorization, not invitation or business API delivery.

- REQ-WORK-001: `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp`, `orion:src_jQCBDwJYageg7ndM8YtOUA1V`, `orion:src_miuGxu8EakCaYD6gb4C07VV9`, `orion:src_ZcFT0ORTgioDSRQQyb3edyyd`.
- REQ-PROJECT-001, REQ-SESSION-001 and REQ-THEME-001: `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp`, `orion:src_z4ZETeH_D58mpmgxZrur5QZs`, `orion:src_miuGxu8EakCaYD6gb4C07VV9`.
- REQ-EVID-001: same sources plus `orion:src_9ixp6ZkORi5yKl4uL6MInPIg`.
- REQ-DASH-001 depends on this isolation but dashboard aggregation remains unimplemented.

## Policy

`src/lib/authorization.ts` resolves current Auth.js JWT session to persisted `User`, then resolves membership by composite `(workspaceId, userId)`. It never accepts a client-supplied role.

| Role | Protected access |
|---|---|
| VIEWER | Read workspace-scoped projects, sessions and evidence. |
| RESEARCHER | VIEWER access plus create/update project, create evidence, create/update theme and future session creation. |
| ADMIN | RESEARCHER access plus archive project. |
| OWNER | ADMIN access. Invitation authority is documented but intentionally deferred. |

Every query receives a server-resolved actor ID and requires workspace membership before database access. Resource access includes both resource ID and workspace relation:

- Project: `id + workspaceId`.
- Session/Evidence: `Session -> Project.workspaceId`.
- Theme: `Theme -> Project.workspaceId`.

Absent resource, absent membership, insufficient role and cross-workspace resource all throw the same `AccessDeniedError` without resource content.

## Protected repositories

- `project-repository.ts`: list/read/create/update/archive; update permits only name/objective, so client input cannot alter workspace, creator or archive state. Archived projects reject writes.
- `research-repository.ts`: session read/create, evidence read/create and theme create/update. Inputs expose only resource fields; parent IDs are server-scoped.
- `api/benchmark/authenticated`: now resolves JWT session through `requireAuthenticatedUser`, proving server identity maps to persisted user before protected work.

## Deterministic fixtures

`prisma/seed.mjs` provides synthetic data only:

- Workspace A: OWNER, ADMIN, RESEARCHER and VIEWER; project, session, evidence and theme.
- Workspace B: distinct OWNER; distinct project, session, evidence and theme.
- One synthetic `@benchmark.test` user without membership.

## Integration tests

`npm run test:rbac` seeds Docker PostgreSQL and runs `tests/integration/rbac.test.ts` through the actual TypeScript repositories. No Prisma or authorization mock is used.

- authorized A and B reads;
- RESEARCHER create/update and authorized evidence write;
- VIEWER write denial; ADMIN archive; archived project write denial;
- no membership, unknown resource and cross-workspace project/session/evidence denial;
- tampered B session/theme IDs supplied with A workspace do not expose or change B;
- B owner writes B while B-to-A update fails.

`npm run test:auth` remains evidence that a real Auth.js JWT session is resolved server-side before protected route access.

## Benchmark decisions

These are benchmark decisions, not new product requirements.

- Role hierarchy is VIEWER < RESEARCHER < ADMIN < OWNER to implement documented Researcher+ and Admin+ rules.
- Authorization denial is intentionally generic for missing and inaccessible resources, preventing content disclosure through differing messages.
- Repositories accept actor IDs because they are server-only integration boundaries; Phase 5 actions/routes must obtain them only through `requireAuthenticatedUser`.

## Limitations and unknowns

- Invitation persistence, email acceptance and seven-day expiration are not implemented.
- No business API, server actions, frontend data integration, pagination, Zod contracts, idempotency or E2E workflow is implemented in this phase.
- `Session.participantId` same-project constraint remains UNKNOWN.
- Dashboard aggregation and synthesis-task formula remain UNKNOWN.
- Production deployment/session secret, distributed rate limiting and audit-log retention remain UNKNOWN.
