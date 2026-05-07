import { describe, expect, it } from 'vitest';
import { LocalOrganizationAiProvider } from '../../ai/local-models/local-organization-ai.provider';

describe('LocalOrganizationAiProvider', () => {
  it('builds deterministic actions from note titles', async () => {
    const provider = new LocalOrganizationAiProvider();

    const response = await provider.generateOrganizationPlan({
      vaultRoot: '/vault',
      notes: [
        {
          id: '/vault/alpha.md',
          absolutePath: '/vault/alpha.md',
          relativePath: 'alpha.md',
          content: '# Project Alpha\n\nBody',
          title: 'Project Alpha',
          tags: []
        }
      ]
    });

    expect(response.provider).toBe('local');
    expect(response.actions).toHaveLength(2);
    expect(response.actions[0]).toMatchObject({
      kind: 'create-folder',
      folderPath: 'organized/project'
    });
    expect(response.actions[1]).toMatchObject({
      kind: 'move-note',
      sourcePath: 'alpha.md',
      destinationPath: 'organized/project/alpha.md'
    });
  });
});
