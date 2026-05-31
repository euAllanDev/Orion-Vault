import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalOrganizationAiProvider } from '../../../infra/ai/local-models/local-organization-ai.provider';
import { TokenHashEmbeddingProvider } from '../../../infra/ai/local-models/token-hash-embedding.provider';
import { NodeOrganizationActionExecutor } from '../../../infra/filesystem/movers/node-organization-action-executor';
import { NodeNoteReader } from '../../../infra/filesystem/readers/node-note-reader';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { AiBridgeService } from '../../services/ai-bridge.service';
import { createSemanticNoteRelationsService } from '../../services/semantic-note-relations.service';
import { VaultVerificationService } from '../../services/vault-verification.service';

async function createVaultRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'orion-ai-bridge-'));
}

function createService(withEmbeddings = false, semanticExcludePaths: readonly string[] = []) {
  return new AiBridgeService({
    noteSource: new NodeNoteReader(),
    aiProvider: new LocalOrganizationAiProvider(),
    actionExecutor: new NodeOrganizationActionExecutor(),
    vaultVerifier: new VaultVerificationService(new NodeVaultScanner()),
    relations: createSemanticNoteRelationsService(),
    embeddingProvider: withEmbeddings ? new TokenHashEmbeddingProvider() : undefined,
    semanticExcludePaths
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
      expect(context.data.supportingChunks.length).toBeGreaterThan(0);
      expect(context.data.retrievalMode).toBe('lexical-only');
      expect(context.data.relevantPaths).toContain('beta.md');
      expect(search.status).toBe('success');
      expect(search.data.matches[0]?.path).toBe('alpha.md');
      expect(search.data.chunks.length).toBeGreaterThan(0);
      expect(search.data.retrievalMode).toBe('lexical-only');
      expect(search.data.counts.chunks).toBe(search.data.chunks.length);
      expect(alphaContent).toContain('Project Alpha');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('supports scoped search so agents can stay inside one note or folder context', async () => {
    const vaultRoot = await createVaultRoot();
    const service = createService();

    try {
      await fs.mkdir(path.join(vaultRoot, 'Architecture'), { recursive: true });
      await fs.mkdir(path.join(vaultRoot, 'Personal'), { recursive: true });
      await fs.writeFile(path.join(vaultRoot, 'Architecture', 'clean.md'), '# Clean Architecture\n\nUse cases orchestrate domain rules.', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'Personal', 'journal.md'), '# Journal\n\nArchitecture of my desk.', 'utf8');

      const scoped = await service.search({
        vaultRoot,
        query: 'architecture',
        scopePath: 'Architecture'
      });

      expect(scoped.status).toBe('success');
      expect(scoped.data.scopePath).toBe('Architecture');
      expect(scoped.data.matches).toHaveLength(1);
      expect(scoped.data.matches[0]?.path).toBe('Architecture/clean.md');
      expect(scoped.data.chunks.every((chunk) => chunk.path.startsWith('Architecture/'))).toBe(true);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('builds an agent-context package with focus, chunks and related notes', async () => {
    const vaultRoot = await createVaultRoot();
    const service = createService();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Clean Architecture\n\nUse cases orchestrate domain rules.', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Use Cases\n\nClean Architecture keeps application orchestration explicit. [[Clean Architecture]]', 'utf8');

      const context = await service.loadAgentContext({
        vaultRoot,
        focusPath: 'alpha.md',
        scopePath: 'alpha.md'
      });

      expect(context.status).toBe('success');
      expect(context.data.focusPath).toBe('alpha.md');
      expect(context.data.focusNote?.path).toBe('alpha.md');
      expect(context.data.summaryText).toContain('Clean Architecture');
      expect(context.data.supportingChunks.length).toBeGreaterThan(0);
      expect(context.data.retrievalMode).toBe('lexical-only');
      expect(context.data.budget.deliveredChunks).toBe(context.data.supportingChunks.length);
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

  it('reports hybrid retrieval mode when embeddings are enabled', async () => {
    const vaultRoot = await createVaultRoot();
    const service = createService(true);

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Clean Architecture\n\nUse cases orchestrate domain rules.', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Use Cases\n\nArchitecture boundaries keep adapters thin.', 'utf8');

      const retrieve = await service.retrieve({ vaultRoot, query: 'clean architecture boundaries' });
      const context = await service.loadAgentContext({ vaultRoot, query: 'clean architecture boundaries' });

      expect(retrieve.data.retrievalMode).toBe('hybrid');
      expect(context.data.retrievalMode).toBe('hybrid');
      expect(retrieve.data.chunks.some((chunk) => chunk.rankingMode === 'hybrid')).toBe(true);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('keeps excluded paths out of search and retrieval packages', async () => {
    const vaultRoot = await createVaultRoot();
    const service = createService(false, ['drafts']);

    try {
      await fs.mkdir(path.join(vaultRoot, 'drafts'), { recursive: true });
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Clean Architecture\n\nUse cases orchestrate domain rules.', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'drafts', 'scratch.md'), '# Scratch\n\nClean architecture domain rules repeated here.', 'utf8');

      const retrieve = await service.retrieve({ vaultRoot, query: 'clean architecture domain rules' });
      const search = await service.search({ vaultRoot, query: 'clean architecture' });

      expect(retrieve.data.chunks.every((chunk) => !chunk.path.startsWith('drafts/'))).toBe(true);
      expect(search.data.chunks.every((chunk) => !chunk.path.startsWith('drafts/'))).toBe(true);
      expect(search.data.matches.some((match) => match.path.startsWith('drafts/'))).toBe(true);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
