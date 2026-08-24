import { describe, expect, it, vi } from 'vitest';
import type { AiBridgeResponseDto, AiBridgeSearchDataDto } from '../../../application/dto/ai-bridge.dto';
import { handleOrionSearch, ORION_SEARCH_INPUT_SCHEMA, type OrionSearchService } from './orion-search';

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

  it('returns match titles and paths for an agent', async () => {
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
          matchedFields: ['title', 'content']
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
        text: 'Found 1 matching note(s).\n\n1. Lauren Architecture\nPath: projects/lauren/architecture.md\nScore: 0.91\nTags: design\nMatched fields: title, content'
      }]
    });
  });

  it('returns a valid empty response when no notes match', async () => {
    const result = await handleOrionSearch({ search: vi.fn().mockResolvedValue(createSearchResponse()) }, '/vault', { query: 'missing' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'No Orion Vault notes matched the search.' }]
    });
  });

  it('converts application errors into controlled MCP responses', async () => {
    const response = createSearchResponse({
      summary: 'Failed to search vault.',
      status: 'error',
      issues: [{ code: 'VAULT_ERROR', message: 'Vault is unavailable.' }]
    });

    const result = await handleOrionSearch({ search: vi.fn().mockResolvedValue(response) }, '/vault', { query: 'notes' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Failed to search vault.\n- VAULT_ERROR: Vault is unavailable.' }],
      isError: true
    });
  });
});
