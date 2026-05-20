import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

async function createVaultRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'marika-ai-cli-'));
}

async function runCli(args: readonly string[]): Promise<string> {
  const tsxPath = path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const entryPath = path.resolve(process.cwd(), 'interfaces', 'cli', 'main.ts');
  const { stdout } = await execFileAsync(process.execPath, [tsxPath, entryPath, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MARIKA_AI_PROVIDER: 'local'
    }
  });

  return stdout.trim();
}

describe('AI bridge CLI', () => {
  it('requires preview confirmation before apply and accepts a matching preview id', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Project Alpha\n\nBody', 'utf8');

      const previewRaw = await runCli(['/preview', '--vault', vaultRoot]);
      const preview = JSON.parse(previewRaw) as {
        status: string;
        data: { previewId: string };
      };
      const missingApplyRaw = await runCli(['/apply', '--vault', vaultRoot]);
      const missingApply = JSON.parse(missingApplyRaw) as {
        status: string;
        issues: Array<{ code: string }>;
        data: { previewId: string };
      };
      const applyRaw = await runCli(['/apply', '--vault', vaultRoot, '--preview-id', preview.data.previewId]);
      const apply = JSON.parse(applyRaw) as {
        status: string;
        data: { executedActions: unknown[] };
      };

      expect(preview.status).toBe('success');
      expect(preview.data.previewId).toBeTruthy();
      expect(missingApply.status).toBe('conflict');
      expect(missingApply.issues[0]?.code).toBe('PREVIEW_ID_REQUIRED');
      expect(missingApply.data.previewId).toBe(preview.data.previewId);
      expect(apply.status).toBe('success');
      expect(apply.data.executedActions.length).toBeGreaterThan(0);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
