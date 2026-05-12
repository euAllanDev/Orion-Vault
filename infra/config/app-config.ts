import fs from 'node:fs';
import { z } from 'zod';

export function getDefaultVaultRoot(): string {
  return 'C:\\MarikaVault';
}

export const AppConfigSchema = z.object({
  vaultRoot: z.string().min(1).default(getDefaultVaultRoot()),
  aiProvider: z.enum(['noop', 'local']).default('noop'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  defaultDryRun: z.boolean().default(true)
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = AppConfigSchema.parse({
    vaultRoot: env.MARIKA_VAULT_ROOT,
    aiProvider: env.MARIKA_AI_PROVIDER,
    logLevel: env.MARIKA_LOG_LEVEL,
    defaultDryRun:
      env.MARIKA_DEFAULT_DRY_RUN === 'true'
        ? true
        : env.MARIKA_DEFAULT_DRY_RUN === 'false'
          ? false
        : undefined
  });

  fs.mkdirSync(config.vaultRoot, { recursive: true });
  return config;
}
