import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../../domain/shared/errors/validation-error';
import { AgentTaskContextService } from '../../services/agent-task-context.service';
import { OrionSourceRegistry } from '../../services/orion-source-registry';
import { AgentRuntimeHost, type AgentRuntime } from '../../../interfaces/agent/agent-runtime-host';
import { prepareDevelopmentTask, researchTask, reviewTask } from '../../services/agent-task-collaboration.service';

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

  it('reviews implementation against same-runtime Orion sources and creates a reviewer artifact', async () => {
    const { host, tasks, read } = createRuntime();
    tasks.create({ id: 'site-x-review', goal: 'Implement dashboard', constraints: ['Use Site X documentation'] }, 'orion-development');
    tasks.update('site-x-review', { status: 'discovery' }, 'researcher');
    await researchTask(host.getRuntime(), { taskId: 'site-x-review', objective: 'dashboard' });
    await prepareDevelopmentTask(host.getRuntime(), { taskId: 'site-x-review' });

    const reviewed = await reviewTask(host.getRuntime(), {
      taskId: 'site-x-review',
      findings: [{ kind: 'compliant', description: 'Dashboard artifact follows associated documentation.', basedOn: tasks.get('site-x-review').sourceRefs }]
    });

    expect(reviewed.status).toBe('review');
    expect(read).toHaveBeenCalledWith({ sourceRef: reviewed.sourceRefs[0] });
    expect(reviewed.artifacts.at(-1)).toMatchObject({
      id: 'review-findings', producedBy: 'reviewer', description: expect.stringContaining('PASS'), basedOn: reviewed.sourceRefs
    });
    expect(Object.isFrozen(reviewed.artifacts.at(-1))).toBe(true);
  });

  it.each([
    ['compliant', 'PASS', 'Compliant'],
    ['divergence', 'FAIL', 'Divergence'],
    ['missing', 'FAIL', 'Missing'],
    ['unknown', 'WARN', 'Unknown']
  ] as const)('records %s findings without completing the task', async (kind, result, label) => {
    const { host, tasks } = createRuntime();
    tasks.create({ id: `review-${kind}`, goal: 'Implement dashboard' }, 'orion-development');
    tasks.update(`review-${kind}`, { status: 'implementation', addArtifacts: [{ id: 'implementation', description: 'Actual implementation inspected', reference: 'src/dashboard.ts' }] }, 'developer');

    const reviewed = await reviewTask(host.getRuntime(), {
      taskId: `review-${kind}`,
      findings: [{ kind, description: `${label} result from actual inspection.` }]
    });

    expect(reviewed.status).toBe('review');
    expect(reviewed.artifacts.at(-1)?.description).toContain(result);
    expect(reviewed.artifacts.at(-1)?.description).toContain(label);
  });

  it('allows explicit review to implementation to review correction loop', async () => {
    const { host, tasks } = createRuntime();
    tasks.create({ id: 'review-loop', goal: 'Implement dashboard' }, 'orion-development');
    tasks.update('review-loop', { status: 'implementation', addArtifacts: [{ id: 'implementation-v1', description: 'Implementation inspected', reference: 'src/dashboard.ts' }] }, 'developer');
    await reviewTask(host.getRuntime(), { taskId: 'review-loop', findings: [{ kind: 'missing', description: 'Required empty state is absent.' }] });
    tasks.update('review-loop', { status: 'implementation', addArtifacts: [{ id: 'implementation-v2', description: 'Empty state implemented', reference: 'src/dashboard.ts' }] }, 'developer');

    const reviewed = await reviewTask(host.getRuntime(), { taskId: 'review-loop', artifactId: 'review-findings-v2', findings: [{ kind: 'compliant', description: 'Required empty state is implemented.' }] });
    expect(reviewed.status).toBe('review');
    expect(reviewed.artifacts.filter((artifact) => artifact.producedBy === 'reviewer')).toHaveLength(2);
  });

  it('adds a newly discovered same-runtime source during review and rejects foreign references', async () => {
    const first = createRuntime();
    const second = createRuntime();
    first.tasks.create({ id: 'review-isolation', goal: 'Implement dashboard' }, 'orion-development');
    first.tasks.update('review-isolation', { status: 'discovery' }, 'researcher');
    await researchTask(first.host.getRuntime(), { taskId: 'review-isolation', objective: 'dashboard' });
    await prepareDevelopmentTask(first.host.getRuntime(), { taskId: 'review-isolation' });
    const sourceRefFromFirstRuntime = first.tasks.get('review-isolation').sourceRefs[0];
    second.tasks.create({ id: 'review-isolation', goal: 'Implement dashboard' }, 'orion-development');
    second.tasks.update('review-isolation', { status: 'implementation', addArtifacts: [{ id: 'implementation', description: 'Implementation inspected', reference: 'src/dashboard.ts' }] }, 'developer');

    await expect(reviewTask(second.host.getRuntime(), {
      taskId: 'review-isolation',
      findings: [{ kind: 'unknown', description: 'Need external evidence.', basedOn: [sourceRefFromFirstRuntime] }]
    })).rejects.toMatchObject({ code: 'AGENT_TASK_ARTIFACT_SOURCE' });
    expect(second.tasks.get('review-isolation').status).toBe('implementation');

    const reviewed = await reviewTask(first.host.getRuntime(), {
      taskId: 'review-isolation', knowledgeQuery: 'dashboard',
      artifactId: 'review-with-discovery', findings: [{ kind: 'unknown', description: 'No documented behavior for this edge case.' }]
    });
    expect(reviewed.sourceRefs).toHaveLength(2);
  });
});
