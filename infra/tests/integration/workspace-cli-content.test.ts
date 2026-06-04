import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

async function createVaultRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'orion-workspace-cli-'));
}

async function runCli(args: readonly string[]): Promise<void> {
  const tsxPath = path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const entryPath = path.resolve(process.cwd(), 'interfaces', 'cli', 'main.ts');
  await execFileAsync(process.execPath, [tsxPath, entryPath, ...args], {
    cwd: process.cwd(),
    env: process.env
  });
}

async function runCliWithStdin(args: readonly string[], input: string): Promise<void> {
  const tsxPath = path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const entryPath = path.resolve(process.cwd(), 'interfaces', 'cli', 'main.ts');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [tsxPath, entryPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `CLI exited with code ${code}`));
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

describe('workspace CLI content parsing', () => {
  it('preserves multiline content when the shell splits content into multiple arguments', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await runCli([
        'touch',
        '--vault', vaultRoot,
        '--path', 'notes/brazil.md',
        '--content',
        '# Brasil na Copa do Mundo de 2022',
        'O Brasil chegou a Copa com expectativa alta.',
        'A eliminacao veio nos penaltis.'
      ]);

      const content = await fs.readFile(path.join(vaultRoot, 'notes', 'brazil.md'), 'utf8');
      expect(content).toBe([
        '# Brasil na Copa do Mundo de 2022',
        'O Brasil chegou a Copa com expectativa alta.',
        'A eliminacao veio nos penaltis.'
      ].join('\n'));
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('loads multiline content from --content-file', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      const sourcePath = path.join(vaultRoot, 'source.md');
      const sourceContent = ['# Titulo', '', 'Linha 1', 'Linha 2'].join('\n');
      await fs.writeFile(sourcePath, sourceContent, 'utf8');

      await runCli([
        'touch',
        '--vault', vaultRoot,
        '--path', 'notes/from-file.md',
        '--content-file', sourcePath
      ]);

      const content = await fs.readFile(path.join(vaultRoot, 'notes', 'from-file.md'), 'utf8');
      expect(content).toBe(sourceContent);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('loads multiline content from stdin', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      const input = ['# Titulo stdin', '', 'Linha A', 'Linha B'].join('\n');

      await runCliWithStdin([
        'touch',
        '--vault', vaultRoot,
        '--path', 'notes/from-stdin.md',
        '--stdin'
      ], input);

      const content = await fs.readFile(path.join(vaultRoot, 'notes', 'from-stdin.md'), 'utf8');
      expect(content).toBe(input);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
