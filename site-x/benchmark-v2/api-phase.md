# Site X Benchmark v2 API / Server Layer Phase

## Scope

Phase 5 adds a small `/api/v1` Route Handler layer over Auth.js, RBAC repositories and PostgreSQL. Source contract: `orion:src_-SL32p9HVoh0SntVnFgUPrq5`; security: `orion:src_7B03GeZIKvPw1cwdowTJTvGG`.

## Implemented handlers

| Method and route | Input | Output | Auth and authorization | Requirement |
|---|---|---|---|---|
| GET, POST `/workspaces/:slug/projects` | cursor/limit/status; `{name, objective}` | paged projects; `201` project | session, slug-to-workspace, VIEWER/RESEARCHER | REQ-PROJECT-001 |
| GET, PATCH `/projects/:id` | UUID; permitted project fields | project | session, server-resolved project workspace, VIEWER/RESEARCHER | REQ-PROJECT-001 |
| POST `/projects/:id/archive` | UUID | `204`; `409` already archived | ADMIN+ | REQ-PROJECT-001 |
| GET, POST `/projects/:id/sessions` | UUID; documented session fields | sessions; `201` session | VIEWER/RESEARCHER; participant must belong to project | REQ-SESSION-001 |
| GET `/projects/:id/participants` | UUID | `{id, displayName, consentStatus}[]` | Auth.js, VIEWER+, server-resolved project workspace | REQ-SESSION-001 |
| POST `/sessions/:id/evidences` | UUID, `Idempotency-Key`, documented evidence body | `{id, sessionId, createdAt}` | RESEARCHER+ | REQ-EVID-001 |
| PATCH, DELETE `/evidences/:id` | UUID; mutable evidence fields | evidence; `204` | RESEARCHER+ | REQ-EVID-001 |
| GET, POST `/projects/:id/themes` | UUID; `{title, summary, confidence, evidenceIds}` | themes; `201` theme | VIEWER/RESEARCHER; evidence IDs same project | REQ-THEME-001 |

`src/lib/api-schemas.ts` owns strict Zod input schemas. Unknown keys, including client `workspaceId` or `role`, are rejected with `422`.

## Server flow and errors

Handlers perform input validation, Auth.js identity resolution, workspace resolution, repository authorization, PostgreSQL operation, then JSON response. Resource routes derive workspace from server-owned resource relations; client never grants scope or role.

Public errors use `{ error: { code, message, fieldErrors? } }`: `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `422 VALIDATION_ERROR`, `409 CONFLICT`. Missing and cross-workspace resources both return generic `403`, preventing disclosure.

## Persistence decision

Migration `20260912000000_add_evidence_idempotency` adds `EvidenceRequest`, keyed by `(workspaceId, userId, key)`, and links it to created evidence. Repeated keys return same evidence without a duplicate row.

## Benchmark decisions

- Pagination uses documented cursor/limit contract, `limit <= 50`, ordered `createdAt DESC, id DESC`; API response is `{items, nextCursor}`.
- Project, session and evidence routes omit workspace from path because formal API contract does. Server derives it from resource relation before repository authorization.
- Evidence idempotency key is scoped to authenticated user plus workspace, max 128 chars. Reuse returns existing result with `200`.
- Evidence deletion cascades to its `EvidenceRequest` rows. Migration `20260912010000_cascade_evidence_idempotency_delete` corrects the original `ON DELETE RESTRICT` foreign key: an authorized `DELETE /evidences/:id` now returns `204` with no body, removes the idempotency record, and permits a later request with that key to create a new evidence.
- Participant same-project check follows REQ-SESSION-001 acceptance criterion despite prior `unknowns.md` ambiguity.
- Participant listing is intentionally unpaginated and has no filters/search: selection requires only the project's minimal participant fields. Missing and cross-workspace projects both return generic `403`; scope comes from the server-resolved project, never client workspace or role.

## Deferred and unknown

- Dashboard handler deferred: synthesis-task formula remains UNKNOWN.
- Invitation handler deferred: persistent invitation model, email delivery contract and acceptance lifecycle require a separate operation beyond current supported repository contract.
- Search, notifications and CSV remain out of scope/UNKNOWN as required by manifest.
- HTTP harness correction (2026-09-12): `test:api` logs in owner, researcher and viewer. Its former `messages.at(-1)` selection could select an earlier Mailpit message; after owner callback consumed its `VerificationToken`, researcher/viewer followed that consumed link and Auth.js correctly redirected with `error=Verification`. This was not a callback URL, cookie, token format, database, expiration, session, environment, or SMTP transport defect.
- The harness now snapshots Mailpit message IDs before each real `POST /api/auth/signin/email`, polls Mailpit for a new message addressed to that email, extracts its callback URL, follows it with the same cookie jar, and verifies `/api/auth/session`. It does not mock or bypass Auth.js, create a session, or insert a token. `test:auth` had one valid-link callback before later cases intentionally asserted verification failures, so its use of `at(-1)` did not prove repeated-user message selection. Both harnesses require built Next server at `AUTH_URL`/`NEXTAUTH_URL` `http://127.0.0.1:3010`, PostgreSQL, and Mailpit SMTP/UI.
- Evidence DELETE regression (2026-09-12): `prisma.evidence.deleteMany` previously failed with PostgreSQL `P2003` on `EvidenceRequest_evidenceId_fkey`, yielding HTTP `500`. The HTTP integration test now proves authorized deletion, cascaded idempotency-record removal, clean retry with same key (`201`), cross-workspace and insufficient-role denial, missing-resource denial, and absent deleted evidence in PostgreSQL.
