# Site X Documentation-Only Benchmark

## Start state

- Agent implementation workspace: `site-x-agent-benchmark/`.
- Preserved reference implementation: `site-x/`.
- Orion documentation remains under `site-x/`, including `benchmark-v2/`.
- Base workspace contains only package metadata, TypeScript configuration, and ignore rules.
- Base workspace contains no `src/`, `public/`, `tests/`, `prisma/`, API routes, components, fixtures, implementation documentation, lockfile, or environment file.

## Agent briefing

Provide only: build Site X, access to Orion MCP, and `site-x-agent-benchmark/` as current workspace.
Do not provide document paths, sourceRefs, a file plan, architecture, implementation checklist, or the preserved `site-x/` directory as agent context.

## Expected flow

Research -> Planning -> Development -> Implementation -> Tests -> Review -> Correction -> Re-review -> PASS.

## Measure

- MCP tools used and sourceRefs produced in that session.
- Orion documents consulted.
- Agent task artifacts.
- Files created in `site-x-agent-benchmark/`.
- Requirements implemented, test results, review findings, and corrections.
- Elapsed time when host exposes it.

## Reproducibility

Before each run, verify `site-x-agent-benchmark/` contains only `.gitignore`, `package.json`, and `tsconfig.json`. Restore this state from version control; never copy from `site-x/`.
Install dependencies in the benchmark workspace with `npm install` only when execution begins. Do not run the benchmark during setup.
