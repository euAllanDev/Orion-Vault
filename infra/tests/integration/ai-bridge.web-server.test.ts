import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function createVaultRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'marika-ai-web-'));
}

describe('AI bridge web server', () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.MARIKA_AI_PROVIDER;
  });

  it('exposes structured context and preview endpoints locally', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Project Alpha\n\nBody', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Beta\n\nLinks [[Project Alpha]]', 'utf8');

      process.env.MARIKA_AI_PROVIDER = 'local';
      const { startWebServer } = await import('../../../interfaces/web/server');
      const started = await startWebServer(0, { activeVaultRoot: vaultRoot });

      try {
        const contextResponse = await fetch(`http://127.0.0.1:${started.port}/api/context?path=alpha.md`);
        const previewResponse = await fetch(`http://127.0.0.1:${started.port}/api/preview`);
        const guideResponse = await fetch(`http://127.0.0.1:${started.port}/api/guide`);

        expect(contextResponse.ok).toBe(true);
        expect(previewResponse.ok).toBe(true);
        expect(guideResponse.ok).toBe(true);

        const context = await contextResponse.json();
        const preview = await previewResponse.json();
        const guide = await guideResponse.json();

        expect(context.status).toBe('success');
        expect(context.data.focusNote.path).toBe('alpha.md');
        expect(context.data.backlinks).toHaveLength(1);
        expect(preview.status).toBe('success');
        expect(preview.data.previewId).toBeTruthy();
        expect(preview.actions).toHaveLength(4);
        expect(String(guide.content ?? '')).toContain('/apply --vault <path> --preview-id <id>');
      } finally {
        await new Promise<void>((resolve, reject) => {
          started.server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
      }
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
