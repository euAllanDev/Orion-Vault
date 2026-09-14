import { describe, expect, it, vi } from 'vitest';
import { AgentTaskContextService } from '../../application/services/agent-task-context.service';
import { OrionSourceRegistry } from '../../application/services/orion-source-registry';
import { AgentRuntimeHost, type AgentRuntime } from './agent-runtime-host';
import { AgentSessionRuntimeBridge } from './agent-session-runtime-bridge';

function fixtureHost(): AgentRuntimeHost {
  const registry = new OrionSourceRegistry();
  const refs = [registry.register(0, 'product.md')];
  const runtime = {
    knowledge: {
      search: vi.fn(async () => ({ data: { matches: [{ sourceRef: refs[0] }], chunks: [] } })),
      context: vi.fn(), read: vi.fn(async () => ({ note: null })), related: vi.fn(async () => ({ results: [] }))
    },
    tasks: new AgentTaskContextService(registry)
  } as unknown as AgentRuntime;
  return new AgentRuntimeHost(() => runtime);
}

describe('AgentSessionRuntimeBridge', () => {
  it('owns one runtime per session and keeps tasks and sourceRefs isolated', async () => {
    const bridge = new AgentSessionRuntimeBridge(fixtureHost);
    bridge.createTask('A', { id: 'task', goal: 'Implement dashboard', actor: 'agent' });
    bridge.createTask('B', { id: 'task', goal: 'Implement dashboard', actor: 'agent' });
    const researched = await bridge.invoke('A', { kind: 'research', taskId: 'task', objective: 'dashboard' });

    expect(researched.sourceRefs).toHaveLength(1);
    expect(() => bridge.getTask('B', 'missing')).toThrow();
    expect(bridge.getTask('B', 'task').sourceRefs).toEqual([]);
    await bridge.invoke('A', { kind: 'develop', taskId: 'task' });
    const reviewed = await bridge.invoke('A', { kind: 'review', taskId: 'task', findings: [{ kind: 'compliant', description: 'Matches source.', basedOn: researched.sourceRefs }] });
    expect(reviewed.sourceRefs).toEqual(researched.sourceRefs);
  });

  it('keeps FAIL review open, requires its artifact for correction, and keeps WARN open', async () => {
    const bridge = new AgentSessionRuntimeBridge(fixtureHost);
    bridge.createTask('A', { id: 'task', goal: 'Implement dashboard', actor: 'agent' });
    await bridge.invoke('A', { kind: 'research', taskId: 'task', objective: 'dashboard' });
    await bridge.invoke('A', { kind: 'develop', taskId: 'task' });
    expect((await bridge.invoke('A', { kind: 'review', taskId: 'task', findings: [{ kind: 'missing', description: 'Missing state.' }] })).status).toBe('review');
    await expect(bridge.invoke('A', { kind: 'develop', taskId: 'task' })).rejects.toThrow('Correction requires the latest failed review artifact');
    await bridge.invoke('A', { kind: 'develop', taskId: 'task', reviewArtifactId: 'review-findings-1', implementationReference: 'site-x/src/components/project-workspace.tsx' });
    expect((await bridge.invoke('A', { kind: 'review', taskId: 'task', findings: [{ kind: 'unknown', description: 'No audit evidence.' }] })).status).toBe('review');
    await expect(bridge.invoke('A', { kind: 'complete', taskId: 'task' })).rejects.toThrow();
  });

  it('completes only after PASS, creates no artifact when research fails, and invalidates disposed sessions', async () => {
    const failing = new AgentSessionRuntimeBridge(() => new AgentRuntimeHost(() => ({ knowledge: { search: async () => { throw new Error('unavailable'); } }, tasks: new AgentTaskContextService(new OrionSourceRegistry()) } as unknown as AgentRuntime)));
    failing.createTask('failure', { id: 'task', goal: 'Implement dashboard', actor: 'agent' });
    await expect(failing.invoke('failure', { kind: 'research', taskId: 'task', objective: 'dashboard' })).rejects.toThrow('unavailable');
    expect(failing.getTask('failure', 'task').artifacts).toEqual([]);

    const bridge = new AgentSessionRuntimeBridge(fixtureHost);
    bridge.createTask('A', { id: 'task', goal: 'Implement dashboard', actor: 'agent' });
    await bridge.invoke('A', { kind: 'research', taskId: 'task', objective: 'dashboard' });
    await bridge.invoke('A', { kind: 'develop', taskId: 'task' });
    await bridge.invoke('A', { kind: 'review', taskId: 'task', findings: [{ kind: 'compliant', description: 'Complete.' }] });
    expect((await bridge.invoke('A', { kind: 'complete', taskId: 'task' })).status).toBe('completed');
    bridge.disposeSession('A');
    expect(() => bridge.getTask('A', 'task')).toThrow('Agent runtime session is unavailable');
  });
});
