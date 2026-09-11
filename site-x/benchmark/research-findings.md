# Research findings

## Known

- Fieldnote serves research teams. Core V1: workspace, projects, sessions, evidence, themes, dashboard, magic-link authentication and RBAC.
- Stack decision: Next.js 15 App Router, TypeScript strict and Tailwind/CSS tokens. Public routes are `/` and `/pricing`; app routes use `/w/:workspaceSlug/...`.
- Visual system: Ink `#17324D`, Signal `#E86A4A`, Canvas `#F8F6F1`, DM Sans UI, Newsreader editorial headings, light-only theme.
- P0 roles: Owner/Admin manage membership; Researcher edits research content; Viewer reads only. Archived projects are read-only.
- Required accessibility behavior includes skip link, visible focus, labeled controls, keyboard dialog behavior and `aria-live` feedback.

## Inferred

- A front-end benchmark can use deterministic in-memory sample data to demonstrate documented interactions without claiming an authenticated backend.
- Demo routes expose a researcher-capable workspace because P0 creation flows must be visible. This is presentation behavior, not authorization.
- Browser-native controls and no icon package minimize initial client cost and preserve accessibility.

## Unknown

- No SMTP provider, Auth.js secret, database URL, deployment host, real users, or credentials were supplied.
- No production image asset with documented consent was supplied.
- No design for billing, SSO, transcription, generative AI, offline editing, or public sharing exists because each is out of scope.

## Evidence map

- Product/requirements: `orion:src_Y0q7kmUo0BQCDzuIgK94xzou`, `orion:src_Fft9ZoQ4eY8b0Qzm0Zs81FMF`
- UX/pages/components: `orion:src_FLrHsoShk8GiJcbpaq_H9KkM`, `orion:src_2o0IsRQv2CjxeVqxgN1f2wU8`, `orion:src_XwCJa-QO9LmSEUe70-gghO7-`
- Data/API/security: `orion:src_zF4K5G3T-TINtLkL7RwHubbX`, `orion:src_C1CrqcPuAeAIXuY3e2jQxbdX`, `orion:src_-LnHXFwKkm4QY7DuNFPKO2Jj`
- Quality: `orion:src_A0k2kAdQOuglZlP1SMnkn1mB`, `orion:src_frq0hVHECnkGt0Tu-3XdBxTZ`, `orion:src_jhLBJutP54C0dz2SZHfg-lJ0`
