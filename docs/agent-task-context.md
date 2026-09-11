# Agent Task Context (experimental)

## Architecture

`domain/ai/entities/agent-task-context.ts` defines immutable task snapshots.
`application/services/agent-task-context.service.ts` owns their runtime lifecycle.
The service reuses `EntityId`, `ValidationError`, and `OrionSourceRegistry.resolve`.
It has no MCP, filesystem, database, or agent-execution dependency.

`createAiBridgeRuntime()` creates one `OrionSourceRegistry`, passes it to both
`OrionKnowledgeFacade` and `AgentTaskContextService`, and exposes task operations as
`runtime.tasks`. `AgentRuntimeHost` owns that runtime for an agent session and exposes only
`knowledge` and `tasks` to skill execution. This is an in-memory capability, not an MCP tool.

Existing `AiBridgeAgentContextDataDto` is a retrieval bundle, not a task lifecycle.
CLI `PrepareWritingTaskData` / `PrepareEditTaskData` prepare transient context without
task identity or shared state. Organization plans contain only move-note and
create-folder actions; they are not general development plans. The internal skill
registry describes capabilities and recommended flows, not running workflows.
These contracts and all existing skills remain unchanged.

## Contract and invariants

- Caller supplies task ID, goal, and declared actor; project and constraints are optional.
- IDs use existing `EntityId` semantics: nonblank strings, not a new UUID requirement.
- Goal, actor, supplied project, constraints, plan steps, and artifact descriptions/references must be nonblank.
- Creation always starts at `pending`. Status is one of `pending`, `discovery`, `planning`, `implementation`, `review`, `completed`, `blocked`.
- Noncompleted states may change freely; there is no workflow engine or mandatory phase sequence.
- Completed tasks reject every update. Only `reopen(id, actor)` returns them to `pending`, preserving context.
- Identity, goal, project, and constraints stay fixed in this first version.
- `addSourceRefs` appends and deduplicates references recognized by the injected runtime registry. No note content is embedded.
- `plan` replaces an ordered list of text steps; `[]` clears it. Steps have no execution state or dependencies.
- `addArtifacts` appends artifacts with an ID unique within the task, description, optional reference, and provenance. A reference is descriptive, not opened or executed.
- Artifact `taskId` and `producedBy` come from the service, not artifact input. `basedOn` is a deduplicated subset of task sourceRefs, including refs attached in the same update.
- Task provenance stores `createdBy` and latest `updatedBy`. Actor strings allow researcher/developer/reviewer or custom names; they are claims, not authenticated identities.
- No timestamps, event history, artifact versioning, permissions, or audit-log guarantees.
- All returned snapshots and nested collections/objects are frozen. Inputs are copied. Failed updates publish nothing; older snapshots never change.

## Scope, lifecycle, and access

Ownership is `agent session -> runtime -> AgentTaskContextService -> tasks`. One reused
runtime retains its tasks across interactions in that session. At session end its owner
calls `dispose()` and releases its runtime reference; no task or source reference is
persisted, written to Vault, or recovered by a later runtime.

A compatible host injects `AgentRuntime`, containing only `runtime.knowledge` and
`runtime.tasks`. Skills use task `create`, `get`, `update`, and `reopen` operations and
receive immutable snapshots. They do not receive source registry registrations, task maps,
vault roots, or filesystem internals. `runtime.sourceRegistry` remains host composition state
for existing adapters; it is not a skill capability.

OpenCode's current MCP adapter exposes knowledge tools only, so its Markdown skills cannot
yet receive this in-process capability. Adding a task MCP tool or a fake task store would
change that boundary and is intentionally out of scope.

## Experimental role phases

`researchTask(runtime, input)`, `prepareDevelopmentTask(runtime, input)`, and
`reviewTask(runtime, input)` provide a small,
sequential experiment over one injected `AgentRuntime`. A caller creates a task, sets it to
`discovery`, runs research, then passes the same runtime and task ID to development. Research
searches Orion, reads discovered references, records one `researcher` artifact with concise
Known/Inferred/Unknown findings, and moves the task to `planning`. Development gets that task,
reads its associated references, records a minimum plan and a `developer` preparation artifact,
then moves it to `implementation`. After real implementation artifacts and validation outputs are
available, review reads associated sources, may use focused search and related notes for a concrete
gap, and records one `reviewer` artifact. Its description contains `PASS`, `WARN`, or `FAIL` and
explicit `Compliant`, `Divergence`, `Missing`, or `Unknown` findings. `Unknown` is not failure by
itself. Review moves to `review`; it never completes a task or applies corrections.

These are three execution roles, not autonomous agents, workers, queues, or a scheduler. All
phases use the `knowledge` and `tasks` capabilities from the same runtime, so a sourceRef from
research is valid for development and review. A reference from another runtime remains rejected by
`AgentTaskContextService`. Orion Development can call these phases only when an in-process host
injects `AgentRuntime`; its current Markdown/OpenCode path still has knowledge MCP only.

The normal sequential lifecycle is `pending -> discovery -> planning -> implementation -> review`.
Known critical divergence, missing mandatory work, or failed mandatory validation keeps the task out
of `completed`. A caller explicitly changes `review -> implementation` for a correction, records a
new developer artifact, and invokes review again. Warnings and unknowns do not automatically block
completion; an explicit caller concludes only after evaluating them.

`reviewTask` accepts the existing `taskId`, explicit findings from available implementation artifacts
or validation output, and optionally a focused knowledge query for a concrete evidence gap. Each
finding is `compliant`, `divergence`, `missing`, or `unknown`; optional `basedOn` refs must belong to
the same task. The operation reads current task refs, can associate same-runtime search or related
results, and emits a concise review artifact. It cannot inspect an artifact reference automatically:
when actual implementation evidence is unavailable, callers record an `unknown` finding rather than
inventing files, test output, or tool execution.

## Runtime usage

```ts
const runtime = createAiBridgeRuntime();
const { knowledge, tasks } = runtime;
const task = tasks.create({
  id: 'site-x-auth',
  goal: 'Implement authentication according to Orion documentation',
  project: 'Site X',
  constraints: ['No database changes']
}, 'user');

// In a real caller, use sourceRef returned by knowledge.search/context/related.
const search = await knowledge.search({ query: 'authentication' });
const sourceRef = search.data.matches[0]?.sourceRef;
if (!sourceRef) throw new Error('Knowledge source reference unavailable');
tasks.update(task.id, { addSourceRefs: [sourceRef] }, 'researcher');
tasks.update(task.id, {
  status: 'planning',
  plan: ['Define flow', 'Implement', 'Test', 'Review']
}, 'developer');
tasks.update(task.id, {
  status: 'implementation',
  addArtifacts: [{
    id: 'implementation', description: 'Authentication implementation',
    reference: 'src/auth.ts', basedOn: [sourceRef]
  }]
}, 'developer');
tasks.update(task.id, {
  status: 'review',
  addArtifacts: [{ id: 'review-findings', description: 'PASS\nCompliant: Authentication tests passed', basedOn: [sourceRef] }]
}, 'reviewer');
// An explicit caller may mark completed only after evaluating review findings.
const snapshot = tasks.get(task.id);
```

Future callers share one service instance and task ID, obtain snapshots via `get`,
and submit explicit updates with their declared actor. Reference consumers use the
same runtime's knowledge facade to read notes. Nothing is wired into MCP or UI yet.
There is no global singleton. Multi-process sharing, concurrency control, persistence,
scheduling, automatic skill execution, and a host-to-skill runtime injection are outside
this version.

The textual plan can describe `agent-context`, `plan`, `preview`, `diff`, and
`validate` work, while artifact references can identify their external outputs.
This neither changes those skills nor conflates organization actions with task steps.
