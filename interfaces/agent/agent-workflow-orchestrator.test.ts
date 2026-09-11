import { describe, expect, it, vi } from 'vitest';
import { AgentTaskContextService } from '../../application/services/agent-task-context.service';
import { OrionSourceRegistry } from '../../application/services/orion-source-registry';
import { ValidationError } from '../../domain/shared/errors/validation-error';
import { AgentRuntimeHost, type AgentRuntime } from './agent-runtime-host';
import { AgentWorkflowOrchestrator } from './agent-workflow-orchestrator';
import { createDefaultAgentWorkflowRoles, type AgentWorkflowRoles } from './agent-workflow-roles';

function createFixture(): {
  readonly host: AgentRuntimeHost;
  readonly tasks: AgentTaskContextService;
  readonly sourceRefs: readonly string[];
  readonly runtime: AgentRuntime;
} {
  const registry = new OrionSourceRegistry();
  const sourceRefs = [registry.register(0, 'product/dashboard.md'), registry.register(0, 'architecture/dashboard.md')];
  const tasks = new AgentTaskContextService(registry);
  const runtime = {
    knowledge: {
      search: vi.fn(async () => ({ data: { matches: [{ sourceRef: sourceRefs[0] }], chunks: [{ sourceRef: sourceRefs[1] }] } })),
      context: vi.fn(),
      read: vi.fn(async () => ({ note: null, vaultAvailable: true })),
      related: vi.fn(async () => ({ status: 'success' as const, results: [] }))
    },
    tasks
  } as unknown as AgentRuntime;
  return { host: new AgentRuntimeHost(() => runtime), tasks, sourceRefs, runtime };
}

function createTask(tasks: AgentTaskContextService, id = 'dashboard'): void {
  tasks.create({ id, goal: 'Implement dashboard' }, 'orion-development');
}

describe('AgentWorkflowOrchestrator', () => {
  it('runs Researcher, Developer, then Reviewer over one runtime and shared sourceRefs', async () => {
    const fixture = createFixture();
    createTask(fixture.tasks);
    const defaults = createDefaultAgentWorkflowRoles();
    const order: string[] = [];
    const runtimes: AgentRuntime[] = [];
    const roles: AgentWorkflowRoles = {
      researcher: { async execute(runtime, input) { order.push('researcher'); runtimes.push(runtime); return defaults.researcher.execute(runtime, input); } },
      developer: { async execute(runtime, input) { order.push('developer'); runtimes.push(runtime); return defaults.developer.execute(runtime, input); } },
      reviewer: {
        async execute(runtime, input) { order.push('reviewer'); runtimes.push(runtime); return defaults.reviewer.execute(runtime, input); },
        classify: defaults.reviewer.classify
      }
    };
    const workflow = new AgentWorkflowOrchestrator(fixture.host, roles);

    const result = await workflow.run({
      taskId: 'dashboard',
      research: { objective: 'dashboard' },
      development: {},
      review: { findings: [{ kind: 'compliant', description: 'Implementation matches documented dashboard behavior.', basedOn: fixture.sourceRefs }] }
    });

    expect(order).toEqual(['researcher', 'developer', 'reviewer']);
    expect(runtimes).toEqual([fixture.runtime, fixture.runtime, fixture.runtime]);
    expect(result.reviewOutcome).toBe('PASS');
    expect(result.task.status).toBe('review');
    expect(result.task.sourceRefs).toEqual(fixture.sourceRefs);
    expect(result.task.artifacts.map((artifact) => artifact.producedBy)).toEqual(['researcher', 'developer', 'reviewer']);
  });

  it('supports research-only and research plus development partial runs', async () => {
    const fixture = createFixture();
    createTask(fixture.tasks, 'research-only');
    createTask(fixture.tasks, 'research-development');
    const workflow = new AgentWorkflowOrchestrator(fixture.host);

    const researched = await workflow.run({ taskId: 'research-only', research: { objective: 'dashboard' } });
    const developed = await workflow.run({ taskId: 'research-development', research: { objective: 'dashboard' }, development: {} });

    expect(researched.task.status).toBe('planning');
    expect(researched.task.artifacts).toHaveLength(1);
    expect(developed.task.status).toBe('implementation');
    expect(developed.task.artifacts).toHaveLength(2);
  });

  it('rejects roles outside required order without changing task state', async () => {
    const fixture = createFixture();
    createTask(fixture.tasks);
    const workflow = new AgentWorkflowOrchestrator(fixture.host);

    await expect(workflow.develop('dashboard')).rejects.toMatchObject({ code: 'AGENT_WORKFLOW_ORDER' });
    await expect(workflow.review('dashboard', { findings: [] })).rejects.toMatchObject({ code: 'AGENT_WORKFLOW_ORDER' });
    expect(fixture.tasks.get('dashboard')).toMatchObject({ status: 'pending', artifacts: [] });
  });

  it('returns FAIL review to implementation and permits deterministic correction review', async () => {
    const fixture = createFixture();
    createTask(fixture.tasks);
    const workflow = new AgentWorkflowOrchestrator(fixture.host);
    await workflow.run({ taskId: 'dashboard', research: { objective: 'dashboard' }, development: {} });

    const failed = await workflow.review('dashboard', { findings: [{ kind: 'missing', description: 'Empty state is missing.' }] });
    const corrected = await workflow.develop('dashboard');
    const passed = await workflow.review('dashboard', { artifactId: 'review-corrected', findings: [{ kind: 'compliant', description: 'Empty state is present.' }] });

    expect(failed).toMatchObject({ reviewOutcome: 'FAIL', task: { status: 'implementation' } });
    expect(corrected.artifacts.at(-1)).toMatchObject({ id: 'implementation-plan-2', producedBy: 'developer' });
    expect(passed).toMatchObject({ reviewOutcome: 'PASS', task: { status: 'review' } });
  });

  it('keeps WARN in review and permits explicit completion only after PASS', async () => {
    const fixture = createFixture();
    createTask(fixture.tasks);
    createTask(fixture.tasks, 'passing-dashboard');
    const workflow = new AgentWorkflowOrchestrator(fixture.host);
    await workflow.run({ taskId: 'dashboard', research: { objective: 'dashboard' }, development: {} });

    const warning = await workflow.review('dashboard', { findings: [{ kind: 'unknown', description: 'Accessibility behavior is undocumented.' }] });
    expect(warning).toMatchObject({ reviewOutcome: 'WARN', task: { status: 'review' } });
    expect(() => workflow.complete('dashboard')).toThrow(ValidationError);

    await workflow.run({
      taskId: 'passing-dashboard',
      research: { objective: 'dashboard' },
      development: {},
      review: { artifactId: 'review-passing', findings: [{ kind: 'compliant', description: 'Implementation passes review.' }] }
    });
    expect(workflow.complete('passing-dashboard').status).toBe('completed');
    await expect(workflow.research('passing-dashboard', { objective: 'dashboard' })).rejects.toMatchObject({ code: 'AGENT_WORKFLOW_ORDER' });
  });

  it('reviews an existing implementation task in isolation', async () => {
    const fixture = createFixture();
    createTask(fixture.tasks);
    fixture.tasks.update('dashboard', {
      status: 'implementation',
      addSourceRefs: fixture.sourceRefs,
      addArtifacts: [{ id: 'implemented-dashboard', description: 'Dashboard implementation exists.', reference: 'src/dashboard.ts', basedOn: fixture.sourceRefs }]
    }, 'developer');
    const workflow = new AgentWorkflowOrchestrator(fixture.host);

    const result = await workflow.review('dashboard', { findings: [{ kind: 'compliant', description: 'Implementation inspected.' }] });

    expect(result).toMatchObject({ reviewOutcome: 'PASS', task: { status: 'review' } });
  });

  it('does not create artifacts when a role fails before producing work', async () => {
    const fixture = createFixture();
    createTask(fixture.tasks);
    const defaults = createDefaultAgentWorkflowRoles();
    const workflow = new AgentWorkflowOrchestrator(fixture.host, {
      ...defaults,
      researcher: { async execute() { throw new Error('Orion unavailable'); } }
    });

    await expect(workflow.research('dashboard', { objective: 'dashboard' })).rejects.toThrow('Orion unavailable');
    expect(fixture.tasks.get('dashboard')).toMatchObject({ status: 'discovery', sourceRefs: [], artifacts: [] });
  });

  it('does not accept sourceRefs from another runtime', async () => {
    const first = createFixture();
    const second = createFixture();
    createTask(first.tasks);
    createTask(second.tasks);
    const sourceRef = (await new AgentWorkflowOrchestrator(first.host).research('dashboard', { objective: 'dashboard' })).sourceRefs[0];

    expect(() => second.tasks.update('dashboard', { addSourceRefs: [sourceRef] }, 'developer')).toThrow(ValidationError);
    expect(second.tasks.get('dashboard').sourceRefs).toEqual([]);
  });
});
