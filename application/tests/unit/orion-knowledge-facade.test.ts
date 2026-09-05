import { describe, expect, it, vi } from 'vitest';
import type { AiBridgeAgentContextDataDto, AiBridgeResponseDto, AiBridgeSearchDataDto } from '../../dto/ai-bridge.dto';
import { OrionKnowledgeFacade } from '../../services/orion-knowledge-facade';
import { OrionSourceRegistry } from '../../services/orion-source-registry';

const vaultA = '/vault-a';
const vaultB = '/vault-b';

function searchResponse(vaultRoot: string, path: string): AiBridgeResponseDto<AiBridgeSearchDataDto> {
  return {
    provider: 'system', summary: '', actions: [], status: 'success', issues: [],
    data: { vaultRoot, tags: [], matches: [{ kind: 'note', path, tags: [], score: 1, matchedFields: [] }], chunks: [], retrievalMode: 'lexical-only', counts: { notes: 1, matches: 1, chunks: 0 } }
  };
}

function contextResponse(vaultRoot: string): AiBridgeResponseDto<AiBridgeAgentContextDataDto> {
  return {
    provider: 'system', summary: '', actions: [], status: 'success', issues: [],
    data: { vaultRoot, summaryText: 'context', supportingChunks: [], retrievalMode: 'lexical-only', relatedNotes: [], relevantPaths: [], budget: { maxChunks: 8, maxCharacters: 4800, deliveredChunks: 0 } }
  };
}

describe('OrionKnowledgeFacade', () => {
  it('returns direct links, backlinks, then inferred relations from source Vault only', async () => {
    const sourceRegistry = new OrionSourceRegistry();
    const sourceRef = sourceRegistry.register(0, 'projects/orion/architecture.md');
    const notes = [
      { id: 'architecture', absolutePath: 'architecture', relativePath: 'projects/orion/architecture.md', title: 'Architecture', tags: ['orion'], content: '# Architecture\n[[authentication]]' },
      { id: 'authentication', absolutePath: 'authentication', relativePath: 'projects/orion/authentication.md', title: 'Authentication', tags: ['security'], content: '# Authentication' },
      { id: 'deployment', absolutePath: 'deployment', relativePath: 'projects/orion/deployment.md', title: 'Deployment', tags: ['orion'], content: '# Deployment\n[[architecture]]' },
      { id: 'unrelated', absolutePath: 'unrelated', relativePath: 'other.md', title: 'Other', tags: [], content: '# Other' }
    ];
    const facade = new OrionKnowledgeFacade({
      service: { search: vi.fn(), loadAgentContext: vi.fn() },
      noteSource: { getNote: vi.fn(), listNotes: vi.fn().mockResolvedValue(notes) },
      vaultRoots: [vaultA, vaultB], sourceRegistry
    });

    const result = await facade.related(sourceRef);

    expect(result).toMatchObject({ status: 'success' });
    expect(result.results.map((item) => [item.path, item.kind])).toEqual(expect.arrayContaining([
      ['projects/orion/authentication.md', 'manual'],
      ['projects/orion/deployment.md', 'backlink']
    ]));
    expect(result.results.some((item) => item.path === 'projects/orion/architecture.md')).toBe(false);
    expect(result.results.every((item) => sourceRegistry.resolve(item.sourceRef)?.vaultIndex === 0)).toBe(true);
  });

  it('distinguishes absent sources and unavailable source Vaults for related notes', async () => {
    const sourceRegistry = new OrionSourceRegistry();
    const sourceRef = sourceRegistry.register(0, 'missing.md');
    const unavailableRef = sourceRegistry.register(1, 'note.md');
    const facade = new OrionKnowledgeFacade({
      service: { search: vi.fn(), loadAgentContext: vi.fn() },
      noteSource: { getNote: vi.fn(), listNotes: vi.fn((vaultRoot: string) => vaultRoot === vaultB ? Promise.reject(new Error('offline')) : Promise.resolve([])) },
      vaultRoots: [vaultA, vaultB], sourceRegistry
    });

    await expect(facade.related('orion:src_missing')).resolves.toEqual({ status: 'not-found', results: [] });
    await expect(facade.related(sourceRef)).resolves.toEqual({ status: 'not-found', results: [] });
    await expect(facade.related(unavailableRef)).resolves.toEqual({ status: 'vault-unavailable', results: [] });
  });

  it('keeps colliding paths in their originating Vault when finding related notes', async () => {
    const sourceRegistry = new OrionSourceRegistry();
    const sourceRef = sourceRegistry.register(0, 'projects/orion/architecture.md');
    const listNotes = vi.fn((vaultRoot: string) => Promise.resolve(vaultRoot === vaultA
      ? [
          { id: 'a', absolutePath: 'a', relativePath: 'projects/orion/architecture.md', title: 'Architecture A', tags: [], content: '[[authentication]]' },
          { id: 'auth-a', absolutePath: 'auth-a', relativePath: 'projects/orion/authentication.md', title: 'Authentication A', tags: [], content: '' }
        ]
      : [
          { id: 'b', absolutePath: 'b', relativePath: 'projects/orion/architecture.md', title: 'Architecture B', tags: [], content: '[[deployment]]' },
          { id: 'deploy-b', absolutePath: 'deploy-b', relativePath: 'projects/orion/deployment.md', title: 'Deployment B', tags: [], content: '' }
        ]));
    const facade = new OrionKnowledgeFacade({ service: { search: vi.fn(), loadAgentContext: vi.fn() }, noteSource: { getNote: vi.fn(), listNotes }, vaultRoots: [vaultA, vaultB], sourceRegistry });

    const result = await facade.related(sourceRef);

    expect(result.results.map((item) => item.path)).toEqual(['projects/orion/authentication.md']);
    expect(listNotes).toHaveBeenCalledWith(vaultA);
    expect(listNotes).not.toHaveBeenCalledWith(vaultB);
  });

  it('returns an empty success result when no relation exists and orders direct links by path', async () => {
    const sourceRegistry = new OrionSourceRegistry();
    const sourceRef = sourceRegistry.register(0, 'source.md');
    const facade = new OrionKnowledgeFacade({
      service: { search: vi.fn(), loadAgentContext: vi.fn() },
      noteSource: { getNote: vi.fn(), listNotes: vi.fn().mockResolvedValue([
        { id: 'source', absolutePath: 'source', relativePath: 'source.md', title: 'Source', tags: [], content: '[[zebra]]\n[[alpha]]' },
        { id: 'zebra', absolutePath: 'zebra', relativePath: 'zebra.md', title: 'Zebra', tags: [], content: '' },
        { id: 'alpha', absolutePath: 'alpha', relativePath: 'alpha.md', title: 'Alpha', tags: [], content: '' }
      ]) },
      vaultRoots: [vaultA], sourceRegistry
    });

    await expect(facade.related(sourceRef)).resolves.toMatchObject({
      status: 'success',
      results: [{ path: 'alpha.md', kind: 'manual' }, { path: 'zebra.md', kind: 'manual' }]
    });

    const emptyRegistry = new OrionSourceRegistry();
    const emptyRef = emptyRegistry.register(0, 'lonely.md');
    const emptyFacade = new OrionKnowledgeFacade({
      service: { search: vi.fn(), loadAgentContext: vi.fn() },
      noteSource: { getNote: vi.fn(), listNotes: vi.fn().mockResolvedValue([{ id: 'lonely', absolutePath: 'lonely', relativePath: 'lonely.md', tags: [], content: '# Lonely' }]) },
      vaultRoots: [vaultA], sourceRegistry: emptyRegistry
    });
    await expect(emptyFacade.related(emptyRef)).resolves.toEqual({ status: 'success', results: [] });
  });

  it('keeps colliding paths distinct through sourceRef and reads exact source Vault', async () => {
    const sourceRegistry = new OrionSourceRegistry();
    const getNote = vi.fn((vaultRoot: string) => Promise.resolve({ id: vaultRoot, absolutePath: vaultRoot, relativePath: 'projects/orion/architecture.md', tags: [], content: vaultRoot }));
    const facade = new OrionKnowledgeFacade({
      service: { search: vi.fn(({ vaultRoot }) => Promise.resolve(searchResponse(vaultRoot, 'projects/orion/architecture.md'))), loadAgentContext: vi.fn(() => Promise.resolve(contextResponse(vaultA))) },
      noteSource: { getNote, listNotes: vi.fn() }, vaultRoots: [vaultA, vaultB], sourceRegistry
    });

    const searched = await facade.search({ query: 'architecture' });
    const sourceRefs = searched.data.matches.map((match) => match.sourceRef);
    const read = await facade.read({ sourceRef: sourceRefs[1] });

    expect(sourceRefs).toHaveLength(2);
    expect(new Set(sourceRefs).size).toBe(2);
    expect(read.note?.content).toBe(vaultB);
    expect(getNote).toHaveBeenCalledWith(vaultB, 'projects/orion/architecture.md');
  });

  it('preserves path priority and distinguishes missing notes from unavailable Vaults', async () => {
    const sourceRegistry = new OrionSourceRegistry();
    const facade = new OrionKnowledgeFacade({
      service: { search: vi.fn(), loadAgentContext: vi.fn() },
      noteSource: { listNotes: vi.fn(), getNote: vi.fn((vaultRoot: string) => Promise.resolve(vaultRoot === vaultA ? null : { id: 'b', absolutePath: 'b', relativePath: 'note.md', tags: [], content: 'Vault B' })) },
      vaultRoots: [vaultA, vaultB], sourceRegistry
    });

    await expect(facade.read({ path: 'note.md' })).resolves.toMatchObject({ vaultAvailable: true, note: { content: 'Vault B' } });
    await expect(facade.read({ sourceRef: 'orion:src_missing' })).resolves.toEqual({ note: null, vaultAvailable: true });

    const unavailable = new OrionKnowledgeFacade({
      service: { search: vi.fn(), loadAgentContext: vi.fn() },
      noteSource: { listNotes: vi.fn(), getNote: vi.fn().mockRejectedValue(new Error('offline')) }, vaultRoots: [vaultA], sourceRegistry
    });
    await expect(unavailable.read({ path: 'note.md' })).resolves.toEqual({ note: null, vaultAvailable: false });
  });

  it('routes context through every configured Vault', async () => {
    const loadAgentContext = vi.fn(({ vaultRoot }) => Promise.resolve(contextResponse(vaultRoot)));
    const facade = new OrionKnowledgeFacade({
      service: { search: vi.fn(), loadAgentContext },
      noteSource: { getNote: vi.fn(), listNotes: vi.fn() }, vaultRoots: [vaultA, vaultB], sourceRegistry: new OrionSourceRegistry()
    });

    await facade.context({ query: 'architecture', tags: ['design'] });
    expect(loadAgentContext).toHaveBeenCalledWith({ vaultRoot: vaultA, query: 'architecture', tags: ['design'] });
    expect(loadAgentContext).toHaveBeenCalledWith({ vaultRoot: vaultB, query: 'architecture', tags: ['design'] });
  });
});
