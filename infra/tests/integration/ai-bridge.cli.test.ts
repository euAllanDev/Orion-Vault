import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

async function createVaultRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'orion-ai-cli-'));
}

async function runCli(args: readonly string[], envOverrides: NodeJS.ProcessEnv = {}): Promise<string> {
  const tsxPath = path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const entryPath = path.resolve(process.cwd(), 'interfaces', 'cli', 'main.ts');
  const { stdout } = await execFileAsync(process.execPath, [tsxPath, entryPath, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ORION_AI_PROVIDER: 'local',
      ...envOverrides
    }
  });

  return stdout.trim();
}

describe('AI bridge CLI', () => {
  it('lists structured skills and flows for agent discovery', async () => {
    const skillsRaw = await runCli(['/skills', '--category', 'context']);
    const flowsRaw = await runCli(['/flows']);
    const onboardingRaw = await runCli(['/onboarding']);
    const productContextRaw = await runCli(['/product-context']);
    const skills = JSON.parse(skillsRaw) as {
      category: string;
      count: number;
      skills: Array<{ id: string; category: string; kind: string; mutatesVault: boolean; dependsOn: string[] }>;
    };
    const flows = JSON.parse(flowsRaw) as {
      count: number;
      flows: Array<{ id: string; steps: string[] }>;
    };
    const onboarding = JSON.parse(onboardingRaw) as {
      commandLines: string[];
      statusText: string;
    };
    const productContext = JSON.parse(productContextRaw) as {
      productName: string;
      distinction: { app: string; vault: string; appCode: string };
      recommendedCommands: string[];
    };

    expect(skills.category).toBe('context');
    expect(skills.count).toBeGreaterThan(0);
    expect(skills.skills.every((skill) => skill.category === 'context')).toBe(true);
    expect(skills.skills.some((skill) => skill.id === 'agent-context')).toBe(true);
    expect(skills.skills.some((skill) => skill.id === 'analyze-note' && skill.kind === 'composed')).toBe(true);
    expect(skills.skills.some((skill) => skill.id === 'analyze-note' && skill.dependsOn.includes('agent-context'))).toBe(true);
    expect(skills.skills.every((skill) => skill.mutatesVault === false)).toBe(true);
    expect(flows.count).toBeGreaterThan(0);
    expect(flows.flows.some((flow) => flow.id === 'default-note-workflow')).toBe(true);
    expect(onboarding.commandLines).toContain('orion /skills');
    expect(onboarding.commandLines).toContain('orion /route-intent --query "o que voce quer descobrir?"');
    expect(onboarding.commandLines).toContain('orion /product-context');
    expect(onboarding.statusText).toContain('previewId');
    expect(productContext.productName).toBe('Orion Vault');
    expect(productContext.distinction.app).toContain('produto Orion Vault');
    expect(productContext.distinction.vault).toContain('vault ativo');
    expect(productContext.distinction.appCode).toContain('repositorio');
    expect(productContext.recommendedCommands).toContain('orion /route-intent --query "<pergunta>"');
    expect(productContext.recommendedCommands).toContain('orion /product-context');
  });

  it('routes ambiguous app questions into explicit product, vault and code scopes', async () => {
    const productRaw = await runCli(['/route-intent', '--query', 'o que voce acha desse app?']);
    const vaultRaw = await runCli(['/route-intent', '--query', 'quais notas e pastas existem no meu vault?']);
    const codeRaw = await runCli(['/route-intent', '--query', 'como esta o codigo e o repositorio desse app?']);
    const mixedRaw = await runCli(['/route-intent', '--query', 'esse app consegue organizar minhas notas do vault?']);

    const productRoute = JSON.parse(productRaw) as {
      classification: string;
      nextCommand: string;
      needsClarification: boolean;
    };
    const vaultRoute = JSON.parse(vaultRaw) as {
      classification: string;
      nextCommand: string;
    };
    const codeRoute = JSON.parse(codeRaw) as {
      classification: string;
      nextCommand: string;
    };
    const mixedRoute = JSON.parse(mixedRaw) as {
      classification: string;
      needsClarification: boolean;
      clarificationPrompt?: string;
    };

    expect(productRoute.classification).toBe('product');
    expect(productRoute.nextCommand).toBe('orion /product-context');
    expect(productRoute.needsClarification).toBe(false);
    expect(vaultRoute.classification).toBe('vault');
    expect(vaultRoute.nextCommand).toContain('orion /search --query');
    expect(codeRoute.classification).toBe('app-code');
    expect(codeRoute.nextCommand).toBe('orion /product-context');
    expect(mixedRoute.classification).toBe('ambiguous');
    expect(mixedRoute.needsClarification).toBe(true);
    expect(mixedRoute.clarificationPrompt).toContain('produto Orion Vault');
  });

  it('analyzes a note with a composed read-only payload', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Clean Architecture\n\nUse cases orchestrate domain rules.', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Use Cases\n\nClean Architecture keeps application orchestration explicit. [[Clean Architecture]]', 'utf8');

      const raw = await runCli(['/analyze-note', '--vault', vaultRoot, '--path', 'alpha.md']);
      const response = JSON.parse(raw) as {
        status: string;
        data: {
          focusPath: string;
          summaryText: string;
          backlinks: Array<{ targetPath?: string }>;
          relatedNotes: Array<{ path: string }>;
          relevantPaths: string[];
          supportingChunks: unknown[];
          budget: { deliveredChunks: number };
        };
      };

      expect(response.status).toBe('success');
      expect(response.data.focusPath).toBe('alpha.md');
      expect(response.data.summaryText).toContain('Clean Architecture');
      expect(response.data.supportingChunks.length).toBeGreaterThan(0);
      expect(response.data.budget.deliveredChunks).toBe(response.data.supportingChunks.length);
      expect(response.data.backlinks.length).toBeGreaterThan(0);
      expect(response.data.relevantPaths).toContain('beta.md');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('diagnoses maintenance state with a composed read-only payload', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Alpha\n\nBody', 'utf8');

      const raw = await runCli(['/maintenance-diagnose', '--vault', vaultRoot]);
      const response = JSON.parse(raw) as {
        vaultRoot: string;
        retrieval: {
          indexPresent: boolean;
          indexedMode: string;
          indexedNotes: number;
          indexedChunks: number;
          chunksWithEmbeddings: number;
          embeddingModels: string[];
          indexBytes: number;
        };
        inspect: { fileCount: number; markdownFileCount: number; rootKind: string };
        validate: { valid: boolean; issues: string[] };
        doctor: { status: string; readable: boolean; writable: string };
      };

      expect(response.vaultRoot).toBe(vaultRoot);
      expect(response.retrieval.indexPresent).toBe(false);
      expect(response.retrieval.indexedMode).toBe('lexical-only');
      expect(response.retrieval.indexedNotes).toBe(0);
      expect(response.retrieval.indexedChunks).toBe(0);
      expect(response.retrieval.chunksWithEmbeddings).toBe(0);
      expect(response.retrieval.embeddingModels).toEqual([]);
      expect(response.retrieval.indexBytes).toBe(0);
      expect(response.inspect.fileCount).toBeGreaterThan(0);
      expect(response.inspect.markdownFileCount).toBeGreaterThan(0);
      expect(response.inspect.rootKind).toBe('folder');
      expect(response.validate.valid).toBe(true);
      expect(response.doctor.status).toBe('OK');
      expect(response.doctor.readable).toBe(true);
      expect(response.doctor.writable).toBe('not checked');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('reports a hybrid-ready semantic index when embeddings were persisted', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Clean Architecture\n\nUse cases orchestrate domain rules.', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Boundaries\n\nAdapters stay thin across architecture layers.', 'utf8');

      await runCli([
        '/retrieve',
        '--vault', vaultRoot,
        '--query', 'clean architecture boundaries'
      ], {
        ORION_EMBEDDINGS_PROVIDER: 'token-hash'
      });

      const raw = await runCli(['/maintenance-diagnose', '--vault', vaultRoot], {
        ORION_EMBEDDINGS_PROVIDER: 'token-hash'
      });
      const response = JSON.parse(raw) as {
        retrieval: {
          embeddingsProvider: string;
          expectedMode: string;
          indexPresent: boolean;
          indexedMode: string;
          indexedNotes: number;
          indexedChunks: number;
          chunksWithEmbeddings: number;
          embeddingModels: string[];
          indexBytes: number;
        };
      };

      expect(response.retrieval.embeddingsProvider).toBe('token-hash');
      expect(response.retrieval.expectedMode).toBe('hybrid');
      expect(response.retrieval.indexPresent).toBe(true);
      expect(response.retrieval.indexedMode).toBe('hybrid');
      expect(response.retrieval.indexedNotes).toBe(2);
      expect(response.retrieval.indexedChunks).toBeGreaterThan(0);
      expect(response.retrieval.chunksWithEmbeddings).toBeGreaterThan(0);
      expect(response.retrieval.embeddingModels).toContain('token-hash-local');
      expect(response.retrieval.indexBytes).toBeGreaterThan(0);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('prepares a writing task with context, retrieval and next step', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Clean Architecture\n\nUse cases orchestrate domain rules.', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Use Cases\n\nClean Architecture keeps application orchestration explicit. [[Clean Architecture]]', 'utf8');

      const raw = await runCli(['/prepare-writing-task', '--vault', vaultRoot, '--path', 'alpha.md', '--query', 'clean architecture']);
      const response = JSON.parse(raw) as {
        status: string;
        data: {
          focusPath: string;
          summaryText: string;
          supportingChunks: unknown[];
          retrievalChunks: unknown[];
          gaps: string[];
          nextStep: string;
        };
      };

      expect(response.status).toBe('success');
      expect(response.data.focusPath).toBe('alpha.md');
      expect(response.data.summaryText).toContain('Clean Architecture');
      expect(response.data.supportingChunks.length).toBeGreaterThan(0);
      expect(response.data.retrievalChunks.length).toBeGreaterThan(0);
      expect(response.data.gaps).toHaveLength(0);
      expect(response.data.nextStep).toBe('preview');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('prepares an edit task with focus, risks and next step', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Clean Architecture\n\nUse cases orchestrate domain rules.', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Use Cases\n\nClean Architecture keeps application orchestration explicit. [[Clean Architecture]]', 'utf8');

      const raw = await runCli(['/prepare-edit-task', '--vault', vaultRoot, '--path', 'alpha.md', '--query', 'clean architecture']);
      const response = JSON.parse(raw) as {
        status: string;
        data: {
          focusPath: string;
          summaryText: string;
          supportingChunks: unknown[];
          retrievalChunks: unknown[];
          relatedNotes: Array<{ path: string }>;
          editTargets: string[];
          risks: string[];
          nextStep: string;
        };
      };

      expect(response.status).toBe('success');
      expect(response.data.focusPath).toBe('alpha.md');
      expect(response.data.summaryText).toContain('Clean Architecture');
      expect(response.data.supportingChunks.length).toBeGreaterThan(0);
      expect(response.data.retrievalChunks.length).toBeGreaterThan(0);
      expect(response.data.editTargets).toContain('alpha.md');
      expect(response.data.risks).toHaveLength(0);
      expect(response.data.nextStep).toBe('edit');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('builds a dedicated batch organization preview with preview id', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Project Alpha\n\nBody', 'utf8');

      const raw = await runCli(['/organize-batch', '--vault', vaultRoot]);
      const response = JSON.parse(raw) as {
        status: string;
        actions: unknown[];
        batch: { totalNotes: number; scopedNotes: number; selectedNotes: number };
        data: { previewId: string; dryRun: boolean; vaultRoot: string };
      };

      expect(response.status).toBe('success');
      expect(response.data.vaultRoot).toBe(vaultRoot);
      expect(response.data.dryRun).toBe(true);
      expect(response.data.previewId).toBeTruthy();
      expect(response.batch.totalNotes).toBe(1);
      expect(response.batch.scopedNotes).toBe(1);
      expect(response.batch.selectedNotes).toBe(1);
      expect(response.actions.length).toBeGreaterThan(0);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('supports scoped batch organization previews and scoped apply confirmation', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.mkdir(path.join(vaultRoot, 'Inbox'), { recursive: true });
      await fs.mkdir(path.join(vaultRoot, 'Keep'), { recursive: true });
      await fs.writeFile(path.join(vaultRoot, 'Inbox', 'alpha.md'), '# Project Alpha\n\nBody', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'Keep', 'beta.md'), '# Keep Beta\n\nBody', 'utf8');

      const previewRaw = await runCli(['/organize-batch', '--vault', vaultRoot, '--path', 'Inbox']);
      const preview = JSON.parse(previewRaw) as {
        status: string;
        actions: Array<{ kind: string; sourcePath?: string }>;
        batch: { totalNotes: number; scopedNotes: number; selectedNotes: number };
        data: { previewId: string; dryRun: boolean; vaultRoot: string; scopePath?: string };
      };

      expect(preview.status).toBe('success');
      expect(preview.data.scopePath).toBe('Inbox');
      expect(preview.batch.totalNotes).toBe(2);
      expect(preview.batch.scopedNotes).toBe(1);
      expect(preview.batch.selectedNotes).toBe(1);
      expect(preview.actions.every((action) => action.kind !== 'move-note' || action.sourcePath?.startsWith('Inbox/'))).toBe(true);

      const applyRaw = await runCli(['/apply', '--vault', vaultRoot, '--path', 'Inbox', '--preview-id', preview.data.previewId]);
      const apply = JSON.parse(applyRaw) as {
        status: string;
        data: { scopePath?: string; executedActions: Array<{ kind: string; sourcePath?: string }> };
      };

      expect(apply.status).toBe('success');
      expect(apply.data.scopePath).toBe('Inbox');
      expect(apply.data.executedActions.some((action) => action.kind === 'move-note' && action.sourcePath === 'Inbox/alpha.md')).toBe(true);
      await expect(fs.access(path.join(vaultRoot, 'organized', 'project', 'alpha.md'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(vaultRoot, 'Keep', 'beta.md'))).resolves.toBeUndefined();
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('supports query-filtered batch organization previews and apply confirmation', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Project Alpha\n\nBody', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Keep Beta\n\nBody', 'utf8');

      const previewRaw = await runCli(['/organize-batch', '--vault', vaultRoot, '--query', 'project']);
      const preview = JSON.parse(previewRaw) as {
        status: string;
        actions: Array<{ kind: string; sourcePath?: string }>;
        batch: { totalNotes: number; scopedNotes: number; selectedNotes: number };
        data: { previewId: string; query?: string };
      };

      expect(preview.status).toBe('success');
      expect(preview.data.query).toBe('project');
      expect(preview.batch.totalNotes).toBe(2);
      expect(preview.batch.scopedNotes).toBe(2);
      expect(preview.batch.selectedNotes).toBe(1);
      expect(preview.actions.every((action) => action.kind !== 'move-note' || action.sourcePath === 'alpha.md')).toBe(true);

      const applyRaw = await runCli(['/apply', '--vault', vaultRoot, '--query', 'project', '--preview-id', preview.data.previewId]);
      const apply = JSON.parse(applyRaw) as {
        status: string;
        data: { query?: string; executedActions: Array<{ kind: string; sourcePath?: string }> };
      };

      expect(apply.status).toBe('success');
      expect(apply.data.query).toBe('project');
      expect(apply.data.executedActions.some((action) => action.kind === 'move-note' && action.sourcePath === 'alpha.md')).toBe(true);
      await expect(fs.access(path.join(vaultRoot, 'organized', 'project', 'alpha.md'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(vaultRoot, 'beta.md'))).resolves.toBeUndefined();
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('requires preview confirmation before apply and accepts a matching preview id', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Project Alpha\n\nBody', 'utf8');

      const previewRaw = await runCli(['/preview', '--vault', vaultRoot]);
      const preview = JSON.parse(previewRaw) as {
        status: string;
        data: { previewId: string };
      };
      const missingApplyRaw = await runCli(['/apply', '--vault', vaultRoot]);
      const missingApply = JSON.parse(missingApplyRaw) as {
        status: string;
        issues: Array<{ code: string }>;
        data: { previewId: string };
      };
      const applyRaw = await runCli(['/apply', '--vault', vaultRoot, '--preview-id', preview.data.previewId]);
      const apply = JSON.parse(applyRaw) as {
        status: string;
        data: { executedActions: unknown[] };
      };

      expect(preview.status).toBe('success');
      expect(preview.data.previewId).toBeTruthy();
      expect(missingApply.status).toBe('conflict');
      expect(missingApply.issues[0]?.code).toBe('PREVIEW_ID_REQUIRED');
      expect(missingApply.data.previewId).toBe(preview.data.previewId);
      expect(apply.status).toBe('success');
      expect(apply.data.executedActions.length).toBeGreaterThan(0);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('retrieves scoped context chunks for agent-style queries', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.mkdir(path.join(vaultRoot, 'Architecture'), { recursive: true });
      await fs.mkdir(path.join(vaultRoot, 'Personal'), { recursive: true });
      await fs.writeFile(path.join(vaultRoot, 'Architecture', 'clean.md'), '# Clean Architecture\n\nUse cases orchestrate domain rules.', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'Personal', 'journal.md'), '# Journal\n\nArchitecture of my desk.', 'utf8');

      const retrieveRaw = await runCli(['/retrieve', '--vault', vaultRoot, '--query', 'architecture', '--path', 'Architecture']);
      const retrieve = JSON.parse(retrieveRaw) as {
        status: string;
        data: {
          scopePath: string;
          chunks: Array<{ path: string }>;
        };
      };

      expect(retrieve.status).toBe('success');
      expect(retrieve.data.scopePath).toBe('Architecture');
      expect(retrieve.data.chunks.length).toBeGreaterThan(0);
      expect(retrieve.data.chunks.every((chunk) => chunk.path.startsWith('Architecture/'))).toBe(true);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('builds a task-ready agent-context package', async () => {
    const vaultRoot = await createVaultRoot();

    try {
      await fs.writeFile(path.join(vaultRoot, 'alpha.md'), '# Clean Architecture\n\nUse cases orchestrate domain rules.', 'utf8');
      await fs.writeFile(path.join(vaultRoot, 'beta.md'), '# Use Cases\n\nClean Architecture keeps application orchestration explicit. [[Clean Architecture]]', 'utf8');

      const raw = await runCli(['/agent-context', '--vault', vaultRoot, '--path', 'alpha.md']);
      const response = JSON.parse(raw) as {
        status: string;
        data: {
          focusPath: string;
          summaryText: string;
          supportingChunks: unknown[];
          budget: { deliveredChunks: number };
        };
      };

      expect(response.status).toBe('success');
      expect(response.data.focusPath).toBe('alpha.md');
      expect(response.data.summaryText).toContain('Clean Architecture');
      expect(response.data.supportingChunks.length).toBeGreaterThan(0);
      expect(response.data.budget.deliveredChunks).toBe(response.data.supportingChunks.length);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
