import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function createVaultRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'orion-ai-web-'));
}

describe('AI bridge web server', () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.ORION_AI_PROVIDER;
    delete process.env.MARIKA_AI_PROVIDER;
  });

  it('exposes structured context and preview endpoints locally', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Project Alpha\n\nBody', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Beta\n\nLinks [[Project Alpha]]', 'utf8');
      await fs.mkdir(path.join(vaultRoot, 'Architecture'), { recursive: true });
      await fs.writeFile(path.join(vaultRoot, 'Architecture', 'clean.md'), '# Clean Architecture\n\nUse cases stay inside application.', 'utf8');

      process.env.ORION_AI_PROVIDER = 'local';
      const { startWebServer } = await import('../../../interfaces/web/server');
      const started = await startWebServer(0, { activeVaultRoot: vaultRoot });

      try {
        const contextResponse = await fetch(`http://127.0.0.1:${started.port}/api/context?path=alpha.md`);
        const scopedSearchResponse = await fetch(`http://127.0.0.1:${started.port}/api/search?query=architecture&path=Architecture`);
        const retrieveResponse = await fetch(`http://127.0.0.1:${started.port}/api/retrieve?query=architecture&path=Architecture`);
        const agentContextResponse = await fetch(`http://127.0.0.1:${started.port}/api/agent-context?path=alpha.md`);
        const previewResponse = await fetch(`http://127.0.0.1:${started.port}/api/preview`);
        const guideResponse = await fetch(`http://127.0.0.1:${started.port}/api/guide`);
        const onboardingResponse = await fetch(`http://127.0.0.1:${started.port}/api/ai-onboarding`);

        expect(contextResponse.ok).toBe(true);
        expect(scopedSearchResponse.ok).toBe(true);
        expect(retrieveResponse.ok).toBe(true);
        expect(agentContextResponse.ok).toBe(true);
        expect(previewResponse.ok).toBe(true);
        expect(guideResponse.ok).toBe(true);
        expect(onboardingResponse.ok).toBe(true);

        const context = await contextResponse.json();
        const scopedSearch = await scopedSearchResponse.json();
        const retrieve = await retrieveResponse.json();
        const agentContext = await agentContextResponse.json();
        const preview = await previewResponse.json();
        const guide = await guideResponse.json();
        const onboarding = await onboardingResponse.json();

        expect(context.status).toBe('success');
        expect(context.data.focusNote.path).toBe('alpha.md');
        expect(context.data.backlinks).toHaveLength(1);
        expect(scopedSearch.status).toBe('success');
        expect(scopedSearch.data.scopePath).toBe('Architecture');
        expect(scopedSearch.matches).toHaveLength(1);
        expect(scopedSearch.matches[0].path).toBe('Architecture/clean.md');
        expect(retrieve.status).toBe('success');
        expect(retrieve.data.scopePath).toBe('Architecture');
        expect(retrieve.data.chunks.length).toBeGreaterThan(0);
        expect(retrieve.data.chunks.every((chunk: { path: string }) => chunk.path.startsWith('Architecture/'))).toBe(true);
        expect(agentContext.status).toBe('success');
        expect(agentContext.data.focusPath).toBe('alpha.md');
        expect(agentContext.data.summaryText).toBeTruthy();
        expect(agentContext.data.supportingChunks.length).toBeGreaterThan(0);
        expect(preview.status).toBe('success');
        expect(preview.data.previewId).toBeTruthy();
        expect(preview.actions).toHaveLength(6);
        expect(String(guide.content ?? '')).toContain('orion /apply --preview-id <id>');
        expect(Array.isArray(onboarding.commandLines)).toBe(true);
        expect(onboarding.commandLines).toContain('orion /skills');
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
