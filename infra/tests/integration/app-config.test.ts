import { describe, expect, it } from 'vitest';
import { loadAppConfig } from '../../../infra/config/app-config';

describe('loadAppConfig', () => {
  it('accepts only local providers', () => {
    expect(() =>
      loadAppConfig({
        MARIKA_AI_PROVIDER: 'openai'
      } as NodeJS.ProcessEnv)
    ).toThrow();
  });
});
