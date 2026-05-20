import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalOrganizationAiProvider } from '../../../infra/ai/local-models/local-organization-ai.provider';
import { NodeOrganizationActionExecutor } from '../../../infra/filesystem/movers/node-organization-action-executor';
import { NodeNoteReader } from '../../../infra/filesystem/readers/node-note-reader';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { AiBridgeService } from '../../services/ai-bridge.service';
import { createSemanticNoteRelationsService } from '../../services/semantic-note-relations.service';
import { VaultVerificationService } from '../../services/vault-verification.service';

async function createVaultRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'marika-ai-bridge-'));
}

function createService() {
  return new AiBridgeService({
    noteSource: new NodeNoteReader(),
    aiProvider: new LocalOrganizationAiProvider(),
    actionExecutor: new NodeOrganizationActionExecutor(),
    vaultVerifier: new VaultVerificationService(new NodeVaultScanner()),
    relations: createSemanticNoteRelationsService()
  });
}

describe('AiBridgeService', () => {
  it('loads structured context and search data without mutating the vault', async () => {
    const vaultRoot = await createVaultRoot();
    const service = createService();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Project Alpha\n\n#project\n\nBody', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Beta\n\nLinks [[Project Alpha]]', 'utf8');

      const context = await service.loadContext({ vaultRoot, focusPath: 'alpha.md' });
      const search = await service.search({ vaultRoot, query: 'project alpha' });
      const alphaContent = await fs.readFile(path.join(vaultRoot, 'alpha.md'), 'utf8');

      expect(context.status).toBe('success');
      expect(context.data.focusNote?.path).toBe('alpha.md');
      expect(context.data.backlinks).toHaveLength(1);
      expect(context.data.relevantPaths).toContain('beta.md');
      expect(search.status).toBe('success');
      expect(search.data.matches[0]?.path).toBe('alpha.md');
      expect(alphaContent).toContain('Project Alpha');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('keeps preview deterministic and applies the validated plan', async () => {
    const vaultRoot = await createVaultRoot();
    const service = createService();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Project Alpha\n\nBody', 'utf8');

      const preview = await service.preview({ vaultRoot });
      const previewAgain = await service.plan({ vaultRoot });

      expect(preview.status).toBe('success');
      expect(preview.data.previewId).toBe(previewAgain.data.previewId);
      expect(preview.actions).toHaveLength(2);
      await expect(fs.access(path.join(vaultRoot, 'organized', 'project', 'alpha.md'))).rejects.toThrow();

      const apply = await service.apply({ vaultRoot, previewId: preview.data.previewId });

      expect(apply.status).toBe('success');
      await expect(fs.access(path.join(vaultRoot, 'organized', 'project', 'alpha.md'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(vaultRoot, 'alpha.md'))).rejects.toThrow();
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('rejects apply payloads that do not match the validated preview or escape the vault', async () => {
    const vaultRoot = await createVaultRoot();
    const service = createService();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Project Alpha\n\nBody', 'utf8');

      const preview = await service.preview({ vaultRoot });
      const missingPreview = await service.apply({ vaultRoot });
      const mismatch = await service.apply({ vaultRoot, previewId: 'stale-preview-id' });
      const escaped = await service.apply({
        vaultRoot,
        force: true,
        actions: [
          {
            kind: 'move-note',
            id: 'escape-attempt',
            sourcePath: 'alpha.md',
            destinationPath: '../escape/alpha.md'
          }
        ]
      });

      expect(preview.status).toBe('success');
      expect(missingPreview.status).toBe('conflict');
      expect(missingPreview.issues[0]?.code).toBe('PREVIEW_ID_REQUIRED');
      expect(missingPreview.data.previewId).toBe(preview.data.previewId);
      expect(mismatch.status).toBe('conflict');
      expect(mismatch.issues[0]?.code).toBe('PREVIEW_ID_MISMATCH');
      expect(escaped.status).toBe('error');
      expect(escaped.issues[0]?.message).toContain('Path escapes vault boundary');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
