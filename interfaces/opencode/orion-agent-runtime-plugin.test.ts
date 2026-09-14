import { describe, expect, it, vi } from 'vitest';
import { AgentTaskContextService } from '../../application/services/agent-task-context.service';
import { OrionSourceRegistry } from '../../application/services/orion-source-registry';
import { AgentRuntimeHost, type AgentRuntime } from '../agent/agent-runtime-host';
import { AgentSessionRuntimeBridge } from '../agent/agent-session-runtime-bridge';
import { createOpenCodeAgentRuntimePlugin } from './orion-agent-runtime-plugin';

function fixtureHost(): AgentRuntimeHost {
  const registry = new OrionSourceRegistry();
  const sourceRef = registry.register(0, 'product.md');
  const runtime = {
    knowledge: {
      search: vi.fn(async () => ({ data: { matches: [{ sourceRef }], chunks: [] } })),
      context: vi.fn(), read: vi.fn(async () => ({ note: null })), related: vi.fn(async () => ({ results: [] }))
    },
    tasks: new AgentTaskContextService(registry)
  } as unknown as AgentRuntime;
  return new AgentRuntimeHost(() => runtime);
}

function publicPlugin() {
  return createOpenCodeAgentRuntimePlugin(new AgentSessionRuntimeBridge(fixtureHost)).tool;
}

function context(sessionID: string) {
  return { sessionID } as never;
}

async function invoke(toolDefinition: { execute: (args: never, context: never) => Promise<unknown> }, args: object, sessionID: string) {
  const result = await toolDefinition.execute(args as never, context(sessionID));
  const output = typeof result === 'string'
    ? result
    : (result as { output: string }).output;
  return JSON.parse(output) as { status: string; sourceRefs: string[]; artifacts: { basedOn: string[] }[] };
}

describe('OpenCode agent runtime plugin', () => {
  it('runs complete lifecycle through public tools, including host role aliases and explicit reopen', async () => {
    const tools = publicPlugin();
    await invoke(tools.orion_agent_task_create, { taskId: 'task', goal: 'Implement dashboard' }, 'A');
    expect((await invoke(tools.orion_agent_workflow, { action: 'researcher', taskId: 'task', objective: 'dashboard' }, 'A')).status).toBe('planning');
    expect((await invoke(tools.orion_agent_workflow, { action: 'developer', taskId: 'task' }, 'A')).status).toBe('implementation');
    expect((await invoke(tools.orion_agent_workflow, { action: 'reviewer', taskId: 'task', findings: [{ kind: 'missing', description: 'Empty state missing.' }] }, 'A')).status).toBe('review');
    expect((await invoke(tools.orion_agent_workflow, { action: 'develop', taskId: 'task', reviewArtifactId: 'review-findings-1', implementationReference: 'site-x/src/components/project-workspace.tsx' }, 'A')).status).toBe('implementation');
    expect((await invoke(tools.orion_agent_workflow, { action: 'review', taskId: 'task', artifactId: 'review-2', findings: [{ kind: 'compliant', description: 'Empty state present.' }] }, 'A')).status).toBe('review');
    expect((await invoke(tools.orion_agent_workflow, { action: 'complete', taskId: 'task' }, 'A')).status).toBe('completed');
    expect((await invoke(tools.orion_agent_workflow, { action: 'reopen', taskId: 'task' }, 'A')).status).toBe('pending');
  });

  it('keeps snapshots safe, rejects completed updates, and invalidates disposed sessions', async () => {
    const tools = publicPlugin();
    const created = await invoke(tools.orion_agent_task_create, { taskId: 'task', goal: 'Implement dashboard' }, 'A');
    created.status = 'completed';
    expect((await invoke(tools.orion_agent_workflow, { action: 'research', taskId: 'task', objective: 'dashboard' }, 'A')).status).toBe('planning');
    await invoke(tools.orion_agent_workflow, { action: 'develop', taskId: 'task' }, 'A');
    await invoke(tools.orion_agent_workflow, { action: 'review', taskId: 'task', findings: [{ kind: 'compliant', description: 'Reviewed.' }] }, 'A');
    await invoke(tools.orion_agent_workflow, { action: 'complete', taskId: 'task' }, 'A');
    await expect(invoke(tools.orion_agent_workflow, { action: 'develop', taskId: 'task' }, 'A')).rejects.toThrow('Development requires completed research');
    await tools.orion_agent_session_dispose.execute({} as never, context('A'));
    await expect(invoke(tools.orion_agent_workflow, { action: 'reopen', taskId: 'task' }, 'A')).rejects.toThrow('Agent runtime session is unavailable');
  });

  it('rejects cross-session task and sourceRef access through public tools', async () => {
    const tools = publicPlugin();
    const a = await invoke(tools.orion_agent_task_create, { taskId: 'task-a', goal: 'Implement dashboard' }, 'A');
    expect(a.status).toBe('pending');
    const researchedA = await invoke(tools.orion_agent_workflow, { action: 'research', taskId: 'task-a', objective: 'dashboard' }, 'A');
    await expect(invoke(tools.orion_agent_workflow, { action: 'develop', taskId: 'task-a' }, 'B')).rejects.toThrow('Agent runtime session is unavailable');

    await invoke(tools.orion_agent_task_create, { taskId: 'task-b', goal: 'Implement dashboard' }, 'B');
    await invoke(tools.orion_agent_workflow, { action: 'research', taskId: 'task-b', objective: 'dashboard' }, 'B');
    await invoke(tools.orion_agent_workflow, { action: 'develop', taskId: 'task-b' }, 'B');
    await expect(invoke(tools.orion_agent_workflow, { action: 'review', taskId: 'task-b', findings: [{ kind: 'unknown', description: 'Need evidence.', basedOn: researchedA.sourceRefs }] }, 'B')).rejects.toMatchObject({ code: 'AGENT_TASK_ARTIFACT_SOURCE' });
  });
});
