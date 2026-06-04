import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeNoteReader } from '../../filesystem/readers/node-note-reader';

describe('NodeNoteReader', () => {
  it('extracts title and tags from markdown notes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'orion-notes-'));

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

  it('ignores technical folders inside the vault', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'orion-notes-'));

    try {
      await fs.mkdir(path.join(root, '.opencode', 'agents'), { recursive: true });
      await fs.mkdir(path.join(root, 'node_modules', 'pkg'), { recursive: true });
      await fs.writeFile(path.join(root, '.opencode', 'agents', 'agent-template.md'), '# Agent\n');
      await fs.writeFile(path.join(root, 'node_modules', 'pkg', 'readme.md'), '# Package\n');
      await fs.writeFile(path.join(root, 'real-note.md'), '# Real Note\n\nBody');

      const reader = new NodeNoteReader();
      const notes = await reader.listNotes(root);

      expect(notes).toHaveLength(1);
      expect(notes[0]?.relativePath).toBe('real-note.md');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
