import { describe, expect, it, vi } from 'vitest';
import { ORION_RELATED_INPUT_SCHEMA, createOrionRelatedHandler } from './orion-related';

describe('orion_related', () => {
  it('exposes only sourceRef in public schema', () => {
    expect(ORION_RELATED_INPUT_SCHEMA).toEqual({
      type: 'object',
      properties: { sourceRef: { type: 'string', minLength: 1, pattern: '\\S' } },
      required: ['sourceRef'],
      additionalProperties: false
    });
    expect(ORION_RELATED_INPUT_SCHEMA.properties).not.toHaveProperty('path');
    expect(ORION_RELATED_INPUT_SCHEMA.properties).not.toHaveProperty('vaultRoot');
  });

  it('formats reusable sourceRefs returned by knowledge facade', async () => {
    const related = vi.fn().mockResolvedValue({
      status: 'success',
      results: [{ path: 'architecture/authentication.md', sourceRef: 'orion:src_auth', title: 'Authentication Architecture', score: 1, kind: 'manual', intensity: 'strong' }]
    });
    const handler = createOrionRelatedHandler({ knowledge: { related } } as never);

    await expect(handler({ sourceRef: 'orion:src_source' })).resolves.toEqual({
      content: [{ type: 'text', text: 'Found 1 related Orion note(s).\n\n1. Authentication Architecture\nPath: architecture/authentication.md\nSource ref: orion:src_auth\nRelationship: manual\nScore: 1' }]
    });
    expect(related).toHaveBeenCalledWith('orion:src_source');
  });

  it('maps invalid, absent, and unavailable sources to coded MCP errors', async () => {
    const related = vi.fn()
      .mockResolvedValueOnce({ status: 'not-found', results: [] })
      .mockResolvedValueOnce({ status: 'vault-unavailable', results: [] });
    const handler = createOrionRelatedHandler({ knowledge: { related } } as never);

    await expect(handler({ sourceRef: '  ' })).resolves.toEqual({ content: [{ type: 'text', text: 'INVALID_INPUT: Related input requires a non-whitespace Orion sourceRef.' }], isError: true });
    await expect(handler({ sourceRef: 'orion:src_missing' })).resolves.toEqual({ content: [{ type: 'text', text: 'NOT_FOUND: No Orion source was found for the supplied sourceRef.' }], isError: true });
    await expect(handler({ sourceRef: 'orion:src_offline' })).resolves.toEqual({ content: [{ type: 'text', text: 'VAULT_UNAVAILABLE: The Orion Vault for the supplied sourceRef could not be read.' }], isError: true });
  });

  it('returns success when no relationships exist', async () => {
    const handler = createOrionRelatedHandler({ knowledge: { related: vi.fn().mockResolvedValue({ status: 'success', results: [] }) } } as never);

    await expect(handler({ sourceRef: 'orion:src_empty' })).resolves.toEqual({ content: [{ type: 'text', text: 'No related Orion notes were found.' }] });
  });
});
