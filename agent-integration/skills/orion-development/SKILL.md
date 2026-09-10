---
name: orion-development
description: Use when a user explicitly asks to create, implement, build, develop, modify, fix, refactor, or add a feature based on Orion, their Vault, saved notes, project documentation, or existing documented decisions. Consult Orion knowledge and validate against it; use the existing AgentTaskContext for LEVEL 2+ work when its application runtime is available. Do not use for knowledge-only questions.
metadata:
  orion-skill-type: development-workflow
  mcp-tools: orion_search, orion_context, orion_related, orion_read
---

# Orion Development Skill v0.2

## Purpose

Before implementing, discover what Orion already knows.

Use Orion Vault as read-only project knowledge when the user explicitly asks to develop from Orion, their Vault, notes, saved context, project documentation, or documented decisions. Orion supplies evidence; normal agent development tools implement and validate code.

This skill specializes `orion-agent` retrieval for execution work. It does not replace that skill for knowledge-only requests and never writes to Orion.

## Intent and authorization

Use this skill for explicit development intent combined with explicit Orion consultation intent. Strong development signals include:

- implement, create, build, develop, modify, fix, refactor, or add a feature
- transform documentation into code
- implement according to a specification
- build from notes or existing decisions

Questions that only seek information remain knowledge requests. For example, `Which framework do we use?` uses Orion knowledge retrieval; `Implement project using documented framework` uses this skill.

Selecting this skill does not authorize Vault access. Follow `orion-agent` read authorization: do not call Orion unless current request clearly authorizes consulting Orion, Vault, notes, saved context, or persistent knowledge. If source or authorization is materially ambiguous, ask one short question before reading Orion or local files.

Before first authorized Orion read, briefly state that Orion documentation will be consulted. Never call `orion_remember` or any Vault write operation in this workflow. In-memory task updates are not Vault writes and do not grant Vault access.

## Complexity and runtime

Choose depth from scope, uncertainty, risk, and validation needs, not file count alone. LEVEL is an orchestration decision, not a new task field or status.

| Level | Typical work | Task policy |
| --- | --- | --- |
| LEVEL 1 | Isolated, low-risk change with clear acceptance, such as button text | Minimal discovery, edit, check; no explicit task required. |
| LEVEL 2 | Bounded feature or nontrivial fix needing evidence, a concrete plan, and validation | Create or reuse an AgentTaskContext before discovery. |
| LEVEL 3/4 | Cross-cutting feature or whole project, such as building Site X | Use the same task model, a phased plan, and milestone artifacts; execute sequentially with one agent. |

If LEVEL 1 work grows into LEVEL 2+, create or reuse the task then. Summarize verified progress, without inventing earlier task updates or provenance.

Use the existing contracts, not a parallel Markdown/JSON task model:

- `domain/ai/entities/agent-task-context.ts`: immutable snapshot and known statuses.
- `application/services/agent-task-context.service.ts`: `AgentTaskContextService.create`, `get`, `update`, `reopen`.
- `docs/agent-task-context.md`: runtime ownership, references, and invariants.

`AgentTaskContext` is an interface, not an object with a static `create()` method. Task operations below are application-service calls, not MCP tools or CLI commands. The host must provide access to one live service instance using the same source registry as its knowledge facade. Reuse that instance and task ID throughout the work; read current snapshots through `get(id)`. Do not mutate snapshots or create a fresh service/process for each update.

An in-process host can inject `AgentRuntime` from `interfaces/agent/agent-runtime-host.ts`. It supplies only `runtime.knowledge` and `runtime.tasks`, backed by one `createAiBridgeRuntime()` instance and one shared source registry. A Markdown skill cannot discover that service by itself. If the host exposes only knowledge MCP tools, report that AgentTaskContext is unavailable in this session. Do not claim creation, updates, reference association, or a runtime `blocked` status that did not occur. Ask whether to continue explicitly without task tracking or wait for a compatible host; do not silently downgrade LEVEL 2+ to LEVEL 1. Do not implement a bridge, new tools, persistence, or a substitute task type as a workaround.

Tasks and sourceRefs are runtime-only. After runtime loss, old IDs cannot be resumed or reopened: create a new task in a compatible runtime and rediscover references with current authorization. Never fabricate or re-register a remote sourceRef locally.

## Task operations

Use one truthful actor label for the executing agent, such as `orion-development`, throughout the task. Labels like researcher/developer/reviewer may describe roles of this same agent, never independent agents or independent review. Actor labels are declared attribution, not authentication.

1. Create with `tasks.create({ id, goal, project?, constraints? }, actor)`. Supply a nonblank task ID unique in this service, not merely a reusable project ID. Goal comes from the request; include project and constraints only when known. The service sets `pending` and provenance automatically; do not pass status or provenance into create.
2. For an existing task, call `tasks.get(id)` and verify its fixed goal/project/constraints match the requested work. Reuse matching work, not an unrelated task. If completed work needs changes, call `tasks.reopen(id, actor)` first; it returns `pending` and preserves context.
3. Change phases through `tasks.update(id, { status }, actor)`. Use only `pending`, `discovery`, `planning`, `implementation`, `review`, `completed`, `blocked`. Levels, phases, and skill names do not add states.
4. Attach relevant knowledge with `tasks.update(id, { addSourceRefs: refs }, actor)`. The service resolves and deduplicates refs. Only use refs returned by knowledge operations in the same runtime; paths and note contents are not sourceRefs.
5. Record concrete steps with `tasks.update(id, { plan: steps }, actor)`. This replaces the ordered textual plan; send the complete intended plan on revision. `[]` explicitly clears it. Do not store private reasoning, every thought, dependencies, or execution state per step.
6. Register meaningful outputs through `tasks.update(id, { addArtifacts: [{ id, description, reference?, basedOn? }] }, actor)`. IDs must be unique within the task. The service assigns `taskId` and `producedBy` from task and actor; do not pass those fields in artifact input. `basedOn` contains only relevant refs already attached, or attached via `addSourceRefs` in this same update. Use `[]` when there is no knowledge evidence, not invented citations.

Artifacts summarize significant implementation, evidence assessment, test results, or review, not every changed file. `reference` points to an actual relevant output when available; omit it rather than inventing a report file. Keep descriptions concise and factual, including actual validation outcomes. Artifacts are append-only: later corrections get new IDs and identify the superseded finding in their description. Do not duplicate notes, store secrets, or create files solely to simulate task persistence.

Goal, project, and constraints are fixed after creation. Maintain **KNOWN / INFERRED / UNKNOWN** through concise evidence-assessment artifacts when useful, with `basedOn` for their documented basis. Record newly discovered constraints or observations there instead of attempting an unsupported field update. These are conclusions and gaps, not copied documentation or private reasoning. Update the plan when they affect work.

## Workflow

Adapt depth to task. Do not turn a trivial targeted change into a large investigation, and do not read the whole Vault.

### 1. Discover

For LEVEL 2+, create/reuse the task and explicitly set `discovery` before retrieval, subject to runtime availability above. Keep LEVEL 1 minimal.

Identify project, affected area, requested outcome, relevant documentation, architecture, requirements, decisions, and constraints. Prefer a small focused `orion_search` when topic or location is unknown.

Use evidence from request and retrieval results to expand. Do not use broad synonym bags or assume first result is complete.

Choose existing capabilities by their real scope, not as a mandatory checklist:

- **Knowledge:** `product-context` and `route-intent` clarify Orion product/Vault/code ambiguity; `product-context` is not documentation for an arbitrary target product. `agent-context`, `search`, `retrieve`, `related`, and `analyze-note` provide focused evidence when available.
- **Planning:** `prepare-writing-task` and `prepare-edit-task` are context-preparation capabilities, not AgentTaskContext creation. Orion `plan`, `preview`, and `diff` describe note organization, not arbitrary code changes.
- **Execution:** use normal development tools for project changes. Vault commands such as `apply`, `organize-batch`, `mkdir`, `touch`, `edit`, `rename`, and `move` are not authorized by this read-only knowledge workflow.
- **Maintenance:** `validate`, `inspect`, `scan`, `doctor`, and `maintenance-diagnose` concern Vault/environment health, not application acceptance tests. Use only when relevant and permitted; do not run `sync` or maintenance mutations as task bookkeeping.

These capability names are not additional MCP APIs. With knowledge MCP, use the available `orion_search`, `orion_context`, `orion_related`, and `orion_read`; never invent `orion_plan`, `orion_validate`, or task tools. Honor no-Vault-change requirements, including avoiding commands with cache/config write side effects. If a capability returns only paths, do not attach those as refs; obtain a real sourceRef from the compatible knowledge runtime when needed.

### 2. Context

Use `orion_context` after initial discovery when cross-note structure, continuation context, or a concrete gap needs it. Seek only context needed for task, especially:

- product vision and requirements
- architecture and technical decisions
- design system, pages, and components
- APIs, security, tests, and constraints

Do not call context merely to repeat search paths or snippets already understood.

### 3. Related

For an important document with likely dependencies, call `orion_related` using its available source reference to find connected knowledge. Follow relationships only when they can affect implementation, such as architecture to authentication, API, security, or session decisions.

Do not call related indiscriminately or explore every connected note.

### 4. Read

Read documents needed to establish requirements or support an implementation decision. Prefer `orion_read` with `sourceRef` returned by Orion; use a relative path only when no source reference is available.

Search finds candidates. Context structures evidence. Related finds relevant dependencies. Read establishes specific source-of-truth details. Avoid rereading information already sufficient for task.

For a tracked task, attach selected relevant sourceRefs as discovery progresses. Task stores references, not full notes or retrieval bundles. Reference association alone does not mean a note was read or its claims verified.

### 5. Identify gaps

Before implementation and whenever new evidence changes the task, classify material information:

- **Known:** explicitly defined in Orion.
- **Inferred:** necessary decision reasonably deduced from known information.
- **Unknown:** information genuinely absent from retrieved Orion evidence.

Do not turn inference or personal preference into a documented requirement. Do not invent credentials, infrastructure, major architecture decisions, or other unknowns. Preserve current behavior when possible. Ask user only when an unknown is necessary to proceed safely; consult Orion first if that answer may exist there.

Use evidence-assessment artifacts for material conclusions and new constraints as described above. A missing search result does not prove absence throughout Orion. If essential information remains unavailable after relevant authorized discovery and cannot safely be inferred, follow the blocked procedure below.

### 6. Plan

Before substantial changes, create a concise implementation plan grounded in retrieved requirements, architecture, decisions, dependencies, components, and tests. For a small, isolated task, keep plan short and proceed.

For LEVEL 2+, set `planning` and record actionable steps in `plan`. For LEVEL 3/4, group sequential phases and validation checkpoints in the same plan, not child task types, a DAG, or parallel agents. Use Orion `plan`/`preview`/`diff` only for applicable authorized read-only organization previews. Use ordinary project previews and Git diff for code; task plan is a separate textual list.

### 7. Implement

Use normal agent tools for filesystem, terminal, IDE, code, tests, and Git. Orion is read-only knowledge, not an execution environment. Keep implementation aligned with known Orion decisions and avoid unrelated refactors.

Set a tracked task to `implementation` before changes. Register significant implementation outputs when they actually exist. AgentTaskContext records work; it neither performs edits nor grants permission to commit, push, or modify the Vault.

### 8. Validate and correct

Validate code with relevant project checks. For sufficiently complex work, perform a second Orion comparison: use focused `orion_search`, `orion_context`, `orion_related`, or `orion_read` to confirm important requirements and decisions.

Set a tracked task to `review` before validation. Inspect the actual project diff and run appropriate tests, typecheck, build, lint, or UI checks. Use Orion `validate` only for its Vault-boundary purpose when applicable; it does not replace these checks. Attach newly relevant same-runtime sourceRefs and record significant test/review outcomes as artifacts, with truthful attribution to this one agent.

Ask: `Does implementation match Orion knowledge?`

If comparison finds inconsistency, record the finding, consult the relevant Orion evidence when authorized, and explicitly change from `review` to `discovery` or `planning` if more research or replanning is needed, then `implementation` for correction and `review` for revalidation. Add a new outcome artifact after the correction rather than rewriting the old one. Compilation or passing tests alone does not prove documented alignment.

### 9. Complete, block, or reopen

Set `completed` only when the goal and required validation are satisfied and no known critical issues remain. Register final relevant artifacts before completion or in the same update. Do not block completion on optional polish or unknowns that do not prevent the goal; disclose those limits in the report.

If essential information, access, or validation is unavailable, set an existing task to `blocked` and record a concise blocker artifact. Explain what is missing, why it is necessary, what relevant Orion evidence was found, and what could not safely be inferred. Distinguish unavailable Orion access from information not found in retrieved sources. Ask only for the essential missing input. Once resolved, explicitly update to `discovery`, `planning`, `implementation`, or `review` as appropriate; `reopen` is not for blocked tasks.

For a completed task requiring more work, call `tasks.reopen(id, actor)` to return to `pending`, then explicitly enter the appropriate phase. Never update a completed snapshot directly. No new states, persistent memory, scheduler, background work, parallel execution, or fictional agents are introduced.

## Task modes

### Greenfield

Discover project and desired outcome, retrieve overview, requirements, architecture, design system, pages, components, and decisions as relevant; identify gaps; plan; implement; validate; compare with Orion.

### Feature

Discover affected area, locate requirements and architecture, inspect evidence-backed dependencies through related notes, implement, then validate against relevant decisions.

### Bug

Discover expected behavior from requirements or decisions, investigate local cause, implement minimal correction, and validate code plus documented behavior.

### Refactor

Discover current architecture and applicable decisions, inspect related constraints, plan change, refactor without changing undefined behavior, and validate against architecture.

## Completion report

Report implementation, validation performed, and material unknowns or assumptions. Distinguish documented Orion requirements from local inferences. Do not claim Orion coverage is exhaustive unless a tool guarantees it.

For tracked work, include the actual task ID/status, relevant sourceRefs, plan outcome, significant artifacts, and remaining blockers or nonblocking unknowns. If runtime tracking was unavailable, state that explicitly rather than presenting a conceptual example as an executed task. Do not persist this report into Orion automatically.

## Core rules

- Orion remains closed without explicit current read authorization.
- Start discovery with focused search when task knowledge is not already located.
- Prefer `sourceRef` for specific reads when available.
- Use related notes for concrete dependencies, not ritual exploration.
- Retrieve enough evidence before significant implementation; do not load whole Vault.
- Preserve undefined choices and existing behavior where possible.
- Use Orion knowledge before asking user for information Orion may contain.
- Recheck complex implementations against Orion and correct mismatches.
- Use the existing runtime task for LEVEL 2+; disclose unavailable tracking instead of simulating it.
- Keep one agent, one truthful provenance trail, and controlled service updates; no parallel task model.
- Complete only after critical issues are resolved; use explicit `reopen` for completed work.
- Never write to Orion or invent MCP APIs.
