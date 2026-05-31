import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { VaultVerificationService } from '../../../vault/services/vault-verification.service';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface MaintenanceDiagnoseCommandOptions {
  readonly vaultRoot?: string;
  readonly format?: 'text' | 'json';
}

interface MaintenanceDiagnoseData {
  readonly vaultRoot: string;
  readonly retrieval: {
    readonly embeddingsProvider: string;
    readonly semanticExcludePaths: readonly string[];
    readonly expectedMode: 'lexical-only' | 'hybrid';
    readonly commandConfigured: boolean;
    readonly indexPresent: boolean;
    readonly indexedMode: 'lexical-only' | 'hybrid';
    readonly indexedNotes: number;
    readonly indexedChunks: number;
    readonly chunksWithEmbeddings: number;
    readonly embeddingModels: readonly string[];
    readonly indexBytes: number;
  };
  readonly inspect: {
    readonly folderCount: number;
    readonly fileCount: number;
    readonly markdownFileCount: number;
    readonly totalBytes: number;
    readonly rootKind: string;
    readonly childCount: number;
  };
  readonly validate: {
    readonly valid: boolean;
    readonly issues: readonly string[];
  };
  readonly scan: {
    readonly root: unknown;
  };
  readonly doctor: {
    readonly status: 'OK' | 'REVIEW';
    readonly readable: boolean;
    readonly writable: 'not checked';
  };
}

function presentText(data: MaintenanceDiagnoseData): void {
  console.log(`Maintenance diagnosis for ${data.vaultRoot}`);
  console.log(`Status: ${data.doctor.status}`);
  console.log(`Embeddings provider: ${data.retrieval.embeddingsProvider}`);
  if (data.retrieval.semanticExcludePaths.length > 0) {
    console.log(`Semantic exclude paths: ${data.retrieval.semanticExcludePaths.join(', ')}`);
  }
  console.log(`Expected retrieval mode: ${data.retrieval.expectedMode}`);
  console.log(`Indexed retrieval mode: ${data.retrieval.indexedMode}`);
  console.log(`Semantic index present: ${data.retrieval.indexPresent ? 'yes' : 'no'}`);
  console.log(`Indexed notes: ${data.retrieval.indexedNotes}`);
  console.log(`Indexed chunks: ${data.retrieval.indexedChunks}`);
  console.log(`Chunks with embeddings: ${data.retrieval.chunksWithEmbeddings}`);
  console.log(`Semantic index bytes: ${data.retrieval.indexBytes}`);
  if (data.retrieval.embeddingModels.length > 0) {
    console.log(`Embedding models in index: ${data.retrieval.embeddingModels.join(', ')}`);
  }
  if (data.retrieval.embeddingsProvider === 'external-command') {
    console.log(`External embedding command configured: ${data.retrieval.commandConfigured ? 'yes' : 'no'}`);
  }
  console.log(`Vault valid: ${data.validate.valid ? 'yes' : 'no'}`);
  console.log(`Folders: ${data.inspect.folderCount}`);
  console.log(`Files: ${data.inspect.fileCount}`);
  console.log(`Markdown files: ${data.inspect.markdownFileCount}`);
  console.log(`Total bytes: ${data.inspect.totalBytes}`);
  console.log(`Readable: ${data.doctor.readable ? 'yes' : 'no'}`);
  console.log(`Writable: ${data.doctor.writable}`);
  console.log(`Root kind: ${data.inspect.rootKind}`);
  console.log(`Root children: ${data.inspect.childCount}`);

  if (data.validate.issues.length > 0) {
    console.log('Issues:');
    for (const issue of data.validate.issues) {
      console.log(`- ${issue}`);
    }
  }
}

type PersistedSemanticIndex = {
  readonly notes?: Record<string, { chunks?: Array<{ embeddingModel?: string; embedding?: readonly number[] }> }>;
};

async function readSemanticIndexSummary(vaultRoot: string): Promise<{
  indexPresent: boolean;
  indexedMode: 'lexical-only' | 'hybrid';
  indexedNotes: number;
  indexedChunks: number;
  chunksWithEmbeddings: number;
  embeddingModels: readonly string[];
  indexBytes: number;
}> {
  const indexPath = path.join(vaultRoot, '.orion', 'index', 'semantic-chunks.json');

  try {
    const [raw, stats] = await Promise.all([
      fs.readFile(indexPath, 'utf8'),
      fs.stat(indexPath)
    ]);
    const parsed = JSON.parse(raw) as PersistedSemanticIndex;
    const noteEntries = Object.values(parsed.notes ?? {});
    const chunks = noteEntries.flatMap((entry) => entry.chunks ?? []);
    const chunksWithEmbeddings = chunks.filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0).length;
    const embeddingModels = [...new Set(
      chunks
        .map((chunk) => chunk.embeddingModel?.trim())
        .filter((value): value is string => Boolean(value))
    )].sort();

    return {
      indexPresent: true,
      indexedMode: chunksWithEmbeddings > 0 ? 'hybrid' : 'lexical-only',
      indexedNotes: noteEntries.length,
      indexedChunks: chunks.length,
      chunksWithEmbeddings,
      embeddingModels,
      indexBytes: stats.size
    };
  } catch {
    return {
      indexPresent: false,
      indexedMode: 'lexical-only',
      indexedNotes: 0,
      indexedChunks: 0,
      chunksWithEmbeddings: 0,
      embeddingModels: [],
      indexBytes: 0
    };
  }
}

export async function executeMaintenanceDiagnoseCommand(options: MaintenanceDiagnoseCommandOptions): Promise<void> {
  const config = loadAppConfig();
  const vaultRoot = options.vaultRoot?.trim() || config.vaultRoot;
  const service = new VaultVerificationService(new NodeVaultScanner());
  const [report, indexSummary] = await Promise.all([
    service.verify(vaultRoot),
    readSemanticIndexSummary(vaultRoot)
  ]);
  const commandConfigured = Boolean(config.embeddingsCommand?.trim());
  const expectedMode = config.embeddingsProvider === 'noop'
    ? 'lexical-only'
    : config.embeddingsProvider === 'external-command' && !commandConfigured
      ? 'lexical-only'
      : 'hybrid';

  const data: MaintenanceDiagnoseData = {
    vaultRoot: report.vaultRoot,
    retrieval: {
      embeddingsProvider: config.embeddingsProvider,
      semanticExcludePaths: config.semanticExcludePaths,
      expectedMode,
      commandConfigured,
      indexPresent: indexSummary.indexPresent,
      indexedMode: indexSummary.indexedMode,
      indexedNotes: indexSummary.indexedNotes,
      indexedChunks: indexSummary.indexedChunks,
      chunksWithEmbeddings: indexSummary.chunksWithEmbeddings,
      embeddingModels: indexSummary.embeddingModels,
      indexBytes: indexSummary.indexBytes
    },
    inspect: {
      folderCount: report.folderCount,
      fileCount: report.fileCount,
      markdownFileCount: report.markdownFileCount,
      totalBytes: report.totalBytes,
      rootKind: report.root.kind,
      childCount: report.root.kind === 'folder' ? report.root.children.length : 0
    },
    validate: {
      valid: report.issues.length === 0,
      issues: report.issues
    },
    scan: {
      root: report.root
    },
    doctor: {
      status: report.issues.length === 0 ? 'OK' : 'REVIEW',
      readable: true,
      writable: 'not checked'
    }
  };

  if (options.format === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  presentText(data);
}
