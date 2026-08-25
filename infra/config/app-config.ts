import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';

export function getDefaultVaultRoot(): string {
  return path.join(os.homedir() || os.tmpdir(), 'OrionVault');
}

function readEnvValue(env: NodeJS.ProcessEnv, key: string, legacyKey?: string): string | undefined {
  return env[key] ?? (legacyKey ? env[legacyKey] : undefined);
}

export const AppConfigSchema = z.object({
  vaultRoot: z.string().min(1).default(getDefaultVaultRoot()),
  writeVaultRoot: z.string().min(1).optional(),
  aiProvider: z.enum(['noop', 'local']).default('noop'),
  embeddingsProvider: z.enum(['noop', 'token-hash', 'expanded-token-hash', 'external-command']).default('noop'),
  embeddingsCommand: z.string().trim().min(1).optional(),
  semanticExcludePaths: z.array(z.string().trim().min(1)).default([]),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  defaultDryRun: z.boolean().default(true)
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const semanticExcludePaths = String(readEnvValue(env, 'ORION_SEMANTIC_EXCLUDE_PATHS', 'MARIKA_SEMANTIC_EXCLUDE_PATHS') ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\\/g, '/').replace(/^\.\//, ''))
    .filter(Boolean);

  const config = AppConfigSchema.parse({
    vaultRoot: readEnvValue(env, 'ORION_VAULT_ROOT', 'MARIKA_VAULT_ROOT'),
    writeVaultRoot: env.ORION_WRITE_VAULT_ROOT?.trim() ? path.resolve(env.ORION_WRITE_VAULT_ROOT.trim()) : undefined,
    aiProvider: readEnvValue(env, 'ORION_AI_PROVIDER', 'MARIKA_AI_PROVIDER'),
    embeddingsProvider: readEnvValue(env, 'ORION_EMBEDDINGS_PROVIDER', 'MARIKA_EMBEDDINGS_PROVIDER'),
    embeddingsCommand: readEnvValue(env, 'ORION_EMBEDDINGS_COMMAND', 'MARIKA_EMBEDDINGS_COMMAND'),
    semanticExcludePaths,
    logLevel: readEnvValue(env, 'ORION_LOG_LEVEL', 'MARIKA_LOG_LEVEL'),
    defaultDryRun:
      readEnvValue(env, 'ORION_DEFAULT_DRY_RUN', 'MARIKA_DEFAULT_DRY_RUN') === 'true'
        ? true
        : readEnvValue(env, 'ORION_DEFAULT_DRY_RUN', 'MARIKA_DEFAULT_DRY_RUN') === 'false'
          ? false
        : undefined
  });

  try {
    fs.mkdirSync(config.vaultRoot, { recursive: true });
  } catch {
    // Keep startup alive even if the default vault path cannot be created.
  }
  return config;
}
