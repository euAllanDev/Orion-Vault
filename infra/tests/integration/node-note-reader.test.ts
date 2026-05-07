import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeNoteReader } from '../../filesystem/readers/node-note-reader';

describe('NodeNoteReader', () => {
  it('extracts title and tags from markdown notes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'marika-notes-'));

    try {
      await fs.writeFile(
        path.join(root, 'note.md'),
        ['---', 'tags:', '  - project', '  - alpha', '---', '# Project Alpha', '', 'Body with #work tag.'].join('\n')
      );

      const reader = new NodeNoteReader();
      const notes = await reader.listNotes(root);

      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Project Alpha');
      expect(notes[0].tags).toEqual(['project', 'alpha', 'work']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
