import { describe, expect, it } from 'vitest';
import { Note } from '../../notes/entities/note';

describe('Note', () => {
  it('creates an immutable note entity', () => {
    const note = Note.create({
      id: 'note-1',
      path: 'notes/example.md',
      content: '# Example',
      tags: ['demo']
    });

    expect(note.id.toString()).toBe('note-1');
    expect(note.path.toString()).toBe('notes/example.md');
    expect(note.tags).toEqual(['demo']);
  });
});
