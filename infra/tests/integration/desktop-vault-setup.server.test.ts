import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startWebServer } from '../../../interfaces/web/server';

async function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'orion-desktop-setup-'));
}

describe('desktop vault setup api', () => {
  let server: Awaited<ReturnType<typeof startWebServer>>['server'] | null = null;
  const desktopSessionToken = 'desktop-test-token';

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
      if (!server) resolve();
    });
    server = null;
  });

  it('reports a missing vault without crashing the workspace endpoint', async () => {
    const tempRoot = await createTempRoot();
    const missingVaultRoot = path.join(tempRoot, 'MissingVault');
    const started = await startWebServer(0, { activeVaultRoot: missingVaultRoot });
    server = started.server;

    const response = await fetch(`http://127.0.0.1:${started.port}/api/workspace?vaultRoot=${encodeURIComponent(missingVaultRoot)}`);
    expect(response.ok).toBe(true);

    const payload = await response.json() as {
      vaultRoot: string;
      exists: boolean;
      tree: unknown;
      summary: unknown;
    };

    expect(payload.vaultRoot).toBe(missingVaultRoot);
    expect(payload.exists).toBe(false);
    expect(payload.tree).toBeNull();
    expect(payload.summary).toBeNull();
  });

  it('creates a missing vault and persists it as the active desktop vault', async () => {
    const workspaceRoot = await createTempRoot();
    const sessionPath = path.join(workspaceRoot, 'desktop-session.json');
    const missingVaultRoot = path.join(workspaceRoot, 'CreatedVault');
    const started = await startWebServer(0, {
      desktopSessionPath: sessionPath,
      activeVaultRoot: missingVaultRoot,
      desktopSessionToken
    });
    server = started.server;

    const response = await fetch(`http://127.0.0.1:${started.port}/api/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Orion-Session-Token': desktopSessionToken },
      body: JSON.stringify({ action: 'create', vaultRoot: missingVaultRoot })
    });

    expect(response.ok).toBe(true);
    const payload = await response.json() as { vaultRoot: string; created: boolean };
    expect(payload.vaultRoot).toBe(missingVaultRoot);
    expect(payload.created).toBe(true);

    await expect(fs.stat(missingVaultRoot)).resolves.toBeTruthy();
    await expect(fs.stat(path.join(missingVaultRoot, 'Agenda'))).resolves.toBeTruthy();

    const bootstrapResponse = await fetch(`http://127.0.0.1:${started.port}/api/bootstrap`, {
      headers: { 'X-Orion-Session-Token': desktopSessionToken }
    });
    expect(bootstrapResponse.ok).toBe(true);
    const bootstrap = await bootstrapResponse.json() as { vaultRoot: string };
    expect(bootstrap.vaultRoot).toBe(missingVaultRoot);
  });

  it('restricts desktop requests to the session token, loopback server, and active vault', async () => {
    const activeVaultRoot = await createTempRoot();
    const foreignVaultRoot = await createTempRoot();
    const sessionPath = path.join(activeVaultRoot, 'desktop-session.json');
    const started = await startWebServer(0, {
      desktopSessionPath: sessionPath,
      activeVaultRoot,
      desktopSessionToken
    });
    server = started.server;

    const address = started.server.address();
    expect(typeof address === 'object' && address ? address.address : '').toBe('127.0.0.1');

    const unauthorizedResponse = await fetch(`http://127.0.0.1:${started.port}/api/workspace`);
    expect(unauthorizedResponse.status).toBe(401);

    const workspaceResponse = await fetch(`http://127.0.0.1:${started.port}/api/workspace?vaultRoot=${encodeURIComponent(foreignVaultRoot)}`, {
      headers: { 'X-Orion-Session-Token': desktopSessionToken }
    });
    expect(workspaceResponse.ok).toBe(true);
    const workspace = await workspaceResponse.json() as { vaultRoot: string };
    expect(workspace.vaultRoot).toBe(activeVaultRoot);

    const createResponse = await fetch(`http://127.0.0.1:${started.port}/api/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Orion-Session-Token': desktopSessionToken },
      body: JSON.stringify({
        vaultRoot: foreignVaultRoot,
        path: 'desktop-only.md',
        content: '# Desktop only',
        operation: 'create'
      })
    });
    expect(createResponse.ok).toBe(true);

    await expect(fs.readFile(path.join(activeVaultRoot, 'desktop-only.md'), 'utf8')).resolves.toContain('Desktop only');
    await expect(fs.stat(path.join(foreignVaultRoot, 'desktop-only.md'))).rejects.toThrow();
  });
});
