import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startWebServer } from '../../../interfaces/web/server';

async function createTempVault(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'marika-delete-'));
}

describe('workspace delete api', () => {
  let server: Awaited<ReturnType<typeof startWebServer>>['server'] | null = null;
  const roots = new Set<string>();

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
      if (!server) resolve();
    });
    server = null;

    for (const root of roots) {
      await fs.rm(root, { recursive: true, force: true });
    }
    roots.clear();
  });

  it('deletes regular notes through the api', async () => {
    const vaultRoot = await createTempVault();
    roots.add(vaultRoot);
    await fs.mkdir(path.join(vaultRoot, 'Notas'), { recursive: true });
    await fs.writeFile(path.join(vaultRoot, 'Notas', 'apagar.md'), '# Apagar', 'utf8');

    const started = await startWebServer(0, { activeVaultRoot: vaultRoot });
    server = started.server;

    const response = await fetch(`http://127.0.0.1:${started.port}/api/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: 'Notas/apagar.md' })
    });

    expect(response.ok).toBe(true);
    await expect(fs.access(path.join(vaultRoot, 'Notas', 'apagar.md'))).rejects.toThrow();
  });

  it('deletes folders recursively through the api', async () => {
    const vaultRoot = await createTempVault();
    roots.add(vaultRoot);
    await fs.mkdir(path.join(vaultRoot, 'Projetos', 'Ativo'), { recursive: true });
    await fs.writeFile(path.join(vaultRoot, 'Projetos', 'Ativo', 'nota.md'), '# Nota', 'utf8');

    const started = await startWebServer(0, { activeVaultRoot: vaultRoot });
    server = started.server;

    const response = await fetch(`http://127.0.0.1:${started.port}/api/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: 'Projetos' })
    });

    expect(response.ok).toBe(true);
    await expect(fs.access(path.join(vaultRoot, 'Projetos'))).rejects.toThrow();
  });

  it('keeps the Agenda folder protected but still allows deleting its notes', async () => {
    const vaultRoot = await createTempVault();
    roots.add(vaultRoot);
    await fs.mkdir(path.join(vaultRoot, 'Agenda'), { recursive: true });
    await fs.writeFile(path.join(vaultRoot, 'Agenda', '2026-05-14.md'), '# Agenda', 'utf8');

    const started = await startWebServer(0, { activeVaultRoot: vaultRoot });
    server = started.server;

    const protectedResponse = await fetch(`http://127.0.0.1:${started.port}/api/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: 'Agenda' })
    });

    expect(protectedResponse.ok).toBe(false);
    const protectedPayload = await protectedResponse.json() as { error?: string };
    expect(protectedPayload.error).toContain('Agenda');
    expect(await fs.stat(path.join(vaultRoot, 'Agenda'))).toBeTruthy();

    const noteResponse = await fetch(`http://127.0.0.1:${started.port}/api/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: 'Agenda/2026-05-14.md' })
    });

    expect(noteResponse.ok).toBe(true);
    await expect(fs.access(path.join(vaultRoot, 'Agenda', '2026-05-14.md'))).rejects.toThrow();
    expect(await fs.stat(path.join(vaultRoot, 'Agenda'))).toBeTruthy();
  });
});
