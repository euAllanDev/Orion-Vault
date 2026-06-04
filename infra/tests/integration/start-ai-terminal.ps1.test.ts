import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

async function createVaultRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'orion-ai-terminal-'));
}

async function runStartAiTerminal(appRoot: string, vaultRoot: string): Promise<{ location: string; vaultRoot: string; onboardingFirstCommand: string; onboardingStatusText: string }> {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  const powerShellPath = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'start-ai-terminal.ps1');
  const runnerPath = path.join(vaultRoot, 'assert-start-ai-terminal.ps1');

  await fs.writeFile(runnerPath, [
    `$scriptPath = '${escapePowerShellLiteral(scriptPath)}'`,
    `$appRoot = '${escapePowerShellLiteral(appRoot)}'`,
    `$vaultRoot = '${escapePowerShellLiteral(vaultRoot)}'`,
    `$nodePath = '${escapePowerShellLiteral(process.execPath)}'`,
    `. $scriptPath -AppRoot $appRoot -VaultRoot $vaultRoot -NodePath $nodePath *> $null`,
    `$onboarding = (orion /onboarding | Out-String).Trim() | ConvertFrom-Json`,
    `[Console]::Out.Write((@{ location = (Get-Location).Path; vaultRoot = $env:ORION_VAULT_ROOT; onboardingFirstCommand = $onboarding.commandLines[0]; onboardingStatusText = $onboarding.statusText } | ConvertTo-Json -Compress))`
  ].join('\n'), 'utf8');

  try {
    const { stdout } = await execFileAsync(powerShellPath, [
      '-NoLogo',
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      runnerPath
    ], {
      cwd: process.cwd(),
      env: process.env
    });

    return JSON.parse(stdout) as { location: string; vaultRoot: string; onboardingFirstCommand: string; onboardingStatusText: string };
  } finally {
    await fs.rm(runnerPath, { force: true });
  }
}

describe('start-ai-terminal.ps1', () => {
  it('starts in the active vault, exports ORION_VAULT_ROOT and keeps onboarding available', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      const result = await runStartAiTerminal(process.cwd(), vaultRoot);

      expect(result.location).toBe(vaultRoot);
      expect(result.vaultRoot).toBe(vaultRoot);
      expect(result.onboardingFirstCommand).toBe('orion /start');
      expect(result.onboardingStatusText).toContain('Orion Vault');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  }, 15000);
});
