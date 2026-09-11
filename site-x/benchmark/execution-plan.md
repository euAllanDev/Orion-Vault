# Execution plan

Self-review approved this plan: it preserves documented unknowns, implements no credentials or external services, and keeps benchmark provenance outside Orion Vault.

1. Create isolated Next.js 15 workspace and benchmark records. **Done**.
2. Apply documented visual tokens, global accessibility baseline and public metadata.
3. Implement public home, pricing and magic-link request interface.
4. Implement reusable app shell plus dashboard, projects, project detail and settings presentation routes using deterministic demo data.
5. Implement documented client interactions: create project dialog, evidence/theme composition, search, filter, toast, mobile navigation and keyboard shortcuts where safe.
6. Run lint/build. Reviewer compares actual code to traceability matrix; record WARN/FAIL and correction cycles.
7. Publish final metrics and remaining service-layer unknowns.

## Initial workspace structure

```text
site-x/
  benchmark/          external benchmark provenance and phase reports
  src/app/            routes and metadata
  src/components/     reusable UI and feature composition
  public/             static assets when supplied
```
