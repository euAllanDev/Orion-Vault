export const AGENT_TASK_STATUSES = Object.freeze([
  'pending', 'discovery', 'planning', 'implementation', 'review', 'completed', 'blocked'
] as const);

export type AgentTaskStatus = typeof AGENT_TASK_STATUSES[number];

/** Caller-declared role or agent name, not an authenticated identity. */
export type AgentTaskActor = string;

export interface AgentTaskArtifact {
  readonly id: string;
  readonly taskId: string;
  readonly description: string;
  /** Optional file path or external result identifier; never automatically opened. */
  readonly reference?: string;
  readonly producedBy: AgentTaskActor;
  readonly basedOn: readonly string[];
}

/** Immutable snapshot owned by an application runtime, not persistent agent memory. */
export interface AgentTaskContext {
  readonly id: string;
  readonly goal: string;
  readonly project?: string;
  readonly constraints: readonly string[];
  readonly status: AgentTaskStatus;
  readonly sourceRefs: readonly string[];
  readonly plan: readonly string[];
  readonly artifacts: readonly AgentTaskArtifact[];
  readonly provenance: {
    readonly createdBy: AgentTaskActor;
    readonly updatedBy: AgentTaskActor;
  };
}
