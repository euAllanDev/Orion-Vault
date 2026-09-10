import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../../domain/shared/errors/validation-error';
import { AgentTaskContextService } from '../../services/agent-task-context.service';
import { OrionSourceRegistry } from '../../services/orion-source-registry';
import { AgentRuntimeHost, type AgentRuntime } from '../../../interfaces/agent/agent-runtime-host';
import { prepareDevelopmentTask, researchTask } from '../../services/agent-task-collaboration.service';

function createRuntime(): { readonly host: AgentRuntimeHost; readonly tasks: AgentTaskContextService; readonly search: ReturnType<typeof vi.fn>; readonly read: ReturnType<typeof vi.fn> } {
  const registry = new OrionSourceRegistry();
  const dashboardRef = registry.register(0, 'site-x/pages/dashboard.md');
  const architectureRef = registry.register(0, 'site-x/06-architecture.md');
  const tasks = new AgentTaskContextService(registry);
  const read = vi.fn(async () => ({ note: null, vaultAvailable: true }));
  const search = vi.fn(async () => ({ data: { matches: [{ sourceRef: dashboardRef }], chunks: [{ sourceRef: architectureRef }] } }));
  const runtime = {
    knowledge: {
      search,
      context: vi.fn(),
      related: vi.fn(async () => ({ status: 'success' as const, results: [] })),
      read
    },
    tasks
  } as unknown as AgentRuntime;
  return { host: new AgentRuntimeHost(() => runtime), tasks, search, read };
}

describe('agent task collaboration phases', () => {
  it('passes one task and its runtime-scoped evidence from research to development', async () => {
    const { host, tasks, search, read } = createRuntime();
    const pending = tasks.create({ id: 'site-x-dashboard', goal: 'Preparar implementação do dashboard do Site X.', project: 'Site X' }, 'orion-development');
    tasks.update('site-x-dashboard', { status: 'discovery' }, 'researcher');

    const researched = await researchTask(host.getRuntime(), { taskId: 'site-x-dashboard', objective: 'Site X dashboard architecture pages design system components' });
    const prepared = await prepareDevelopmentTask(host.getRuntime(), { taskId: 'site-x-dashboard' });

    expect(pending.status).toBe('pending');
    expect(researched.status).toBe('planning');
    expect(prepared.status).toBe('implementation');
    expect(prepared.sourceRefs).toHaveLength(2);
    expect(search).toHaveBeenCalledWith({ query: 'Site X dashboard architecture pages design system components' });
    expect(read).toHaveBeenCalledWith({ sourceRef: prepared.sourceRefs[0] });
    expect(prepared.plan).toHaveLength(3);
    expect(prepared.artifacts).toEqual([
      expect.objectContaining({ id: 'research-findings', producedBy: 'researcher', basedOn: prepared.sourceRefs }),
      expect.objectContaining({ id: 'implementation-plan', producedBy: 'developer', basedOn: prepared.sourceRefs })
    ]);
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.artifacts)).toBe(true);
    expect(() => { (prepared.plan as string[]).push('Mutate'); }).toThrow(TypeError);
  });

  it('rejects a research sourceRef when a developer phase uses another runtime', async () => {
    const first = createRuntime();
    const second = createRuntime();
    first.tasks.create({ id: 'site-x-dashboard', goal: 'Prepare dashboard' }, 'orion-development');
    first.tasks.update('site-x-dashboard', { status: 'discovery' }, 'researcher');
    second.tasks.create({ id: 'site-x-dashboard', goal: 'Prepare dashboard' }, 'orion-development');
    second.tasks.update('site-x-dashboard', { status: 'planning' }, 'researcher');

    const researched = await researchTask(first.host.getRuntime(), { taskId: 'site-x-dashboard', objective: 'dashboard' });
    const sourceRefFromFirstRuntime = researched.sourceRefs[0];

    expect(() => second.tasks.update('site-x-dashboard', { addSourceRefs: [sourceRefFromFirstRuntime] }, 'developer')).toThrow(ValidationError);
    expect(second.tasks.get('site-x-dashboard').sourceRefs).toEqual([]);
  });

  it('requires research before development and retains task status when rejected', async () => {
    const { host, tasks } = createRuntime();
    tasks.create({ id: 'site-x-dashboard', goal: 'Prepare dashboard' }, 'orion-development');
    tasks.update('site-x-dashboard', { status: 'discovery' }, 'researcher');

    await expect(prepareDevelopmentTask(host.getRuntime(), { taskId: 'site-x-dashboard' })).rejects.toMatchObject({ code: 'AGENT_TASK_RESEARCH_REQUIRED' });
    expect(tasks.get('site-x-dashboard').status).toBe('discovery');
  });
});
