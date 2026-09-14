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
  /** Failed reviewer artifact explicitly consumed by a correction. */
  readonly reviewArtifactId?: string;
  /** Actual implementation output inspected by a later reviewer. */
  readonly implementationReference?: string;
}

export const REVIEW_FINDING_KINDS = ['compliant', 'divergence', 'missing', 'unknown'] as const;
export type ReviewFindingKind = typeof REVIEW_FINDING_KINDS[number];

export interface ReviewFinding {
  readonly kind: ReviewFindingKind;
  /** Factual result from inspection of available implementation artifacts or validation output. */
  readonly description: string;
  /** Relevant task sources; omitted when the finding has no documented basis. */
  readonly basedOn?: readonly string[];
}

export interface ReviewTaskInput {
  readonly taskId: string;
  readonly findings: readonly ReviewFinding[];
  /** Optional focused query when associated sources leave a concrete review gap. */
  readonly knowledgeQuery?: string;
  readonly artifactId?: string;
}

function describeResearch(objective: string, sourceRefs: readonly string[]): string {
  return `Research findings for ${objective}\n\nKnown: Identified ${sourceRefs.length} relevant Orion source reference(s).\nInferred: Development can prepare an implementation plan from this runtime-scoped evidence.\nUnknown: This research phase does not perform the implementation.`;
}

function describeReview(goal: string, findings: readonly ReviewFinding[]): string {
  const labels: Record<ReviewFindingKind, string> = {
    compliant: 'Compliant',
    divergence: 'Divergence',
    missing: 'Missing',
    unknown: 'Unknown'
  };
  const result = findings.some((finding) => finding.kind === 'divergence' || finding.kind === 'missing')
    ? 'FAIL'
    : findings.some((finding) => finding.kind === 'unknown')
      ? 'WARN'
      : 'PASS';
  const details = findings.length === 0
    ? 'Unknown: No review findings were supplied from an actual implementation inspection.'
    : findings.map((finding) => `${labels[finding.kind]}: ${finding.description}`).join('\n');
  return `Review findings for ${goal}\n\n${result}\n${details}`;
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

  const latestReview = [...task.artifacts].reverse().find((artifact) => artifact.producedBy === 'reviewer');
  const failedReview = latestReview?.description.includes('\n\nFAIL\n') ? latestReview : undefined;
  const correction = task.status === 'review';
  const correctionReviewArtifactId = input.reviewArtifactId ?? '';
  if (correction && (!failedReview || correctionReviewArtifactId !== failedReview.id)) {
    throw new ValidationError('Correction requires the latest failed review artifact', 'AGENT_TASK_CORRECTION_REVIEW_REQUIRED');
  }

  for (const sourceRef of task.sourceRefs) await runtime.knowledge.read({ sourceRef });
  const plan = correction
    ? [
        `Read failed review artifact: ${correctionReviewArtifactId}`,
        `Correct ${task.goal} according to associated Orion sources`,
        'Re-run review against the corrected implementation'
      ]
    : [
        `Review research findings: ${researchArtifact.description.split('\n', 1)[0]}`,
        `Implement ${task.goal} according to associated Orion sources`,
        'Validate the implementation against the associated sources'
      ];
  runtime.tasks.update(task.id, { plan }, 'developer');
  runtime.tasks.update(task.id, { status: 'implementation' }, 'developer');
  return runtime.tasks.update(task.id, {
    addArtifacts: [{
      id: input.artifactId ?? 'implementation-plan',
      description: correction
        ? `Correction implementation for ${task.goal}; consumes failed review artifact ${correctionReviewArtifactId}.`
        : `Implementation preparation for ${task.goal}; consumes research artifact ${researchArtifact.id}.`,
      ...(input.implementationReference ? { reference: input.implementationReference } : {}),
      basedOn: task.sourceRefs
    }]
  }, 'developer');
}

/** Records an explicit evidence-based review; it never completes or corrects the task. */
export async function reviewTask(runtime: AgentRuntime, input: ReviewTaskInput): Promise<AgentTaskContext> {
  const task = runtime.tasks.get(input.taskId);
  if (task.status !== 'implementation' && task.status !== 'review') {
    throw new ValidationError('Review requires a task in implementation or review', 'AGENT_TASK_REVIEW_STATE');
  }
  if (!task.artifacts.some((artifact) => artifact.producedBy === 'developer')) {
    throw new ValidationError('Review requires a development artifact', 'AGENT_TASK_DEVELOPMENT_REQUIRED');
  }
  for (const finding of input.findings) {
    if (!REVIEW_FINDING_KINDS.includes(finding.kind)) {
      throw new ValidationError('Unknown review finding kind', 'AGENT_TASK_REVIEW_FINDING');
    }
    if (typeof finding.description !== 'string' || !finding.description.trim()) {
      throw new ValidationError('Review finding description cannot be empty', 'AGENT_TASK_REVIEW_FINDING');
    }
  }

  const sourceRefs = new Set(task.sourceRefs);
  for (const sourceRef of task.sourceRefs) await runtime.knowledge.read({ sourceRef });
  if (input.knowledgeQuery) {
    const search = await runtime.knowledge.search({ query: input.knowledgeQuery });
    for (const match of search.data.matches) if (match.sourceRef) sourceRefs.add(match.sourceRef);
    for (const chunk of search.data.chunks) if (chunk.sourceRef) sourceRefs.add(chunk.sourceRef);
  }
  const firstSourceRef = task.sourceRefs[0];
  if (firstSourceRef) {
    const related = await runtime.knowledge.related(firstSourceRef);
    for (const note of related.results) sourceRefs.add(note.sourceRef);
  }

  const evidence = [...sourceRefs];
  const basedOn = [...new Set(input.findings.flatMap((finding) => finding.basedOn ?? []))];
  return runtime.tasks.update(task.id, {
    status: 'review',
    addSourceRefs: evidence,
    addArtifacts: [{
      id: input.artifactId ?? 'review-findings',
      description: describeReview(task.goal, input.findings),
      basedOn: basedOn.length > 0 ? basedOn : evidence
    }]
  }, 'reviewer');
}
