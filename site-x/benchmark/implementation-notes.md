# Implementation notes

## Developer phase

- Scaffold: Next.js 15.5.9, TypeScript and Tailwind base generated in isolated workspace.
- No Orion Vault source code was modified.
- No secrets, credentials, database connection, email provider, billing provider or production configuration was added.
- Product code will use sample research data only; this does not implement database persistence, Auth.js, RBAC enforcement, Route Handlers, Server Actions or rate limiting.

Artifacts are appended after implementation and verification.

## Produced artifacts

- Public routes: `src/app/page.tsx`, `src/app/pricing/page.tsx`, `src/app/login/page.tsx`.
- Workspace routes: dashboard, projects, project detail and settings under `src/app/w/[workspaceSlug]/`.
- UI/features: `src/components/app-shell.tsx`, `src/components/project-workspace.tsx`, `src/components/demo-data.ts`.
- Global semantic tokens, responsive layout, focus styling and reduced-motion behavior: `src/app/globals.css`.
- Validation: `npm run lint` passed; `npm run build` passed.
- Reviewer comparison completed. Service-layer P0 requirements are deliberately unimplemented and classified FAIL/BLOCKED in `review-findings.md`; this benchmark does not claim full product completion.
