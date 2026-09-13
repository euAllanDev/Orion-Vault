import { tool } from '@opencode-ai/plugin';
import { createAgentRuntimeHost } from '../agent/agent-runtime-host';
import { AgentSessionRuntimeBridge } from '../agent/agent-session-runtime-bridge';

const activeVaultRoot = process.env.ORION_VAULT_ROOT?.trim();
if (!activeVaultRoot) throw new Error('OpenCode agent runtime requires an active Orion vault session');
const bridge = new AgentSessionRuntimeBridge(() => createAgentRuntimeHost(activeVaultRoot));

function endedSessionId(event: unknown): string | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const value = event as { type?: unknown; properties?: { info?: { id?: unknown }; sessionID?: unknown; sessionId?: unknown } };
  if (value.type !== 'session.deleted') return undefined;
  const id = value.properties?.info?.id ?? value.properties?.sessionID ?? value.properties?.sessionId;
  return typeof id === 'string' ? id : undefined;
}

function snapshot(task: ReturnType<AgentSessionRuntimeBridge['getTask']>): string {
  return JSON.stringify({ id: task.id, goal: task.goal, project: task.project, constraints: task.constraints, status: task.status, sourceRefs: task.sourceRefs, plan: task.plan, artifacts: task.artifacts, provenance: task.provenance });
}

/** Builds the public OpenCode surface without exposing its session bridge or runtime. */
export function createOpenCodeAgentRuntimePlugin(sessionBridge: AgentSessionRuntimeBridge) {
  return {
  tool: {
    orion_agent_task_create: tool({
      description: 'Creates one task in this OpenCode session runtime. Does not expose runtime internals.',
      args: { taskId: tool.schema.string().min(1), goal: tool.schema.string().min(1), project: tool.schema.string().min(1).optional(), constraints: tool.schema.array(tool.schema.string().min(1)).optional() },
      async execute(args, context) { return snapshot(sessionBridge.createTask(context.sessionID, { id: args.taskId, goal: args.goal, project: args.project, constraints: args.constraints, actor: 'opencode-agent' })); }
    }),
    orion_agent_workflow: tool({
      description: 'Runs research, develop, review, complete, or reopen in this session runtime. Researcher, developer, and reviewer are accepted host role aliases.',
      args: {
        action: tool.schema.enum(['research', 'develop', 'review', 'complete', 'reopen', 'researcher', 'developer', 'reviewer']), taskId: tool.schema.string().min(1), objective: tool.schema.string().min(1).optional(), artifactId: tool.schema.string().min(1).optional(), knowledgeQuery: tool.schema.string().min(1).optional(),
        findings: tool.schema.array(tool.schema.object({ kind: tool.schema.enum(['compliant', 'divergence', 'missing', 'unknown']), description: tool.schema.string().min(1), basedOn: tool.schema.array(tool.schema.string().min(1)).optional() })).optional()
      },
      async execute(args, context) {
        const action = args.action === 'researcher' ? 'research' : args.action === 'developer' ? 'develop' : args.action === 'reviewer' ? 'review' : args.action;
        if (action === 'research') { if (!args.objective) throw new Error('Research requires objective'); return snapshot(await sessionBridge.invoke(context.sessionID, { kind: 'research', taskId: args.taskId, objective: args.objective, artifactId: args.artifactId })); }
        if (action === 'develop') return snapshot(await sessionBridge.invoke(context.sessionID, { kind: 'develop', taskId: args.taskId, artifactId: args.artifactId }));
        if (action === 'review') { if (!args.findings) throw new Error('Review requires findings'); return snapshot(await sessionBridge.invoke(context.sessionID, { kind: 'review', taskId: args.taskId, findings: args.findings, knowledgeQuery: args.knowledgeQuery, artifactId: args.artifactId })); }
        if (action === 'complete') return snapshot(await sessionBridge.invoke(context.sessionID, { kind: 'complete', taskId: args.taskId }));
        if (action === 'reopen') return snapshot(await sessionBridge.invoke(context.sessionID, { kind: 'reopen', taskId: args.taskId, actor: 'opencode-agent' }));
        throw new Error('Unknown workflow action');
      }
    }),
    orion_agent_session_dispose: tool({
      description: 'Disposes this session runtime. Further task access in this session is invalid.', args: {},
      async execute(_args, context) { sessionBridge.disposeSession(context.sessionID); return 'Agent runtime session disposed.'; }
    })
  },
  async event({ event }: { event?: unknown }) {
    const sessionId = endedSessionId(event);
    if (sessionId) sessionBridge.disposeSession(sessionId);
  },
  async dispose() { sessionBridge.dispose(); }
  };
}

export default async () => createOpenCodeAgentRuntimePlugin(bridge);
