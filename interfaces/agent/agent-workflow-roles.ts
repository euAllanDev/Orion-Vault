import type { AgentTaskContext } from '../../domain/ai/entities/agent-task-context';
import {
  prepareDevelopmentTask,
  researchTask,
  reviewTask,
  type PrepareDevelopmentTaskInput,
  type ResearchTaskInput,
  type ReviewFinding,
  type ReviewTaskInput
} from '../../application/services/agent-task-collaboration.service';
import type { AgentRuntime } from './agent-runtime-host';

export const AGENT_REVIEW_OUTCOMES = ['PASS', 'WARN', 'FAIL'] as const;
export type AgentReviewOutcome = typeof AGENT_REVIEW_OUTCOMES[number];

export interface AgentResearcherRole {
  execute(runtime: AgentRuntime, input: ResearchTaskInput): Promise<AgentTaskContext>;
}

export interface AgentDeveloperRole {
  execute(runtime: AgentRuntime, input: PrepareDevelopmentTaskInput): Promise<AgentTaskContext>;
}

export interface AgentReviewerRole {
  execute(runtime: AgentRuntime, input: ReviewTaskInput): Promise<AgentTaskContext>;
  classify(findings: readonly ReviewFinding[]): AgentReviewOutcome;
}

export interface AgentWorkflowRoles {
  readonly researcher: AgentResearcherRole;
  readonly developer: AgentDeveloperRole;
  readonly reviewer: AgentReviewerRole;
}

export function classifyReviewFindings(findings: readonly ReviewFinding[]): AgentReviewOutcome {
  if (findings.some((finding) => finding.kind === 'divergence' || finding.kind === 'missing')) return 'FAIL';
  if (findings.some((finding) => finding.kind === 'unknown')) return 'WARN';
  return 'PASS';
}

/** Default adapters preserve existing collaboration behavior behind replaceable role contracts. */
export function createDefaultAgentWorkflowRoles(): AgentWorkflowRoles {
  return Object.freeze({
    researcher: Object.freeze({ execute: researchTask }),
    developer: Object.freeze({ execute: prepareDevelopmentTask }),
    reviewer: Object.freeze({ execute: reviewTask, classify: classifyReviewFindings })
  });
}
