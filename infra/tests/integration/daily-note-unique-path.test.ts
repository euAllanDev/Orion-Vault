import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startWebServer } from '../../../interfaces/web/server';

async function createTempVault(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'marika-daily-'));
}

describe('daily note api', () => {
  let server: Awaited<ReturnType<typeof startWebServer>>['server'] | null = null;

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
      if (!server) resolve();
    });
    server = null;
  });

  it('creates a unique daily note path when the default already exists', async () => {
    const vaultRoot = await createTempVault();
    const started = await startWebServer(0, { activeVaultRoot: vaultRoot });
    server = started.server;

    const firstResponse = await fetch(`http://127.0.0.1:${started.port}/api/daily?vaultRoot=${encodeURIComponent(vaultRoot)}`);
    expect(firstResponse.ok).toBe(true);
    const first = await firstResponse.json() as { path: string; content: string };
    expect(first.path).toMatch(/^Daily\/\d{4}-\d{2}-\d{2}\.md$/);

    const secondResponse = await fetch(`http://127.0.0.1:${started.port}/api/daily?vaultRoot=${encodeURIComponent(vaultRoot)}`);
    expect(secondResponse.ok).toBe(true);
    const second = await secondResponse.json() as { path: string; content: string };
    expect(second.path).toMatch(/^Daily\/\d{4}-\d{2}-\d{2}-1\.md$/);
    expect(second.path).not.toBe(first.path);

    const firstContent = await fs.readFile(path.join(vaultRoot, first.path.replace(/\//g, path.sep)), 'utf8');
    const secondContent = await fs.readFile(path.join(vaultRoot, second.path.replace(/\//g, path.sep)), 'utf8');
    expect(firstContent).toContain('# ');
    expect(secondContent).toContain('# ');
  });
});
