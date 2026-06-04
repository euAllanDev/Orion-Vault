import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeVaultScanner } from '../../filesystem/readers/node-vault-scanner';

describe('NodeVaultScanner', () => {
  it('scans folders and files as a tree', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'orion-vault-'));

    try {
      await fs.mkdir(path.join(root, 'projects'));
      await fs.writeFile(path.join(root, 'projects', 'alpha.md'), '# Alpha\n\nContent.');
      await fs.writeFile(path.join(root, 'root.md'), '# Root\n\nTop level.');

      const scanner = new NodeVaultScanner();
      const tree = await scanner.scan(root);

      expect(tree.kind).toBe('folder');
      if (tree.kind === 'folder') {
        expect(tree.children).toHaveLength(2);
        expect(tree.children[0].kind).toBe('folder');

        if (tree.children[0].kind === 'folder') {
          expect(tree.children[0].children).toHaveLength(1);
          expect(tree.children[0].children[0].kind).toBe('file');
        }

        if (tree.children[1].kind === 'file') {
          expect(tree.children[1].title).toBe('Root');
          expect(tree.children[1].preview[0]).toBe('# Root');
        }
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('hides technical folders from the workspace tree', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'orion-vault-'));

    try {
      await fs.mkdir(path.join(root, '.orion', 'index'), { recursive: true });
      await fs.mkdir(path.join(root, '.opencode', 'agents'), { recursive: true });
      await fs.mkdir(path.join(root, 'node_modules', '.bin'), { recursive: true });
      await fs.writeFile(path.join(root, 'visible.md'), '# Visible\n\nOk');

      const scanner = new NodeVaultScanner();
      const tree = await scanner.scan(root);

      expect(tree.kind).toBe('folder');
      if (tree.kind === 'folder') {
        expect(tree.children).toHaveLength(1);
        expect(tree.children[0]?.name).toBe('visible.md');
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
