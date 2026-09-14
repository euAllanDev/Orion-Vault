import fs from 'node:fs/promises';
import path from 'node:path';
import type { VaultEntryDto } from '../../../vault/dto/vault-entry.dto';
import type { VaultScannerPort } from '../../../vault/ports/vault-scanner.port';

function shouldIgnoreVaultEntry(name: string): boolean {
  return ['.orion', '.opencode', 'node_modules'].includes(name.trim().toLowerCase());
}

function extractTitle(content: string): string | undefined {
  const heading = content.split(/\r?\n/).find((line) => line.startsWith('# '));
  return heading ? heading.replace(/^#\s+/, '').trim() || undefined : undefined;
}

function extractPreview(content: string): readonly string[] {
  return content
    .split(/\r?\n/)
    .slice(0, 3)
    .map((line) => line.trimEnd());
}

async function scanEntry(rootPath: string, absolutePath: string): Promise<VaultEntryDto> {
  const stat = await fs.stat(absolutePath);

  if (stat.isDirectory()) {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    const children = await Promise.all(
      entries
        .filter((entry) => !shouldIgnoreVaultEntry(entry.name))
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => scanEntry(rootPath, path.join(absolutePath, entry.name)))
    );

    return {
      kind: 'folder',
      name: path.basename(absolutePath),
      absolutePath,
      relativePath: path.relative(rootPath, absolutePath),
      children
    };
  }

  const content = stat.isFile() ? await fs.readFile(absolutePath, 'utf8') : '';
  const extension = path.extname(absolutePath).replace(/^\./, '');

  return {
    kind: 'file',
    name: path.basename(absolutePath),
    absolutePath,
    relativePath: path.relative(rootPath, absolutePath),
    sizeBytes: stat.size,
    extension,
    title: extension === 'md' ? extractTitle(content) : undefined,
    preview: extension === 'md' ? extractPreview(content) : [],
    modifiedAt: stat.mtimeMs,
    createdAt: stat.birthtimeMs || stat.ctimeMs
  };
}

export class NodeVaultScanner implements VaultScannerPort {
  async scan(vaultRoot: string): Promise<VaultEntryDto> {
    return scanEntry(path.resolve(vaultRoot), path.resolve(vaultRoot));
  }
}
