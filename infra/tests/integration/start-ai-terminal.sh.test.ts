import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe.runIf(process.platform === 'linux')('start-ai-terminal.sh', () => {
  it('starts in the active vault and exposes the Orion command contract', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'orion-ai-terminal-'));
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'start-ai-terminal.sh');

    try {
      const { stdout } = await execFileAsync(scriptPath, [
        '--app-root', process.cwd(),
        '--vault-root', vaultRoot,
        '--node-path', process.execPath
      ], {
        env: { ...process.env, ORION_NO_INTERACTIVE_SHELL: '1' }
      });

      expect(stdout).toContain('Vault ativo: ' + vaultRoot);
      expect(stdout).toContain('orion /start');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  }, 15000);
});
