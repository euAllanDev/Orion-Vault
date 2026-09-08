import { describe, expect, it } from 'vitest';
import { AGENT_TASK_STATUSES, type AgentTaskStatus } from '../../../domain/ai/entities/agent-task-context';
import { ValidationError } from '../../../domain/shared/errors/validation-error';
import { AgentTaskContextService } from '../../services/agent-task-context.service';
import { OrionSourceRegistry } from '../../services/orion-source-registry';

function setup() {
  const registry = new OrionSourceRegistry();
  const service = new AgentTaskContextService(registry);
  const task = service.create({ id: 'auth-task', goal: 'Implement authentication' }, 'user');
  return { registry, service, task };
}

describe('AgentTaskContextService', () => {
  it('creates a pending task with minimal context and declared provenance', () => {
    const { service, task } = setup();
    expect(service.get(task.id)).toBe(task);
    expect(task).toEqual({
      id: 'auth-task', goal: 'Implement authentication', project: undefined,
      constraints: [], status: 'pending', sourceRefs: [], plan: [], artifacts: [],
      provenance: { createdBy: 'user', updatedBy: 'user' }
    });
  });

  it('keeps runtimes isolated and rejects duplicate task IDs without replacing state', () => {
    const { service, task } = setup();
    expect(() => service.create({ id: task.id, goal: 'Different goal' }, 'user')).toThrow(ValidationError);
    expect(service.get(task.id)).toBe(task);
    expect(() => new AgentTaskContextService(new OrionSourceRegistry()).get(task.id)).toThrow(ValidationError);
  });

  it.each([
    { id: '', goal: 'Goal' },
    { id: ' ', goal: 'Goal' },
    { id: 'task', goal: ' \n' },
    { id: 'task', goal: 'Goal', project: ' ' },
    { id: 'task', goal: 'Goal', constraints: [''] }
  ])('rejects invalid creation input %j', (input) => {
    const service = new AgentTaskContextService(new OrionSourceRegistry());
    expect(() => service.create(input, 'user')).toThrow(ValidationError);
    expect(() => service.get('task')).toThrow(ValidationError);
  });

  it('rejects empty actors and missing or empty task IDs', () => {
    const { service, task } = setup();
    expect(() => service.create({ id: 'other', goal: 'Goal' }, ' ')).toThrow(ValidationError);
    expect(() => service.update(task.id, { status: 'planning' }, '')).toThrow(ValidationError);
    expect(() => service.get(' ')).toThrow(ValidationError);
    expect(() => service.update('missing', {}, 'developer')).toThrow(ValidationError);
    expect(() => service.reopen('missing', 'developer')).toThrow(ValidationError);
    expect(service.get(task.id)).toBe(task);
  });

  it.each(AGENT_TASK_STATUSES)('accepts known status %s without imposing a workflow', (status) => {
    const { service, task } = setup();
    expect(service.update(task.id, { status }, 'custom-agent').status).toBe(status);
  });

  it.each(['unknown', '', null])('rejects invalid runtime status %j atomically', (status) => {
    const { service, task } = setup();
    expect(() => service.update(task.id, { status: status as AgentTaskStatus }, 'reviewer')).toThrow(ValidationError);
    expect(service.get(task.id)).toBe(task);
  });

  it('associates opaque references from multiple vaults without copying notes', () => {
    const { registry, service, task } = setup();
    const first = registry.register(0, 'architecture.md');
    const second = registry.register(1, 'security.md');
    const updated = service.update(task.id, { addSourceRefs: [first, second, first] }, 'researcher');
    expect(updated.sourceRefs).toEqual([first, second]);
    expect(updated.provenance).toEqual({ createdBy: 'user', updatedBy: 'researcher' });
    expect(JSON.stringify(updated)).not.toContain('architecture.md');
    expect(task.sourceRefs).toEqual([]);
  });

  it.each(['architecture.md', 'orion:src_missing', '', ' '])('rejects unresolved reference %j', (sourceRef) => {
    const { registry, service, task } = setup();
    const valid = registry.register(0, 'valid.md');
    expect(() => service.update(task.id, { addSourceRefs: [valid, sourceRef] }, 'researcher')).toThrow(ValidationError);
    expect(service.get(task.id)).toBe(task);
  });

  it('rejects references belonging to another runtime', () => {
    const { service, task } = setup();
    const foreign = new OrionSourceRegistry().register(0, 'architecture.md');
    expect(() => service.update(task.id, { addSourceRefs: [foreign] }, 'researcher')).toThrow(ValidationError);
  });

  it('replaces and explicitly clears a textual plan', () => {
    const { service, task } = setup();
    const planned = service.update(task.id, { status: 'planning', plan: ['Define flow', 'Implement', 'Test', 'Review'] }, 'developer');
    expect(planned.plan).toHaveLength(4);
    expect(service.update(task.id, { plan: ['Revised step'] }, 'developer').plan).toEqual(['Revised step']);
    expect(service.update(task.id, { plan: [] }, 'developer').plan).toEqual([]);
    expect(planned.plan).toHaveLength(4);
  });

  it('adds artifacts with task identity and author, including same-update evidence', () => {
    const { registry, service, task } = setup();
    const sourceRef = registry.register(0, 'authentication.md');
    const implemented = service.update(task.id, {
      addSourceRefs: [sourceRef],
      addArtifacts: [{ id: 'implementation', description: 'Authentication implementation', reference: 'src/auth.ts', basedOn: [sourceRef, sourceRef] }]
    }, 'developer');
    const reviewed = service.update(task.id, {
      addArtifacts: [{ id: 'test-report', description: 'Tests passed' }]
    }, 'reviewer');
    expect(reviewed.artifacts).toEqual([
      { id: 'implementation', taskId: task.id, description: 'Authentication implementation', reference: 'src/auth.ts', producedBy: 'developer', basedOn: [sourceRef] },
      { id: 'test-report', taskId: task.id, description: 'Tests passed', reference: undefined, producedBy: 'reviewer', basedOn: [] }
    ]);
    expect(implemented.artifacts).toHaveLength(1);
    expect(reviewed.provenance).toEqual({ createdBy: 'user', updatedBy: 'reviewer' });
  });

  it.each([
    { id: ' ', description: 'Result' },
    { id: 'artifact', description: '' },
    { id: 'artifact', description: 'Result', reference: ' ' },
    { id: 'artifact', description: 'Result', basedOn: ['orion:src_missing'] }
  ])('rejects invalid artifact %j without publishing partial changes', (artifact) => {
    const { service, task } = setup();
    expect(() => service.update(task.id, { status: 'review', addArtifacts: [artifact] }, 'developer')).toThrow(ValidationError);
    expect(service.get(task.id)).toBe(task);
  });

  it('requires artifact evidence to be associated with this task, not merely registered', () => {
    const { registry, service, task } = setup();
    const sourceRef = registry.register(0, 'other-task.md');
    expect(() => service.update(task.id, {
      addArtifacts: [{ id: 'artifact', description: 'Result', basedOn: [sourceRef] }]
    }, 'developer')).toThrow(ValidationError);
  });

  it('rejects duplicate artifacts within an update and across updates', () => {
    const { service, task } = setup();
    const artifact = { id: 'result', description: 'Result' };
    expect(() => service.update(task.id, { addArtifacts: [artifact, artifact] }, 'developer')).toThrow(ValidationError);
    expect(service.get(task.id)).toBe(task);
    const updated = service.update(task.id, { addArtifacts: [artifact] }, 'developer');
    expect(() => service.update(task.id, { addArtifacts: [artifact] }, 'reviewer')).toThrow(ValidationError);
    expect(service.get(task.id)).toBe(updated);
  });

  it('validates the whole update before storing any changes', () => {
    const { registry, service, task } = setup();
    const sourceRef = registry.register(0, 'architecture.md');
    expect(() => service.update(task.id, {
      status: 'planning', addSourceRefs: [sourceRef],
      addArtifacts: [{ id: 'result', description: 'Result' }], plan: [' ']
    }, 'developer')).toThrow(ValidationError);
    expect(service.get(task.id)).toBe(task);
  });

  it('defensively copies input and freezes every snapshot layer', () => {
    const { registry, service } = setup();
    const constraints = ['No database'];
    const task = service.create({ id: 'immutable', goal: 'Goal', project: 'Site X', constraints }, 'user');
    const sourceRef = registry.register(0, 'architecture.md');
    const refs = [sourceRef];
    const plan = ['Implement'];
    const artifact = { id: 'result', description: 'Result', basedOn: [sourceRef] };
    const updated = service.update(task.id, { addSourceRefs: refs, plan, addArtifacts: [artifact] }, 'developer');
    constraints.push('Changed');
    refs.length = 0;
    plan[0] = 'Changed';
    artifact.description = 'Changed';
    artifact.basedOn.length = 0;
    expect(updated.constraints).toEqual(['No database']);
    expect(updated.sourceRefs).toEqual([sourceRef]);
    expect(updated.plan).toEqual(['Implement']);
    expect(updated.artifacts[0].description).toBe('Result');
    expect(updated.artifacts[0].basedOn).toEqual([sourceRef]);
    for (const value of [task, task.constraints, task.sourceRefs, task.plan, task.artifacts, task.provenance,
      updated, updated.constraints, updated.sourceRefs, updated.plan, updated.artifacts, updated.artifacts[0], updated.artifacts[0].basedOn, updated.provenance]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(() => { (updated.plan as string[]).push('Bypass'); }).toThrow(TypeError);
    expect(() => { Object.assign(updated, { status: 'completed' }); }).toThrow(TypeError);
  });

  it('requires explicit reopening before any completed-task update', () => {
    const { service, task } = setup();
    expect(() => service.reopen(task.id, 'reviewer')).toThrow(ValidationError);
    const completed = service.update(task.id, {
      status: 'completed', plan: ['Review'], addArtifacts: [{ id: 'report', description: 'Passed' }]
    }, 'reviewer');
    for (const status of AGENT_TASK_STATUSES) {
      expect(() => service.update(task.id, { status }, 'developer')).toThrow(ValidationError);
    }
    expect(() => service.update(task.id, { plan: [] }, 'developer')).toThrow(ValidationError);
    expect(() => service.reopen(task.id, '')).toThrow(ValidationError);
    expect(service.get(task.id)).toBe(completed);
    const reopened = service.reopen(task.id, 'custom-security-agent');
    expect(reopened.status).toBe('pending');
    expect(reopened.artifacts).toBe(completed.artifacts);
    expect(reopened.plan).toBe(completed.plan);
    expect(reopened.provenance).toEqual({ createdBy: 'user', updatedBy: 'custom-security-agent' });
    expect(Object.isFrozen(reopened)).toBe(true);
    expect(Object.isFrozen(reopened.provenance)).toBe(true);
    expect(service.update(task.id, { status: 'discovery' }, 'researcher').status).toBe('discovery');
    expect(completed.status).toBe('completed');
  });
});
