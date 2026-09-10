import { describe, expect, it, vi } from 'vitest';

vi.mock('../../infra/config/app-config', () => ({
  loadAppConfig: () => ({
    vaultRoot: '/vault', writeVaultRoot: undefined, aiProvider: 'noop',
    embeddingsProvider: 'noop', embeddingsCommand: undefined,
    semanticExcludePaths: [], logLevel: 'info', defaultDryRun: true
  })
}));

vi.mock('../../application/services/ai-bridge.service', () => ({
  AiBridgeService: class {
    async search() {
      return {
        provider: 'system', summary: 'Found 1 matching note(s).', actions: [], status: 'success', issues: [],
        data: {
          vaultRoot: '/vault', query: 'architecture', tags: [],
          matches: [{ kind: 'note', path: 'architecture.md', tags: [], score: 1, matchedFields: [] }],
          chunks: [], retrievalMode: 'lexical-only', counts: { notes: 1, matches: 1, chunks: 0 }
        }
      };
    }

    async loadAgentContext() {
      throw new Error('Not used by this test');
    }
  }
}));

import { createAiBridgeRuntime } from './ai-bridge-runtime';
import { AgentTaskContextService } from '../../application/services/agent-task-context.service';
import { ValidationError } from '../../domain/shared/errors/validation-error';

describe('createAiBridgeRuntime task context', () => {
  it('provides an AgentTaskContextService sharing its knowledge source registry', async () => {
    const runtime = createAiBridgeRuntime('/vault');
    const search = await runtime.knowledge.search({ query: 'architecture' });
    const sourceRef = search.data.matches[0]?.sourceRef;
    const task = runtime.tasks.create({ id: 'task', goal: 'Implement architecture' }, 'orion-development');

    if (!sourceRef) throw new Error('Expected a source reference from knowledge');
    expect(runtime.tasks).toBeInstanceOf(AgentTaskContextService);
    expect(runtime.tasks.update(task.id, { addSourceRefs: [sourceRef] }, 'orion-development').sourceRefs).toEqual([sourceRef]);
  });

  it('rejects source references from another runtime', () => {
    const first = createAiBridgeRuntime('/vault');
    const second = createAiBridgeRuntime('/vault');
    const task = first.tasks.create({ id: 'task', goal: 'Implement architecture' }, 'orion-development');
    const foreignRef = second.sourceRegistry.register(0, 'architecture.md');

    expect(() => first.tasks.update(task.id, { addSourceRefs: [foreignRef] }, 'orion-development')).toThrow(ValidationError);
  });

  it('keeps tasks independent within a runtime and separates runtime sessions', () => {
    const first = createAiBridgeRuntime('/vault');
    const second = createAiBridgeRuntime('/vault');
    const firstTask = first.tasks.create({ id: 'first', goal: 'First goal' }, 'orion-development');
    const secondTask = first.tasks.create({ id: 'second', goal: 'Second goal' }, 'orion-development');

    first.tasks.update(firstTask.id, { status: 'planning', plan: ['Plan first'] }, 'orion-development');

    expect(first.tasks.get(secondTask.id)).toMatchObject({ status: 'pending', plan: [] });
    expect(() => second.tasks.get(firstTask.id)).toThrow(ValidationError);
  });
});
