import {
  AGENT_TASK_STATUSES,
  type AgentTaskActor,
  type AgentTaskArtifact,
  type AgentTaskContext,
  type AgentTaskStatus
} from '../../domain/ai/entities/agent-task-context';
import { ValidationError } from '../../domain/shared/errors/validation-error';
import { EntityId } from '../../domain/shared/value-objects/entity-id';
import type { OrionSourceRegistry } from './orion-source-registry';

export interface CreateAgentTaskInput {
  readonly id: string;
  readonly goal: string;
  readonly project?: string;
  readonly constraints?: readonly string[];
}

export interface UpdateAgentTaskInput {
  readonly status?: AgentTaskStatus;
  readonly addSourceRefs?: readonly string[];
  /** Replaces the textual plan; an empty array explicitly clears it. */
  readonly plan?: readonly string[];
  readonly addArtifacts?: readonly {
    readonly id: string;
    readonly description: string;
    readonly reference?: string;
    readonly basedOn?: readonly string[];
  }[];
}

function nonEmpty(value: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} cannot be empty`, 'AGENT_TASK_INVALID_TEXT');
  }
  return value;
}

/** One instance per runtime. Share it with the knowledge facade's source registry. */
export class AgentTaskContextService {
  private readonly tasks = new Map<string, AgentTaskContext>();

  constructor(private readonly sourceRegistry: Pick<OrionSourceRegistry, 'resolve'>) {}

  create(input: CreateAgentTaskInput, actor: AgentTaskActor): AgentTaskContext {
    const id = new EntityId(nonEmpty(input.id, 'Task id')).value;
    if (this.tasks.has(id)) {
      throw new ValidationError('Task id already exists', 'AGENT_TASK_DUPLICATE');
    }
    const createdBy = nonEmpty(actor, 'Actor');
    const task: AgentTaskContext = Object.freeze({
      id,
      goal: nonEmpty(input.goal, 'Goal'),
      project: input.project === undefined ? undefined : nonEmpty(input.project, 'Project'),
      constraints: Object.freeze((input.constraints ?? []).map((value) => nonEmpty(value, 'Constraint'))),
      status: 'pending',
      sourceRefs: Object.freeze([]),
      plan: Object.freeze([]),
      artifacts: Object.freeze([]),
      provenance: Object.freeze({ createdBy, updatedBy: createdBy })
    });
    this.tasks.set(id, task);
    return task;
  }

  get(id: string): AgentTaskContext {
    new EntityId(nonEmpty(id, 'Task id'));
    const task = this.tasks.get(id);
    if (!task) throw new ValidationError('Task not found', 'AGENT_TASK_NOT_FOUND');
    return task;
  }

  update(id: string, input: UpdateAgentTaskInput, actor: AgentTaskActor): AgentTaskContext {
    const current = this.get(id);
    if (current.status === 'completed') {
      throw new ValidationError('Reopen the completed task before updating it', 'AGENT_TASK_COMPLETED');
    }
    const updatedBy = nonEmpty(actor, 'Actor');
    const status = input.status === undefined ? current.status : input.status;
    if (!AGENT_TASK_STATUSES.includes(status)) {
      throw new ValidationError('Unknown task status', 'AGENT_TASK_INVALID_STATUS');
    }

    // Resolution reuses Orion's opaque-reference contract instead of inventing another ID format.
    const sourceRefs = new Set(current.sourceRefs);
    for (const sourceRef of input.addSourceRefs ?? []) {
      if (!this.sourceRegistry.resolve(nonEmpty(sourceRef, 'Source reference'))) {
        throw new ValidationError('Unknown runtime source reference', 'AGENT_TASK_UNKNOWN_SOURCE');
      }
      sourceRefs.add(sourceRef);
    }

    const artifactIds = new Set(current.artifacts.map((artifact) => artifact.id));
    const additions: AgentTaskArtifact[] = (input.addArtifacts ?? []).map((inputArtifact) => {
      const artifactId = new EntityId(nonEmpty(inputArtifact.id, 'Artifact id')).value;
      if (artifactIds.has(artifactId)) {
        throw new ValidationError('Artifact id already exists in this task', 'AGENT_TASK_DUPLICATE_ARTIFACT');
      }
      artifactIds.add(artifactId);
      const basedOn = [...new Set(inputArtifact.basedOn ?? [])];
      if (basedOn.some((sourceRef) => !sourceRefs.has(sourceRef))) {
        throw new ValidationError('Artifact sources must belong to the task', 'AGENT_TASK_ARTIFACT_SOURCE');
      }
      return Object.freeze({
        id: artifactId,
        taskId: current.id,
        description: nonEmpty(inputArtifact.description, 'Artifact description'),
        reference: inputArtifact.reference === undefined ? undefined : nonEmpty(inputArtifact.reference, 'Artifact reference'),
        producedBy: updatedBy,
        basedOn: Object.freeze(basedOn)
      });
    });

    // Validate the whole update before publishing a new snapshot; failures leave the task unchanged.
    const task: AgentTaskContext = Object.freeze({
      ...current,
      status,
      sourceRefs: Object.freeze([...sourceRefs]),
      plan: input.plan === undefined ? current.plan : Object.freeze(input.plan.map((step) => nonEmpty(step, 'Plan step'))),
      artifacts: Object.freeze([...current.artifacts, ...additions]),
      provenance: Object.freeze({ ...current.provenance, updatedBy })
    });
    this.tasks.set(id, task);
    return task;
  }

  /** Explicitly returns a completed task to pending, preserving evidence and artifacts. */
  reopen(id: string, actor: AgentTaskActor): AgentTaskContext {
    const current = this.get(id);
    if (current.status !== 'completed') {
      throw new ValidationError('Only completed tasks can be reopened', 'AGENT_TASK_NOT_COMPLETED');
    }
    const task: AgentTaskContext = Object.freeze({
      ...current,
      status: 'pending',
      provenance: Object.freeze({ ...current.provenance, updatedBy: nonEmpty(actor, 'Actor') })
    });
    this.tasks.set(id, task);
    return task;
  }
}
