import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startWebServer } from '../../../interfaces/web/server';

async function createTempVault(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'orion-agenda-'));
}

describe('agenda note api', () => {
  let server: Awaited<ReturnType<typeof startWebServer>>['server'] | null = null;

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
      if (!server) resolve();
    });
    server = null;
  });

  it('saves agenda notes and exposes them in the agenda listing', async () => {
    const vaultRoot = await createTempVault();
    const started = await startWebServer(0, { activeVaultRoot: vaultRoot });
    server = started.server;

    const agendaPath = 'Agenda/2026-05-13-testando-agenda.md';
    const content = `---
vaultRoot: ${vaultRoot}
due: 2026-05-13T10:00
status: pending
---
# Testando agenda

Conteudo da agenda.
`;

    const saveResponse = await fetch(`http://127.0.0.1:${started.port}/api/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: agendaPath, content, operation: 'create' })
    });

    expect(saveResponse.ok).toBe(true);

    const savedContent = await fs.readFile(path.join(vaultRoot, 'Agenda', '2026-05-13-testando-agenda.md'), 'utf8');
    expect(savedContent).toContain('# Testando agenda');

    const agendaResponse = await fetch(`http://127.0.0.1:${started.port}/api/agenda?vaultRoot=${encodeURIComponent(vaultRoot)}`);
    expect(agendaResponse.ok).toBe(true);
    const agenda = await agendaResponse.json() as { items: Array<{ path: string; title: string }> };
    expect(agenda.items.some((item) => item.path === agendaPath && item.title === 'Testando agenda')).toBe(true);
  });

  it('uses the opened desktop vault as the agenda root', async () => {
    const workspaceRoot = await createTempVault();
    const agendaRoot = await createTempVault();
    const sessionPath = path.join(workspaceRoot, 'desktop-session.json');
    const started = await startWebServer(0, { desktopSessionPath: sessionPath, activeVaultRoot: workspaceRoot });
    server = started.server;

    const setupResponse = await fetch(`http://127.0.0.1:${started.port}/api/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open', vaultRoot: agendaRoot })
    });

    expect(setupResponse.ok).toBe(true);

    const bootstrapResponse = await fetch(`http://127.0.0.1:${started.port}/api/bootstrap`);
    expect(bootstrapResponse.ok).toBe(true);
    const bootstrap = await bootstrapResponse.json() as { vaultRoot: string };
    expect(bootstrap.vaultRoot).toBe(agendaRoot);

    const agendaPath = 'Agenda/2026-05-14-vault-ativo.md';
    const content = `---
vaultRoot: ${agendaRoot}
due: 2026-05-14T10:00
status: pending
---
# Vault ativo

Conteudo da agenda.
`;

    const saveResponse = await fetch(`http://127.0.0.1:${started.port}/api/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot: agendaRoot, path: agendaPath, content, operation: 'create' })
    });

    expect(saveResponse.ok).toBe(true);

    const agendaResponse = await fetch(`http://127.0.0.1:${started.port}/api/agenda`);
    expect(agendaResponse.ok).toBe(true);
    const agenda = await agendaResponse.json() as { vaultRoot: string; items: Array<{ path: string; title: string }> };
    expect(agenda.vaultRoot).toBe(agendaRoot);
    expect(agenda.items.some((item) => item.path === agendaPath && item.title === 'Vault ativo')).toBe(true);
  });
});
