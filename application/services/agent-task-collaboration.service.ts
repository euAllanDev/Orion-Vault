import type { AgentTaskContext } from '../../domain/ai/entities/agent-task-context';
import { ValidationError } from '../../domain/shared/errors/validation-error';
import type { AgentRuntime } from '../../interfaces/agent/agent-runtime-host';

export interface ResearchTaskInput {
  readonly taskId: string;
  readonly objective: string;
  readonly artifactId?: string;
}

export interface PrepareDevelopmentTaskInput {
  readonly taskId: string;
  readonly artifactId?: string;
}

function describeResearch(objective: string, sourceRefs: readonly string[]): string {
  return `Research findings for ${objective}\n\nKnown: Identified ${sourceRefs.length} relevant Orion source reference(s).\nInferred: Development can prepare an implementation plan from this runtime-scoped evidence.\nUnknown: This research phase does not perform the implementation.`;
}

/** Sequential role phases over one injected AgentRuntime; this is not agent orchestration. */
export async function researchTask(runtime: AgentRuntime, input: ResearchTaskInput): Promise<AgentTaskContext> {
  runtime.tasks.get(input.taskId);
  const search = await runtime.knowledge.search({ query: input.objective });
  const sourceRefs = new Set<string>();
  for (const match of search.data.matches) {
    if (match.sourceRef) sourceRefs.add(match.sourceRef);
  }
  for (const chunk of search.data.chunks) {
    if (chunk.sourceRef) sourceRefs.add(chunk.sourceRef);
  }

  // Search can be empty while agent context still has a focused note or supporting chunks.
  if (sourceRefs.size === 0) {
    const context = await runtime.knowledge.context({ query: input.objective });
    if (context.data.focusSourceRef) sourceRefs.add(context.data.focusSourceRef);
    for (const chunk of context.data.supportingChunks) {
      if (chunk.sourceRef) sourceRefs.add(chunk.sourceRef);
    }
    for (const sourceRef of context.data.relatedNoteSourceRefs) sourceRefs.add(sourceRef);
  }

  const researchedRefs = [...sourceRefs];
  for (const sourceRef of researchedRefs) await runtime.knowledge.read({ sourceRef });
  if (researchedRefs[0]) {
    const related = await runtime.knowledge.related(researchedRefs[0]);
    for (const note of related.results) sourceRefs.add(note.sourceRef);
  }

  const evidence = [...sourceRefs];
  runtime.tasks.update(input.taskId, { addSourceRefs: evidence }, 'researcher');
  runtime.tasks.update(input.taskId, {
    addArtifacts: [{
      id: input.artifactId ?? 'research-findings',
      description: describeResearch(input.objective, evidence),
      basedOn: evidence
    }]
  }, 'researcher');
  return runtime.tasks.update(input.taskId, { status: 'planning' }, 'researcher');
}

/** Consumes research evidence to prepare development; no project implementation occurs here. */
export async function prepareDevelopmentTask(runtime: AgentRuntime, input: PrepareDevelopmentTaskInput): Promise<AgentTaskContext> {
  const task = runtime.tasks.get(input.taskId);
  const researchArtifact = task.artifacts.find((artifact) => artifact.producedBy === 'researcher');
  if (!researchArtifact) {
    throw new ValidationError('Development preparation requires a research artifact', 'AGENT_TASK_RESEARCH_REQUIRED');
  }

  for (const sourceRef of task.sourceRefs) await runtime.knowledge.read({ sourceRef });
  const plan = [
    `Review research findings: ${researchArtifact.description.split('\n', 1)[0]}`,
    `Implement ${task.goal} according to associated Orion sources`,
    'Validate the implementation against the associated sources'
  ];
  runtime.tasks.update(task.id, { plan }, 'developer');
  runtime.tasks.update(task.id, { status: 'implementation' }, 'developer');
  return runtime.tasks.update(task.id, {
    addArtifacts: [{
      id: input.artifactId ?? 'implementation-plan',
      description: `Implementation preparation for ${task.goal}; consumes research artifact ${researchArtifact.id}.`,
      basedOn: task.sourceRefs
    }]
  }, 'developer');
}
