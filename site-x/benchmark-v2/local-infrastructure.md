# Site X Benchmark v2 Local Infrastructure

## Scope

Phase 1 provides disposable local services only. It does not add Prisma, Auth.js, product schema, business logic, RBAC, API routes, or product functionality.

## Services

| Service | Image | Host port | Container port | Purpose |
|---|---|---:|---:|---|
| PostgreSQL | `postgres:16.4-alpine` | `${POSTGRES_PORT}` (default `54329`) | `5432` | Dedicated future benchmark database. |
| Mailpit SMTP | `axllent/mailpit:v1.20.5` | `${MAILPIT_SMTP_PORT}` (default `1025`) | `1025` | Local-only future email capture. |
| Mailpit UI/API | `axllent/mailpit:v1.20.5` | `${MAILPIT_UI_PORT}` (default `8025`) | `8025` | Inspect captured messages at `http://127.0.0.1:8025`. |

Compose project name: `site-x-benchmark-v2`.

## Volumes and health

- PostgreSQL data persists only in named volume `site-x-benchmark-v2-postgres-data`.
- `postgres` healthcheck runs `pg_isready` every five seconds.
- `mailpit` healthcheck checks `http://localhost:8025/api/v1/info` every five seconds.
- `infra:up` waits until both healthchecks are healthy.
- `infra:reset` removes only this Compose project resources and named database volume. It is destructive for local benchmark data.

## Environment

1. Copy `.env.example` to `.env`.
2. Keep `POSTGRES_PASSWORD` local-only. Replace placeholder before use.
3. Keep `AUTH_SECRET` as placeholder until Phase 3. Generate a local-only value only when Auth.js is implemented.

| Variable | Required now | Purpose |
|---|---|---|
| `POSTGRES_DB` | Yes | Dedicated local database name. |
| `POSTGRES_USER` | Yes | Dedicated local database user. |
| `POSTGRES_PASSWORD` | Yes | Local Compose password; never commit `.env`. |
| `POSTGRES_PORT` | Yes | Configurable host PostgreSQL port. |
| `DATABASE_URL` | Reserved | Future application connection string; it must match local Postgres values. |
| `AUTH_SECRET` | Reserved | Future Auth.js test secret; no Auth.js configuration exists yet. |
| `MAILPIT_SMTP_HOST` | Yes | Future local SMTP host. |
| `MAILPIT_SMTP_PORT` | Yes | Future local SMTP port. |
| `MAILPIT_UI_PORT` | Yes | Browser/API port used by smoke check. |

`.env` remains ignored. `.env.example` contains placeholders only, not credentials.

## Commands

Run from `site-x` after creating `.env`:

```powershell
npm run infra:up
npm run infra:status
npm run infra:smoke
```

Stop containers and retain data:

```powershell
npm run infra:down
```

Reset all local benchmark database data:

```powershell
npm run infra:reset
```

## Smoke checks

`npm run infra:smoke` verifies all of following:

- `postgres` and `mailpit` containers are running.
- Both Docker healthchecks report `healthy`.
- PostgreSQL accepts `pg_isready` and `psql` connects to expected database.
- Mailpit API responds at local UI port.

Docker Engine and Docker Compose are only machine prerequisites. Images are pulled from registries on first run; runtime does not require external database, SMTP, credentials, or production service.
