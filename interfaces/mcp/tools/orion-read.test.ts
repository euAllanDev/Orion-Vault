import { describe, expect, it, vi } from 'vitest';
import type { NoteSnapshotDto } from '../../../application/dto/note-snapshot.dto';
import { handleOrionRead, ORION_READ_INPUT_SCHEMA, ORION_READ_MAX_CHARACTERS, type OrionReadService } from './orion-read';

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
  it('exposes only a required relative path in public schema', () => {
    expect(ORION_READ_INPUT_SCHEMA).toEqual({
      type: 'object',
      properties: { path: { type: 'string', minLength: 1, pattern: '\\S' } },
      required: ['path'],
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

  it('returns a controlled response when no Vault contains the path', async () => {
    await expect(handleOrionRead(serviceReturning(null), '/vault', { path: 'Financas/foo.md' })).resolves.toEqual({
      content: [{ type: 'text', text: 'No Orion note was found at:\nFinancas/foo.md' }]
    });
  });

  it('converts service failures into controlled MCP errors without stack traces', async () => {
    const result = await handleOrionRead({ getNote: vi.fn().mockRejectedValue(new Error('secret filesystem failure')) }, '/vault', { path: 'Financas/foo.md' });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Unable to read Orion note.' }],
      isError: true
    });
  });

  it.each(['../secret.md', '..\\secret.md', 'C:\\secret.md', '/secret.md', 'config.json'])('rejects unsafe or non-Markdown path %s', async (path) => {
    const getNote = vi.fn();
    const result = await handleOrionRead({ getNote }, '/vault', { path });

    expect(getNote).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Invalid Orion note path. Use a relative Markdown path inside the configured Vault.' }],
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
