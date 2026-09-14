import type { AgentTaskContext, AgentTaskActor } from '../../domain/ai/entities/agent-task-context';
import type { ReviewFinding } from '../../application/services/agent-task-collaboration.service';
import { createAgentRuntimeHost, type AgentRuntimeHost } from './agent-runtime-host';
import { AgentWorkflowOrchestrator } from './agent-workflow-orchestrator';

export interface AgentSessionTaskInput {
  readonly id: string;
  readonly goal: string;
  readonly project?: string;
  readonly constraints?: readonly string[];
  readonly actor: AgentTaskActor;
}

export type AgentSessionWorkflowCommand =
  | { readonly kind: 'research'; readonly taskId: string; readonly objective: string; readonly artifactId?: string }
  | { readonly kind: 'develop'; readonly taskId: string; readonly artifactId?: string; readonly reviewArtifactId?: string; readonly implementationReference?: string }
  | { readonly kind: 'review'; readonly taskId: string; readonly findings: readonly ReviewFinding[]; readonly knowledgeQuery?: string; readonly artifactId?: string }
  | { readonly kind: 'complete'; readonly taskId: string }
  | { readonly kind: 'reopen'; readonly taskId: string; readonly actor: AgentTaskActor };

type Session = Readonly<{ host: AgentRuntimeHost; workflow: AgentWorkflowOrchestrator }>;

/** Host-owned, in-process session bridge. It exposes workflow commands, never a runtime or registry. */
export class AgentSessionRuntimeBridge {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly hostFactory: () => AgentRuntimeHost = createAgentRuntimeHost) {}

  createTask(sessionId: string, input: AgentSessionTaskInput): AgentTaskContext {
    const runtime = this.open(sessionId).host.getRuntime();
    return runtime.tasks.create({
      id: input.id,
      goal: input.goal,
      ...(input.project ? { project: input.project } : {}),
      constraints: input.constraints ?? []
    }, input.actor);
  }

  getTask(sessionId: string, taskId: string): AgentTaskContext {
    return this.require(sessionId).host.getRuntime().tasks.get(taskId);
  }

  async invoke(sessionId: string, command: AgentSessionWorkflowCommand): Promise<AgentTaskContext> {
    const workflow = this.require(sessionId).workflow;
    switch (command.kind) {
      case 'research':
        return workflow.research(command.taskId, { objective: command.objective, artifactId: command.artifactId });
      case 'develop':
        return workflow.develop(command.taskId, {
          artifactId: command.artifactId,
          reviewArtifactId: command.reviewArtifactId,
          implementationReference: command.implementationReference
        });
      case 'review': {
        const task = this.getTask(sessionId, command.taskId);
        const artifactId = command.artifactId ?? `review-findings-${task.artifacts.filter((artifact) => artifact.producedBy === 'reviewer').length + 1}`;
        return (await workflow.review(command.taskId, {
          findings: command.findings,
          knowledgeQuery: command.knowledgeQuery,
          artifactId
        })).task;
      }
      case 'complete':
        return workflow.complete(command.taskId);
      case 'reopen':
        return this.require(sessionId).host.getRuntime().tasks.reopen(command.taskId, command.actor);
    }
  }

  disposeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    session.host.dispose();
  }

  dispose(): void {
    for (const sessionId of [...this.sessions.keys()]) this.disposeSession(sessionId);
  }

  private open(sessionId: string): Session {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    if (!sessionId.trim()) throw new Error('Agent session ID is required');
    const host = this.hostFactory();
    const session = Object.freeze({ host, workflow: new AgentWorkflowOrchestrator(host) });
    this.sessions.set(sessionId, session);
    return session;
  }

  private require(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Agent runtime session is unavailable');
    return session;
  }
}
