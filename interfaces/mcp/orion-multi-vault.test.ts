import { describe, expect, it, vi } from 'vitest';
import type {
  AiBridgeAgentContextDataDto,
  AiBridgeResponseDto,
  AiBridgeSearchDataDto,
  SearchMatchDto
} from '../../application/dto/ai-bridge.dto';
import type { RetrievalChunkDto } from '../../application/dto/semantic-retrieval.dto';
import { resolveOrionVaultRoots } from '../runtime/ai-bridge-runtime';
import { ORION_CONTEXT_INPUT_SCHEMA } from './tools/orion-context';
import { ORION_SEARCH_INPUT_SCHEMA } from './tools/orion-search';
import { createOrionReadHandler, ORION_READ_INPUT_SCHEMA } from './tools/orion-read';
import { contextAcrossVaults, readAcrossVaults, searchAcrossVaults, type OrionMultiVaultService } from './orion-multi-vault';
import { OrionSourceRegistry } from '../../application/services/orion-source-registry';

const vaultA = 'C:/vault-a';
const vaultB = 'C:/vault-b';

function match(title: string, notePath: string, score = 10, snippet = title): SearchMatchDto {
  return { kind: 'note', title, path: notePath, tags: [], score, matchedFields: ['content'], snippet };
}

function chunk(id: string, score: number, text = `${id} content`): RetrievalChunkDto {
  return {
    chunkId: id,
    path: `${id}.md`,
    title: id,
    tags: [],
    score,
    snippet: text,
    text,
    tokenCount: 1,
    matchedTerms: [],
    reasons: []
  };
}

function searchResponse(root: string, matches: readonly SearchMatchDto[] = [], chunks: readonly RetrievalChunkDto[] = []): AiBridgeResponseDto<AiBridgeSearchDataDto> {
  return {
    provider: 'system',
    summary: '',
    actions: [],
    status: matches.length > 0 ? 'success' : 'noop',
    issues: [],
    data: {
      vaultRoot: root,
      tags: [],
      matches,
      chunks,
      retrievalMode: 'lexical-only',
      counts: { notes: matches.length, matches: matches.length, chunks: chunks.length }
    }
  };
}

function errorSearchResponse(root: string): AiBridgeResponseDto<AiBridgeSearchDataDto> {
  return {
    ...searchResponse(root),
    status: 'error',
    issues: [{ code: 'VAULT_ERROR', message: 'unavailable' }]
  };
}

function contextResponse(root: string, chunks: readonly RetrievalChunkDto[]): AiBridgeResponseDto<AiBridgeAgentContextDataDto> {
  return {
    provider: 'system',
    summary: '',
    actions: [],
    status: chunks.length > 0 ? 'success' : 'noop',
    issues: [],
    data: {
      vaultRoot: root,
      summaryText: '',
      supportingChunks: chunks,
      retrievalMode: 'lexical-only',
      relatedNotes: [],
      relevantPaths: [],
      budget: { maxChunks: 8, maxCharacters: 4800, deliveredChunks: chunks.length }
    }
  };
}

function serviceForSearch(search: OrionMultiVaultService['search']): OrionMultiVaultService {
  return { search, loadAgentContext: vi.fn() };
}

describe('Orion multi-Vault MCP composition', () => {
  it('uses semicolon-delimited ORION_VAULT_ROOTS in configured priority order and preserves ORION_VAULT_ROOT fallback', () => {
    expect(resolveOrionVaultRoots({ ORION_VAULT_ROOTS: `${vaultA};${vaultB}` }, 'fallback')).toEqual([vaultA, vaultB]);
    expect(resolveOrionVaultRoots({ ORION_VAULT_ROOT: vaultA }, vaultA)).toEqual([vaultA]);
  });

  it('returns a result existing only in Vault A', async () => {
    const search = vi.fn(({ vaultRoot }) => Promise.resolve(searchResponse(vaultRoot, vaultRoot === vaultA ? [match('Financeiro', 'Financas/contas.md')] : [])));

    const result = await searchAcrossVaults(serviceForSearch(search), [vaultA, vaultB], { query: 'financas' });

    expect(result.data.matches.map((item) => item.path)).toEqual(['Financas/contas.md']);
    expect(result.data.resultVaultIndexes).toEqual([0]);
  });

  it('returns a result existing only in Vault B when Vault A has no result', async () => {
    const search = vi.fn(({ vaultRoot }) => Promise.resolve(searchResponse(vaultRoot, vaultRoot === vaultB ? [match('Incident', 'operations/incident.md')] : [])));

    const result = await searchAcrossVaults(serviceForSearch(search), [vaultA, vaultB], { query: 'incident' });

    expect(result.data.matches.map((item) => item.path)).toEqual(['operations/incident.md']);
    expect(result.data.resultVaultIndexes).toEqual([1]);
  });

  it('merges results from both Vaults while preserving relevance ranking', async () => {
    const search = vi.fn(({ vaultRoot }) => Promise.resolve(searchResponse(
      vaultRoot,
      vaultRoot === vaultA ? [match('Financeiro', 'Financas/a.md', 10)] : [match('Incident', 'Operations/b.md', 12)]
    )));

    const result = await searchAcrossVaults(serviceForSearch(search), [vaultA, vaultB], { query: 'notes' });

    expect(result.data.matches.map((item) => item.title)).toEqual(['Incident', 'Financeiro']);
    expect(result.data.resultVaultIndexes).toEqual([1, 0]);
  });

  it('keeps equivalent notes from different Vaults distinguishable', async () => {
    const search = vi.fn(({ vaultRoot }) => Promise.resolve(searchResponse(
      vaultRoot, [match('Shared Note', 'projects/orion/README.md', 10, 'same content')]
    )));
    const sourceRegistry = new OrionSourceRegistry();

    const result = await searchAcrossVaults(serviceForSearch(search), [vaultA, vaultB], { query: 'shared' }, sourceRegistry);

    expect(result.data.matches).toHaveLength(2);
    expect(result.data.matches.map((item) => item.sourceRef)).toEqual(expect.arrayContaining([expect.stringMatching(/^orion:src_[A-Za-z0-9_-]+$/)]));
    expect(new Set(result.data.matches.map((item) => item.sourceRef)).size).toBe(2);
    expect(result.data.matches.every((item) => !item.sourceRef?.includes(vaultA) && !item.sourceRef?.includes(vaultB))).toBe(true);
    expect(sourceRegistry.resolve(result.data.matches[0]!.sourceRef)).toEqual({ vaultIndex: 0, relativePath: 'projects/orion/README.md' });
    expect(sourceRegistry.resolve(result.data.matches[1]!.sourceRef)).toEqual({ vaultIndex: 1, relativePath: 'projects/orion/README.md' });
  });

  it('continues with Vault B when Vault A returns an error', async () => {
    const search = vi.fn(({ vaultRoot }) => Promise.resolve(
      vaultRoot === vaultA ? errorSearchResponse(vaultRoot) : searchResponse(vaultRoot, [match('Incident', 'operations/incident.md')])
    ));

    const result = await searchAcrossVaults(serviceForSearch(search), [vaultA, vaultB], { query: 'incident' });

    expect(result.status).toBe('success');
    expect(result.data.matches[0]?.path).toBe('operations/incident.md');
  });

  it('reads first matching note in configured Vault priority order', async () => {
    const getNote = vi.fn((vaultRoot: string) => Promise.resolve(
      vaultRoot === vaultA
        ? { id: 'a', absolutePath: 'a', relativePath: 'Financas/contas.md', content: 'Vault A', tags: [] }
        : { id: 'b', absolutePath: 'b', relativePath: 'Financas/contas.md', content: 'Vault B', tags: [] }
    ));

    const result = await readAcrossVaults({ getNote }, [vaultA, vaultB], 'Financas/contas.md');

    expect(result.note?.content).toBe('Vault A');
    expect(result.vaultAvailable).toBe(true);
    expect(getNote).toHaveBeenCalledTimes(1);
  });

  it('reads from Vault B when Vault A does not contain the note', async () => {
    const getNote = vi.fn((vaultRoot: string) => Promise.resolve(vaultRoot === vaultB
      ? { id: 'b', absolutePath: 'b', relativePath: 'Financas/contas.md', content: 'Vault B', tags: [] }
      : null));

    const result = await readAcrossVaults({ getNote }, [vaultA, vaultB], 'Financas/contas.md');

    expect(result.note?.content).toBe('Vault B');
    expect(result.vaultAvailable).toBe(true);
    expect(getNote.mock.calls.map(([root]) => root)).toEqual([vaultA, vaultB]);
  });

  it('resolves a search sourceRef back to its originating Vault', async () => {
    const sourceRegistry = new OrionSourceRegistry();
    const search = vi.fn(({ vaultRoot }) => Promise.resolve(searchResponse(vaultRoot, [match('README', 'projects/orion/README.md')])));
    const searched = await searchAcrossVaults(serviceForSearch(search), [vaultA, vaultB], { query: 'readme' }, sourceRegistry);
    const sourceRef = searched.data.matches[1]!.sourceRef;
    const getNote = vi.fn((vaultRoot: string) => Promise.resolve({
      id: vaultRoot,
      absolutePath: vaultRoot,
      relativePath: 'projects/orion/README.md',
      tags: [],
      content: vaultRoot === vaultA ? 'Vault A' : 'Vault B'
    }));
    const read = createOrionReadHandler({ noteSource: { getNote }, vaultRoots: [vaultA, vaultB], sourceRegistry });

    await expect(read({ sourceRef })).resolves.toMatchObject({ content: [{ text: expect.stringContaining('Vault B') }] });
    expect(getNote).toHaveBeenCalledWith(vaultB, 'projects/orion/README.md');
  });

  it('reports every configured Vault as unavailable when every read fails', async () => {
    const result = await readAcrossVaults({ getNote: vi.fn().mockRejectedValue(new Error('offline')) }, [vaultA, vaultB], 'Financas/contas.md');

    expect(result).toEqual({ note: null, vaultAvailable: false });
  });

  it('enforces one global context budget after merging both Vaults', async () => {
    const chunksA = [chunk('a1', 10, 'a'.repeat(1200)), chunk('a2', 8, 'b'.repeat(1200)), chunk('a3', 6, 'c'.repeat(1200))];
    const chunksB = [chunk('b1', 9, 'd'.repeat(1200)), chunk('b2', 7, 'e'.repeat(1200)), chunk('b3', 5, 'f'.repeat(1200))];
    const service: OrionMultiVaultService = {
      search: vi.fn(),
      loadAgentContext: vi.fn(({ vaultRoot }) => Promise.resolve(contextResponse(vaultRoot, vaultRoot === vaultA ? chunksA : chunksB)))
    };

    const result = await contextAcrossVaults(service, [vaultA, vaultB], { query: 'budget' });

    expect(result.data.supportingChunks).toHaveLength(4);
    expect(result.data.chunkVaultIndexes).toEqual([0, 1, 0, 1]);
    expect(result.data.supportingChunks.reduce((total, item) => total + item.text.length, 0)).toBeLessThanOrEqual(4800);
    expect(result.data.budget).toEqual({ maxChunks: 8, maxCharacters: 4800, deliveredChunks: 4 });
  });

  it('keeps root configuration out of public MCP input schemas', () => {
    expect(ORION_SEARCH_INPUT_SCHEMA.properties).not.toHaveProperty('vaultRoot');
    expect(ORION_SEARCH_INPUT_SCHEMA.properties).not.toHaveProperty('vaultRoots');
    expect(ORION_CONTEXT_INPUT_SCHEMA.properties).not.toHaveProperty('vaultRoot');
    expect(ORION_CONTEXT_INPUT_SCHEMA.properties).not.toHaveProperty('vaultRoots');
    expect(ORION_READ_INPUT_SCHEMA.properties).not.toHaveProperty('vaultRoot');
    expect(ORION_READ_INPUT_SCHEMA.properties).not.toHaveProperty('vaultRoots');
  });
});
