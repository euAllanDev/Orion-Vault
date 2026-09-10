import { describe, expect, it } from 'vitest';
import { AgentTaskContextService } from '../../application/services/agent-task-context.service';
import { OrionKnowledgeFacade } from '../../application/services/orion-knowledge-facade';
import { OrionSourceRegistry } from '../../application/services/orion-source-registry';
import { ValidationError } from '../../domain/shared/errors/validation-error';
import { AgentRuntimeHost, createAgentRuntime, type AgentRuntime } from './agent-runtime-host';

function createRuntime(): AgentRuntime {
  const sourceRegistry = new OrionSourceRegistry();
  const knowledge = new OrionKnowledgeFacade({
    service: {
      async search() {
        return {
          provider: 'system', summary: 'Found 1 matching note(s).', actions: [], status: 'success' as const, issues: [],
          data: {
            vaultRoot: '/private/vault', query: 'architecture', tags: [],
            matches: [{ kind: 'note' as const, path: 'architecture.md', tags: [], score: 1, matchedFields: [] }],
            chunks: [], retrievalMode: 'lexical-only' as const, counts: { notes: 1, matches: 1, chunks: 0 }
          }
        };
      },
      async loadAgentContext() {
        throw new Error('Not used by this test');
      }
    },
    noteSource: { async getNote() { return null; }, async listNotes() { return []; } },
    vaultRoots: ['/private/vault'],
    sourceRegistry
  });
  const tasks = new AgentTaskContextService(sourceRegistry);
  return createAgentRuntime(knowledge, tasks);
}

describe('AgentRuntimeHost', () => {
  it('injects one real runtime surface for a development skill flow', async () => {
    const host = new AgentRuntimeHost(createRuntime);
    const runtime = host.getRuntime();
    const search = await runtime.knowledge.search({ query: 'architecture' });
    const sourceRef = search.data.matches[0]?.sourceRef;
    if (!sourceRef) throw new Error('Expected sourceRef from knowledge search');

    runtime.tasks.create({ id: 'development-task', goal: 'Implement architecture' }, 'orion-development');
    runtime.tasks.update('development-task', { status: 'discovery', addSourceRefs: [sourceRef] }, 'orion-development');

    expect(runtime.tasks.get('development-task')).toMatchObject({
      id: 'development-task', status: 'discovery', sourceRefs: [sourceRef]
    });
    expect(search.data).not.toHaveProperty('vaultRoot');
    expect(Object.keys(runtime).sort()).toEqual(['knowledge', 'tasks']);
  });

  it('keeps runtime references isolated and releases its session reference on dispose', async () => {
    const first = new AgentRuntimeHost(createRuntime);
    const second = new AgentRuntimeHost(createRuntime);
    const firstRuntime = first.getRuntime();
    const secondSearch = await second.getRuntime().knowledge.search({ query: 'architecture' });
    const foreignRef = secondSearch.data.matches[0]?.sourceRef;
    if (!foreignRef) throw new Error('Expected sourceRef from knowledge search');

    firstRuntime.tasks.create({ id: 'first-task', goal: 'First task' }, 'orion-development');
    expect(() => firstRuntime.tasks.update('first-task', { addSourceRefs: [foreignRef] }, 'orion-development')).toThrow(ValidationError);

    first.dispose();
    expect(() => first.getRuntime()).toThrow('Agent runtime host is disposed');
  });
});
