# Site X Benchmark v2 Database / Persistence Phase

## Scope and evidence

Phase 2 implements PostgreSQL persistence only. It does not implement Auth.js, magic links, RBAC, invitations, APIs, frontend data integration, notifications, search, export, or dashboard aggregation.

Source requirements:

- `REQ-WORK-001`: `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp`, `orion:src_jQCBDwJYageg7ndM8YtOUA1V`.
- `REQ-PROJECT-001`, `REQ-SESSION-001`, `REQ-EVID-001`, `REQ-THEME-001`: `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp`, `orion:src_z4ZETeH_D58mpmgxZrur5QZs`, `orion:src_miuGxu8EakCaYD6gb4C07VV9`.
- `REQ-DASH-001`: `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp`, `orion:src_fhkNTw4igOejz1iqsYYPJ4o8`.

## Models and tables

| Model/table | Documented fields and relations implemented | Requirement support |
|---|---|---|
| `User` | UUID, case-insensitive unique email, optional name/image, created time. | Future auth; project creator and membership. |
| `Workspace` | UUID, unique slug, name, FREE/PRO plan, created time. | REQ-WORK-001. |
| `Membership` | Workspace/user compound key, OWNER/ADMIN/RESEARCHER/VIEWER role, joined time. | REQ-WORK-001. |
| `Project` | Workspace, name `varchar(100)`, objective, ACTIVE/ARCHIVED, creator, timestamps. | REQ-PROJECT-001. |
| `Participant` | Project, display name, consent status, JSONB metadata. | REQ-SESSION-001. |
| `Session` | Project, optional participant, scheduled time, method, status, optional guide. | REQ-SESSION-001. |
| `Evidence` | Session, text, kind, optional timestamp, tags, timestamps. | REQ-EVID-001. |
| `Theme` | Project, title, summary, confidence. | REQ-THEME-001. |
| `ThemeEvidence` | Many-to-many link between theme and evidence. | REQ-THEME-001. |

`Notification` is documented but intentionally not modeled in Phase 2 because REQ-NOTIF-001 implementation is explicitly deferred. Auth.js models and invitation storage are also deferred.

## Migration

`prisma/migrations/20260911000000_init_persistence/migration.sql` applied successfully to local Docker PostgreSQL with `prisma migrate deploy`.

Database-enforced integrity:

- `citext` unique User email and unique Workspace slug.
- Membership compound primary key.
- Foreign keys for documented relations.
- Project `(workspaceId, status)` and Session `(projectId, scheduledAt)` indexes.
- Evidence check constraints: text length 1..5000; no more than 10 tags.
- PostgreSQL trigger rejects `ThemeEvidence` links when theme and evidence belong to different projects.

UUID was documented explicitly for User. UUID use for remaining documented `id` fields is an implementation-level INFERRED key strategy; it adds no product behavior.

## Repository boundary

`src/lib/db.ts` owns Prisma client lifecycle. `src/lib/repositories/project-repository.ts` keeps project reads/creates/updates workspace-scoped instead of placing Prisma calls in UI components. No page consumes this repository yet; frontend integration belongs to Phase 6.

## Deterministic fixtures

`prisma/seed.mjs` resets and creates synthetic `Fieldnote Demo` data:

- Owner and Viewer test users under `@benchmark.test`.
- One FREE workspace, one active project, one consented participant, one completed session.
- One observation and one linked theme, `Medo de perder dados`.

Fixture coverage: REQ-WORK-001 membership; REQ-PROJECT-001 project; REQ-SESSION-001 session/participant; REQ-EVID-001 evidence; REQ-THEME-001 source linkage; REQ-DASH-001 constituent data. No real person, credential, external service, or production data is used.

## Integration tests

`tests/integration/persistence.test.mjs` uses real PostgreSQL, never a Prisma mock. `npm run test:integration` seeds before running four tests:

1. Reads deterministic persisted graph.
2. Creates, reads, updates and scopes project query by workspace.
3. Rejects duplicate membership, oversized evidence text and 11 tags.
4. Rejects cross-project ThemeEvidence link through database trigger.

## Unknowns and limitations

- Auth, membership authorization and every RBAC enforcement remain Phase 3/4 work.
- `Session.participantId` cross-project constraint is UNKNOWN: docs do not state it explicitly, so no product rule was invented.
- Dashboard synthesis-task formula, search contract, CSV contract, notification channel/scheduling, production database and deployment remain UNKNOWN.
- Existing client components still consume `demo-data.ts`; this phase does not claim frontend persistence. Phase 6 must replace that presentation data with authorized server reads.
