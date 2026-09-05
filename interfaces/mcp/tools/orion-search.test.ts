import { describe, expect, it, vi } from 'vitest';
import type { AiBridgeResponseDto, AiBridgeSearchDataDto } from '../../../application/dto/ai-bridge.dto';
import { createOrionSearchHandler, handleOrionSearch, ORION_SEARCH_INPUT_SCHEMA, type OrionSearchService } from './orion-search';
import { OrionSourceRegistry } from '../../../application/services/orion-source-registry';

function createSearchResponse(overrides: Partial<AiBridgeResponseDto<AiBridgeSearchDataDto>> = {}): AiBridgeResponseDto<AiBridgeSearchDataDto> {
  return {
    provider: 'system',
    summary: 'No matching notes found.',
    actions: [],
    status: 'noop',
    issues: [],
    data: {
      vaultRoot: '/vault',
      tags: [],
      matches: [],
      chunks: [],
      retrievalMode: 'lexical-only',
      counts: { notes: 0, matches: 0, chunks: 0 }
    },
    ...overrides
  };
}

describe('orion_search', () => {
  it('does not expose vaultRoot in the public input schema', () => {
    expect(ORION_SEARCH_INPUT_SCHEMA).toEqual({
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, pattern: '\\S' },
        scopePath: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['query'],
      additionalProperties: false
    });
  });

  it('forwards the supported input to the application search service', async () => {
    const search = vi.fn().mockResolvedValue(createSearchResponse());
    const service: OrionSearchService = { search };

    await handleOrionSearch(service, '/vault/configured', {
      query: 'architecture',
      scopePath: 'projects/lauren',
      tags: ['design', 'mcp']
    });

    expect(search).toHaveBeenCalledWith({
      vaultRoot: '/vault/configured',
      query: 'architecture',
      scopePath: 'projects/lauren',
      tags: ['design', 'mcp']
    });
  });

  it('returns match metadata and its snippet for an agent', async () => {
    const response = createSearchResponse({
      summary: 'Found 1 matching note(s).',
      status: 'success',
      data: {
        vaultRoot: '/vault',
        tags: ['design'],
        matches: [{
          kind: 'note',
          title: 'Lauren Architecture',
          path: 'projects/lauren/architecture.md',
          tags: ['design'],
          score: 0.91,
          matchedFields: ['title', 'content'],
          snippet: 'System design for Lauren.'
        }],
        chunks: [],
        retrievalMode: 'lexical-only',
        counts: { notes: 1, matches: 1, chunks: 0 }
      }
    });

    const result = await handleOrionSearch({ search: vi.fn().mockResolvedValue(response) }, '/vault', { query: 'lauren' });

    expect(result).toEqual({
      content: [{
        type: 'text',
        text: 'Found 1 matching note(s).\n\n1. Lauren Architecture\nPath: projects/lauren/architecture.md\nScore: 0.91\nTags: design\nMatched fields: title, content\nSnippet: System design for Lauren.'
      }]
    });
  });

  it('publishes opaque sourceRefs without exposing configured Vault roots', async () => {
    const sourceRegistry = new OrionSourceRegistry();
    const handler = createOrionSearchHandler({
      vaultRoots: ['/private/home/vault-a', '/private/home/vault-b'],
      sourceRegistry,
      service: {
        loadAgentContext: vi.fn(),
        search: vi.fn(({ vaultRoot }) => Promise.resolve(createSearchResponse({
          status: 'success',
          data: {
            vaultRoot,
            tags: [],
            matches: [{ kind: 'note', path: 'projects/orion/README.md', tags: [], score: 1, matchedFields: [] }],
            chunks: [], retrievalMode: 'lexical-only', counts: { notes: 1, matches: 1, chunks: 0 }
          }
        })))
      }
    });

    const result = await handler({ query: 'orion' });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    const sourceRefs = text.match(/orion:src_[A-Za-z0-9_-]+/g) ?? [];

    expect(sourceRefs).toHaveLength(2);
    expect(new Set(sourceRefs).size).toBe(2);
    expect(text).not.toContain('/private/home/vault-a');
    expect(text).not.toContain('/private/home/vault-b');
  });

  it('omits snippet when neither match nor related chunk has one', async () => {
    const response = createSearchResponse({
      status: 'success',
      data: {
        vaultRoot: '/vault', tags: [],
        matches: [{ kind: 'note', path: 'Notes/Plain.md', tags: [], score: 0.5, matchedFields: [] }],
        chunks: [], retrievalMode: 'lexical-only', counts: { notes: 1, matches: 1, chunks: 0 }
      }
    });

    const result = await handleOrionSearch({ search: vi.fn().mockResolvedValue(response) }, '/vault', { query: 'plain' });

    expect(result.content[0]).toEqual({ type: 'text', text: 'Found 1 matching note(s).\n\n1. Notes/Plain.md\nPath: Notes/Plain.md\nScore: 0.5' });
  });

  it('adds one distinct related chunk snippet with its heading', async () => {
    const response = createSearchResponse({
      status: 'success',
      data: {
        vaultRoot: '/vault', tags: [],
        matches: [{ kind: 'note', title: 'Budget', path: 'Finance/Budget.md', tags: [], score: 0.8, matchedFields: [] }],
        chunks: [{ chunkId: 'budget-plan', path: 'Finance/Budget.md', heading: 'Planning', tags: [], score: 0.9, snippet: 'Track income and expenses monthly.', text: 'Full chunk text must not be exposed.', tokenCount: 8, matchedTerms: [], reasons: [] }],
        retrievalMode: 'hybrid', counts: { notes: 1, matches: 1, chunks: 1 }
      }
    });

    const result = await handleOrionSearch({ search: vi.fn().mockResolvedValue(response) }, '/vault', { query: 'budget' });

    expect(result.content[0]).toEqual({ type: 'text', text: 'Found 1 matching note(s).\n\n1. Budget\nPath: Finance/Budget.md\nScore: 0.8\nRelevant section: Planning\nSnippet: Track income and expenses monthly.' });
  });

  it('does not duplicate a matching chunk snippet and remains compact for multiple results', async () => {
    const response = createSearchResponse({
      status: 'success',
      data: {
        vaultRoot: '/vault', tags: [],
        matches: [
          { kind: 'note', title: 'Goals', path: 'Finance/Goals.md', tags: [], score: 0.9, matchedFields: [], snippet: 'Set financial goals.' },
          { kind: 'note', title: 'Budget', path: 'Finance/Budget.md', tags: [], score: 0.8, matchedFields: [] }
        ],
        chunks: [
          { chunkId: 'goals-1', path: 'Finance/Goals.md', heading: 'Goals', tags: [], score: 0.9, snippet: ' Set financial goals. ', text: 'Full text.', tokenCount: 3, matchedTerms: [], reasons: [] },
          { chunkId: 'budget-1', path: 'Finance/Budget.md', tags: [], score: 0.8, snippet: 'Track monthly spending.', text: 'Full text.', tokenCount: 3, matchedTerms: [], reasons: [] }
        ],
        retrievalMode: 'hybrid', counts: { notes: 2, matches: 2, chunks: 2 }
      }
    });

    const result = await handleOrionSearch({ search: vi.fn().mockResolvedValue(response) }, '/vault', { query: 'finance' });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';

    expect(text).toBe('Found 2 matching note(s).\n\n1. Goals\nPath: Finance/Goals.md\nScore: 0.9\nSnippet: Set financial goals.\n\n2. Budget\nPath: Finance/Budget.md\nScore: 0.8\nSnippet: Track monthly spending.');
    expect(text).not.toContain('Full text.');
    expect(text.match(/Set financial goals\./g)).toHaveLength(1);
  });

  it('returns a valid empty response when no notes match', async () => {
    const result = await handleOrionSearch({ search: vi.fn().mockResolvedValue(createSearchResponse()) }, '/vault', { query: 'missing' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'No Orion Vault notes matched the search.' }]
    });
  });

  it('returns INVALID_INPUT before calling the service for a whitespace query', async () => {
    const search = vi.fn();

    await expect(handleOrionSearch({ search }, '/vault', { query: '  ' })).resolves.toEqual({
      content: [{ type: 'text', text: 'INVALID_INPUT: Search query must contain non-whitespace text.' }],
      isError: true
    });
    expect(search).not.toHaveBeenCalled();
  });

  it('converts unavailable Vault responses into coded MCP errors', async () => {
    const response = createSearchResponse({
      summary: 'Failed to search vault.',
      status: 'error',
      issues: [{ code: 'VAULT_ERROR', message: 'Vault is unavailable.' }]
    });

    const result = await handleOrionSearch({ search: vi.fn().mockResolvedValue(response) }, '/vault', { query: 'notes' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'VAULT_UNAVAILABLE: Unable to search Orion Vault.' }],
      isError: true
    });
  });

  it('converts unexpected service failures into INTERNAL_ERROR without exposing details', async () => {
    const result = await handleOrionSearch({ search: vi.fn().mockRejectedValue(new Error('secret filesystem failure')) }, '/vault', { query: 'notes' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'INTERNAL_ERROR: Unable to search Orion Vault.' }],
      isError: true
    });
  });

  it('returns VAULT_UNAVAILABLE when every configured Vault fails', async () => {
    const handler = createOrionSearchHandler({
      service: {
        search: vi.fn().mockResolvedValue(createSearchResponse({ status: 'error', issues: [{ code: 'VAULT_UNAVAILABLE', message: 'offline' }] })),
        loadAgentContext: vi.fn()
      },
      vaultRoots: ['/vault-a', '/vault-b']
    });

    await expect(handler({ query: 'notes' })).resolves.toEqual({
      content: [{ type: 'text', text: 'VAULT_UNAVAILABLE: Unable to search Orion Vault.' }],
      isError: true
    });
  });
});
