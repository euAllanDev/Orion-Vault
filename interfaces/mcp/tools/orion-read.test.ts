import { describe, expect, it, vi } from 'vitest';
import type { NoteSnapshotDto } from '../../../application/dto/note-snapshot.dto';
import { createOrionReadHandler, handleOrionRead, ORION_READ_INPUT_SCHEMA, ORION_READ_MAX_CHARACTERS, type OrionReadService } from './orion-read';
import { OrionSourceRegistry } from '../../../application/services/orion-source-registry';

const note: NoteSnapshotDto = {
  id: '/vault/Financas/orcamento-mensal.md',
  absolutePath: '/vault/Financas/orcamento-mensal.md',
  relativePath: 'Financas/orcamento-mensal.md',
  title: 'Orcamento Mensal',
  tags: ['financas', 'planejamento'],
  content: '# Orcamento Mensal\n\nConteudo da nota.'
};

function serviceReturning(result: NoteSnapshotDto | null): OrionReadService {
  return { getNote: vi.fn().mockResolvedValue(result) };
}

describe('orion_read', () => {
  it('accepts a relative path or opaque sourceRef in public schema', () => {
    expect(ORION_READ_INPUT_SCHEMA).toEqual({
      type: 'object',
      properties: {
        path: { type: 'string', minLength: 1, pattern: '\\S' },
        sourceRef: { type: 'string', minLength: 1, pattern: '\\S' }
      },
      anyOf: [{ required: ['path'] }, { required: ['sourceRef'] }],
      additionalProperties: false
    });
    expect(ORION_READ_INPUT_SCHEMA.properties).not.toHaveProperty('vaultRoot');
  });

  it('formats title, path, tags, and content from a loaded note', async () => {
    const getNote = vi.fn().mockResolvedValue(note);
    const result = await handleOrionRead({ getNote }, '/vault', { path: 'Financas/orcamento-mensal.md' });

    expect(getNote).toHaveBeenCalledWith('/vault', 'Financas/orcamento-mensal.md');
    expect(result).toEqual({
      content: [{
        type: 'text',
        text: 'Orion note loaded.\n\nTitle: Orcamento Mensal\nPath: Financas/orcamento-mensal.md\nTags: financas, planejamento\n\nContent:\n\n# Orcamento Mensal\n\nConteudo da nota.'
      }]
    });
  });

  it('returns a coded not-found MCP error when no Vault contains the path', async () => {
    await expect(handleOrionRead(serviceReturning(null), '/vault', { path: 'Financas/foo.md' })).resolves.toEqual({
      content: [{ type: 'text', text: 'NOT_FOUND: No Orion note was found at:\nFinancas/foo.md' }],
      isError: true
    });
  });

  it('converts service failures into controlled MCP errors without stack traces', async () => {
    const result = await handleOrionRead({ getNote: vi.fn().mockRejectedValue(new Error('secret filesystem failure')) }, '/vault', { path: 'Financas/foo.md' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'INTERNAL_ERROR: Unable to read Orion note.' }],
      isError: true
    });
  });

  it('returns a vault-unavailable error when every configured Vault read fails', async () => {
    const handler = createOrionReadHandler({
      noteSource: { getNote: vi.fn().mockRejectedValue(new Error('offline')) },
      vaultRoots: ['/vault-a', '/vault-b']
    });

    await expect(handler({ path: 'Financas/foo.md' })).resolves.toEqual({
      content: [{ type: 'text', text: 'VAULT_UNAVAILABLE: No configured Orion Vault could be read.' }],
      isError: true
    });
  });

  it('reads the exact Vault selected by a sourceRef despite a path collision', async () => {
    const sourceRegistry = new OrionSourceRegistry();
    const sourceRefA = sourceRegistry.register(0, 'projects/orion/README.md');
    const sourceRefB = sourceRegistry.register(1, 'projects/orion/README.md');
    const getNote = vi.fn((vaultRoot: string) => Promise.resolve({
      ...note,
      relativePath: 'projects/orion/README.md',
      content: vaultRoot === '/vault-a' ? 'Vault A' : 'Vault B'
    }));
    const handler = createOrionReadHandler({ noteSource: { getNote }, vaultRoots: ['/vault-a', '/vault-b'], sourceRegistry });

    await expect(handler({ sourceRef: sourceRefA })).resolves.toMatchObject({ content: [{ text: expect.stringContaining('Vault A') }] });
    await expect(handler({ sourceRef: sourceRefB })).resolves.toMatchObject({ content: [{ text: expect.stringContaining('Vault B') }] });
    expect(getNote.mock.calls.map(([root]) => root)).toEqual(['/vault-a', '/vault-b']);
  });

  it('returns NOT_FOUND for an unknown sourceRef', async () => {
    const handler = createOrionReadHandler({ noteSource: serviceReturning(null), vaultRoots: ['/vault'], sourceRegistry: new OrionSourceRegistry() });

    await expect(handler({ sourceRef: 'orion:src_missing' })).resolves.toEqual({
      content: [{ type: 'text', text: 'NOT_FOUND: No Orion source was found for the supplied sourceRef.' }],
      isError: true
    });
  });

  it('returns VAULT_UNAVAILABLE when sourceRef Vault cannot be read', async () => {
    const sourceRegistry = new OrionSourceRegistry();
    const sourceRef = sourceRegistry.register(0, 'Financas/foo.md');
    const handler = createOrionReadHandler({
      noteSource: { getNote: vi.fn().mockRejectedValue(new Error('offline')) },
      vaultRoots: ['/vault'],
      sourceRegistry
    });

    await expect(handler({ sourceRef })).resolves.toEqual({
      content: [{ type: 'text', text: 'VAULT_UNAVAILABLE: The Orion Vault for the supplied sourceRef could not be read.' }],
      isError: true
    });
  });

  it.each(['../secret.md', '..\\secret.md', 'C:\\secret.md', '/secret.md', 'config.json'])('rejects unsafe or non-Markdown path %s', async (path) => {
    const getNote = vi.fn();
    const result = await handleOrionRead({ getNote }, '/vault', { path });

    expect(getNote).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: [{ type: 'text', text: 'INVALID_INPUT: Invalid Orion note path. Use a relative Markdown path inside the configured Vault.' }],
      isError: true
    });
  });

  it('truncates oversized content explicitly', async () => {
    const result = await handleOrionRead(serviceReturning({ ...note, content: 'a'.repeat(ORION_READ_MAX_CHARACTERS + 1) }), '/vault', { path: note.relativePath });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';

    expect(text).toContain('Content truncated.');
    expect(text).toContain('a'.repeat(ORION_READ_MAX_CHARACTERS));
  });
});
