import path from 'node:path';
import type { VaultEntryDto } from '../dto/vault-entry.dto';
import type { VaultVerificationReportDto } from '../dto/vault-verification-report.dto';
import type { VaultScannerPort } from '../ports/vault-scanner.port';

function summarizeEntry(entry: VaultEntryDto): {
  folders: number;
  files: number;
  markdownFiles: number;
  totalBytes: number;
} {
  if (entry.kind === 'file') {
    return {
      folders: 0,
      files: 1,
      markdownFiles: entry.extension === 'md' ? 1 : 0,
      totalBytes: entry.sizeBytes
    };
  }

  const summary = entry.children.reduce(
    (accumulator, child) => {
      const childSummary = summarizeEntry(child);
      return {
        folders: accumulator.folders + childSummary.folders,
        files: accumulator.files + childSummary.files,
        markdownFiles: accumulator.markdownFiles + childSummary.markdownFiles,
        totalBytes: accumulator.totalBytes + childSummary.totalBytes
      };
    },
    { folders: 0, files: 0, markdownFiles: 0, totalBytes: 0 }
  );

  return {
    folders: summary.folders + 1,
    files: summary.files,
    markdownFiles: summary.markdownFiles,
    totalBytes: summary.totalBytes
  };
}

function normalizeRelativePath(value: string): string {
  return path.normalize(value).replace(/\\/g, '/').toLowerCase();
}

function collectIssues(rootPath: string, entry: VaultEntryDto, issues: string[], seenPaths: Set<string>): void {
  const absolutePath = path.resolve(entry.absolutePath);
  const expectedRelativePath = path.relative(rootPath, absolutePath);
  const normalizedExpected = normalizeRelativePath(expectedRelativePath);
  const normalizedActual = normalizeRelativePath(entry.relativePath);

  if (expectedRelativePath.startsWith('..') || path.isAbsolute(expectedRelativePath)) {
    issues.push(`ESCAPE_PATH:${entry.absolutePath}`);
  }

  if (normalizedExpected !== normalizedActual) {
    issues.push(`PATH_MISMATCH:${entry.absolutePath}`);
  }

  if (seenPaths.has(normalizedActual)) {
    issues.push(`PATH_CONFLICT:${entry.relativePath}`);
  }
  seenPaths.add(normalizedActual);

  if (entry.kind === 'file') {
    if (entry.sizeBytes === 0) {
      issues.push(`EMPTY_FILE:${entry.relativePath}`);
    }

    if (entry.extension === 'md' && !entry.title) {
      issues.push(`MISSING_METADATA:title:${entry.relativePath}`);
    }

    if (entry.extension === 'md' && entry.preview.length === 0) {
      issues.push(`MISSING_METADATA:preview:${entry.relativePath}`);
    }

    return;
  }

  for (const child of entry.children) {
    collectIssues(rootPath, child, issues, seenPaths);
  }
}

export class VaultVerificationService {
  constructor(private readonly scanner: VaultScannerPort) {}

  async verify(vaultRoot: string): Promise<VaultVerificationReportDto> {
    const root = await this.scanner.scan(vaultRoot);
    const summary = summarizeEntry(root);
    const issues: string[] = [];

    collectIssues(path.resolve(vaultRoot), root, issues, new Set<string>());

    return {
      vaultRoot,
      root,
      folderCount: summary.folders,
      fileCount: summary.files,
      markdownFileCount: summary.markdownFiles,
      totalBytes: summary.totalBytes,
      issues
    };
  }
}
