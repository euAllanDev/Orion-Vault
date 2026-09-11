import type { AgentTaskContext } from '../../domain/ai/entities/agent-task-context';
import { ValidationError } from '../../domain/shared/errors/validation-error';
import type {
  PrepareDevelopmentTaskInput,
  ResearchTaskInput,
  ReviewTaskInput
} from '../../application/services/agent-task-collaboration.service';
import type { AgentRuntimeHost } from './agent-runtime-host';
import {
  createDefaultAgentWorkflowRoles,
  type AgentReviewOutcome,
  type AgentWorkflowRoles
} from './agent-workflow-roles';

export interface AgentWorkflowRunInput {
  readonly taskId: string;
  readonly research?: Omit<ResearchTaskInput, 'taskId'>;
  readonly development?: Omit<PrepareDevelopmentTaskInput, 'taskId'>;
  readonly review?: Omit<ReviewTaskInput, 'taskId'>;
}

export interface AgentWorkflowRunResult {
  readonly task: AgentTaskContext;
  readonly reviewOutcome?: AgentReviewOutcome;
}

function invalidOrder(message: string): never {
  throw new ValidationError(message, 'AGENT_WORKFLOW_ORDER');
}

/** Deterministic coordinator for roles sharing one session-scoped runtime host. */
export class AgentWorkflowOrchestrator {
  constructor(
    private readonly host: AgentRuntimeHost,
    private readonly roles: AgentWorkflowRoles = createDefaultAgentWorkflowRoles()
  ) {}

  async run(input: AgentWorkflowRunInput): Promise<AgentWorkflowRunResult> {
    if (!input.research && !input.development && !input.review) {
      throw new ValidationError('Workflow requires at least one role', 'AGENT_WORKFLOW_EMPTY');
    }

    let task = this.host.getRuntime().tasks.get(input.taskId);
    let reviewOutcome: AgentReviewOutcome | undefined;
    if (input.research) task = await this.research(input.taskId, input.research);
    if (input.development) task = await this.develop(input.taskId, input.development);
    if (input.review) {
      const reviewed = await this.review(input.taskId, input.review);
      task = reviewed.task;
      reviewOutcome = reviewed.reviewOutcome;
    }
    return Object.freeze({ task, reviewOutcome });
  }

  async research(taskId: string, input: Omit<ResearchTaskInput, 'taskId'>): Promise<AgentTaskContext> {
    const runtime = this.host.getRuntime();
    const task = runtime.tasks.get(taskId);
    if (task.status !== 'pending') invalidOrder('Research requires a pending task');
    runtime.tasks.update(taskId, { status: 'discovery' }, 'orchestrator');
    await this.roles.researcher.execute(runtime, { taskId, ...input });
    return this.requireStatus(runtime.tasks.get(taskId), 'planning', 'Research must leave the task ready for planning');
  }

  async develop(taskId: string, input: Omit<PrepareDevelopmentTaskInput, 'taskId'> = {}): Promise<AgentTaskContext> {
    const runtime = this.host.getRuntime();
    const task = runtime.tasks.get(taskId);
    const correction = task.status === 'implementation' && this.latestReviewOutcome(task) === 'FAIL';
    if (task.status !== 'planning' && !correction) invalidOrder('Development requires completed research and planning, or a failed review');
    const artifactId = correction && !input.artifactId
      ? `implementation-plan-${task.artifacts.filter((artifact) => artifact.producedBy === 'developer').length + 1}`
      : input.artifactId;
    await this.roles.developer.execute(runtime, { taskId, ...input, artifactId });
    return this.requireStatus(runtime.tasks.get(taskId), 'implementation', 'Development must leave the task in implementation');
  }

  async review(taskId: string, input: Omit<ReviewTaskInput, 'taskId'>): Promise<AgentWorkflowRunResult> {
    const runtime = this.host.getRuntime();
    const task = runtime.tasks.get(taskId);
    if (task.status !== 'implementation') invalidOrder('Review requires completed development in implementation');
    await this.roles.reviewer.execute(runtime, { taskId, ...input });
    const reviewed = this.requireStatus(runtime.tasks.get(taskId), 'review', 'Review must leave the task in review');
    const reviewOutcome = this.roles.reviewer.classify(input.findings);
    const next = reviewOutcome === 'FAIL'
      ? runtime.tasks.update(taskId, { status: 'implementation' }, 'orchestrator')
      : reviewed;
    return Object.freeze({ task: next, reviewOutcome });
  }

  complete(taskId: string): AgentTaskContext {
    const runtime = this.host.getRuntime();
    const task = runtime.tasks.get(taskId);
    if (task.status !== 'review') invalidOrder('Completion requires a task in review');
    if (this.latestReviewOutcome(task) !== 'PASS') {
      invalidOrder('Completion requires a passing review');
    }
    return runtime.tasks.update(taskId, { status: 'completed' }, 'orchestrator');
  }

  private requireStatus(task: AgentTaskContext, status: AgentTaskContext['status'], message: string): AgentTaskContext {
    if (task.status !== status) invalidOrder(message);
    return task;
  }

  private latestReviewOutcome(task: AgentTaskContext): AgentReviewOutcome | undefined {
    const artifact = [...task.artifacts].reverse().find((candidate) => candidate.producedBy === 'reviewer');
    return artifact?.description.includes('\n\nPASS\n')
      ? 'PASS'
      : artifact?.description.includes('\n\nWARN\n')
        ? 'WARN'
        : artifact?.description.includes('\n\nFAIL\n')
          ? 'FAIL'
          : undefined;
  }
}
