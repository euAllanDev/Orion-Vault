# Site X Benchmark v2 Frontend Integration Phase

## Evidence

- `REQ-AUTH-001`: `/w/*` remains Auth.js middleware protected. Workspace layout resolves JWT user and persisted membership server-side before client UI renders.
- `REQ-PROJECT-001`: project list, create dialog, detail read, edit and archive call `/api/v1/workspaces/:slug/projects`, `/api/v1/projects/:id`, and `/api/v1/projects/:id/archive`. Archive makes UI read-only after backend response.
- `REQ-SESSION-001`: project detail loads participants through `/api/v1/projects/:id/participants` and presents an optional native select when creating a session. Empty selection omits `participantId`; a selected value is submitted to the existing session API validation.
- `REQ-EVID-001`: project detail loads evidence through `GET /api/v1/sessions/:id/evidences`, creates with a generated `Idempotency-Key`, then patches/deletes through `/api/v1/evidences/:id` and reloads persisted state.
- `REQ-THEME-001`: themes load/create through `/api/v1/projects/:id/themes`; selected evidence IDs are submitted to server same-project validation.
- `REQ-DASH-001`: dashboard reads authorized project/session data from real API. Active-project and session counts are direct entity counts. Synthesis-task metric is explicitly `UNKNOWN`; no formula was inferred.

## UI behavior

- Async views expose loading, error and empty states. Mutations await server result then reload authoritative data; no fake optimistic persistence.
- API envelopes map 401 to expired-session guidance, 403 to generic authorization denial, and validation errors to server field messages. Missing/inaccessible IDs retain server generic 403 behavior.
- Workspace slug, membership role, workspace label and current user identity are resolved server-side. Client URL/input cannot assign scope or role.
- `demo-data.ts` has no functional imports. It remains unused fixture/reference only.

## Tests

- `npm run test:frontend` starts built Next server, authenticates through Auth.js/Mailpit, checks protected workspace page, lists participants, creates sessions with and without `participantId`, and exercises real project/evidence/theme HTTP persistence plus cross-workspace 403. It also verifies selector loading/error code paths and optional payload construction in `ProjectWorkspace`.
- Existing `test:api`, `test:auth`, `test:rbac`, and persistence tests remain required validation.

## Limits and unknowns

- Dashboard synthesis-task formula remains `UNKNOWN`.
- Participant CRUD, participant search, filters and pagination remain out of scope. The server remains authority for all participant/project checks.
- Invitations, settings mutations, search, notifications, CSV, Axe, Lighthouse and final independent review are outside Phase 6 scope.
