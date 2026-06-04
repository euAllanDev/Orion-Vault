import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startWebServer } from '../../../interfaces/web/server';

async function createTempVault(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'orion-workspace-web-'));
}

describe('workspace web api', () => {
  let server: Awaited<ReturnType<typeof startWebServer>>['server'] | null = null;

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
      if (!server) resolve();
    });
    server = null;
  });

  it('creates, edits, renames and moves notes through the web api', async () => {
    const vaultRoot = await createTempVault();
    const started = await startWebServer(0, { activeVaultRoot: vaultRoot });
    server = started.server;

    const folderResponse = await fetch(`http://127.0.0.1:${started.port}/api/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: 'Inbox' })
    });
    expect(folderResponse.ok).toBe(true);

    const createResponse = await fetch(`http://127.0.0.1:${started.port}/api/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: 'Inbox/primeira-nota.md', content: '# Primeira nota\n\nConteudo inicial', operation: 'create' })
    });
    expect(createResponse.ok).toBe(true);

    const editResponse = await fetch(`http://127.0.0.1:${started.port}/api/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: 'Inbox/primeira-nota.md', content: '# Primeira nota\n\nConteudo atualizado', operation: 'edit' })
    });
    expect(editResponse.ok).toBe(true);

    const renameResponse = await fetch(`http://127.0.0.1:${started.port}/api/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, source: 'Inbox/primeira-nota.md', destination: 'Inbox/nota-renomeada.md' })
    });
    expect(renameResponse.ok).toBe(true);

    const moveFolderResponse = await fetch(`http://127.0.0.1:${started.port}/api/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: 'Projetos' })
    });
    expect(moveFolderResponse.ok).toBe(true);

    const moveResponse = await fetch(`http://127.0.0.1:${started.port}/api/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, source: 'Inbox/nota-renomeada.md', destination: 'Projetos/nota-renomeada.md' })
    });
    expect(moveResponse.ok).toBe(true);

    const finalContent = await fs.readFile(path.join(vaultRoot, 'Projetos', 'nota-renomeada.md'), 'utf8');
    expect(finalContent).toContain('Conteudo atualizado');

    await expect(fs.stat(path.join(vaultRoot, 'Inbox', 'primeira-nota.md'))).rejects.toThrow();
    await expect(fs.stat(path.join(vaultRoot, 'Inbox', 'nota-renomeada.md'))).rejects.toThrow();
  });
});
