import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { loadAppConfig } from '../../../infra/config/app-config';

describe('loadAppConfig', () => {
  it('accepts only local providers', () => {
    expect(() =>
      loadAppConfig({
        ORION_AI_PROVIDER: 'openai'
      } as NodeJS.ProcessEnv)
    ).toThrow();
  });

  it('keeps reading legacy env names during transition', () => {
    const config = loadAppConfig({
      MARIKA_VAULT_ROOT: 'C:\\legacy-vault',
      MARIKA_AI_PROVIDER: 'local',
      MARIKA_EMBEDDINGS_PROVIDER: 'token-hash',
      MARIKA_LOG_LEVEL: 'debug',
      MARIKA_DEFAULT_DRY_RUN: 'false'
    } as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      vaultRoot: 'C:\\legacy-vault',
      aiProvider: 'local',
      embeddingsProvider: 'token-hash',
      logLevel: 'debug',
      defaultDryRun: false
    });
  });

  it('accepts explicit external embedding command configuration', () => {
    const config = loadAppConfig({
      ORION_EMBEDDINGS_PROVIDER: 'external-command',
      ORION_EMBEDDINGS_COMMAND: 'node local-embedder.js'
    } as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      embeddingsProvider: 'external-command',
      embeddingsCommand: 'node local-embedder.js'
    });
  });

  it('normalizes configured write target without requiring one for read-only operation', () => {
    expect(loadAppConfig({} as NodeJS.ProcessEnv).writeVaultRoot).toBeUndefined();
    expect(loadAppConfig({ ORION_WRITE_VAULT_ROOT: '.\\write-vault' } as NodeJS.ProcessEnv).writeVaultRoot).toBe(path.resolve('.\\write-vault'));
  });
});
