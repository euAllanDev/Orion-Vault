import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeVaultWorkspace } from '../../filesystem/workspace/node-vault-workspace';

describe('NodeVaultWorkspace', () => {
  it('creates, edits, renames, moves and deletes vault entries safely', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'marika-workspace-'));
    const workspace = new NodeVaultWorkspace();

    try {
      await workspace.createFolder(root, 'inbox');
      await workspace.createMarkdownFile(root, 'inbox/note.md', '# Note\n\nHello');
      await workspace.editMarkdownFile(root, 'inbox/note.md', '# Note\n\nUpdated');
      await workspace.renamePath(root, 'inbox/note.md', 'inbox/note-renamed.md');
      await workspace.createFolder(root, 'projects');
      await workspace.movePath(root, 'inbox/note-renamed.md', 'projects/note-renamed.md');
      await workspace.createMarkdownFile(root, 'projects/delete-me.md', '# Delete');
      await workspace.deletePath(root, 'projects/delete-me.md');
      await workspace.deletePath(root, 'inbox');

      const content = await fs.readFile(path.join(root, 'projects', 'note-renamed.md'), 'utf8');
      expect(content).toContain('Updated');
      expect(await fs.stat(path.join(root, 'projects'))).toBeTruthy();
      await expect(fs.access(path.join(root, 'projects', 'delete-me.md'))).rejects.toThrow();
      await expect(fs.access(path.join(root, 'inbox'))).rejects.toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects paths that escape the vault', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'marika-workspace-'));
    const workspace = new NodeVaultWorkspace();

    try {
      await expect(workspace.createFolder(root, '..\\escape')).rejects.toThrow();
      await expect(workspace.createMarkdownFile(root, '..\\escape.md', '# Escape')).rejects.toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects overwrite and missing file edits', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'marika-workspace-'));
    const workspace = new NodeVaultWorkspace();

    try {
      await workspace.createFolder(root, 'notes');
      await workspace.createMarkdownFile(root, 'notes/a.md', '# A');

      await expect(workspace.createMarkdownFile(root, 'notes/a.md', '# A')).rejects.toThrow();
      await expect(workspace.editMarkdownFile(root, 'notes/missing.md', '# Missing')).rejects.toThrow();
      await expect(workspace.movePath(root, 'notes/a.md', 'notes/a.md')).rejects.toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
