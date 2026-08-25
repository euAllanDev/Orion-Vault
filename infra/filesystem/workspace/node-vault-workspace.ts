import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { VaultWorkspacePort } from '../../../application/ports/vault-workspace.port';
import { ValidationError } from '../../../domain/shared/errors/validation-error';
import { resolveCreatableWithinRoot, resolveExistingWithinRoot } from '../path-resolution/path-boundary';

function ensureMarkdownPath(filePath: string): void {
  if (!filePath.toLowerCase().endsWith('.md')) {
    throw new ValidationError('Only Markdown files are supported', 'VAULT_FILE_NOT_MARKDOWN');
  }
}

function ensureProvidedPath(value: string, code: string, message: string): void {
  if (!value.trim()) {
    throw new ValidationError(message, code);
  }
}

async function ensureParentFolder(folderPath: string): Promise<void> {
  await fs.mkdir(folderPath, { recursive: true });
}

export class NodeVaultWorkspace implements VaultWorkspacePort {
  async createFolder(vaultRoot: string, folderPath: string): Promise<void> {
    ensureProvidedPath(folderPath, 'VAULT_FOLDER_PATH_EMPTY', 'Folder path cannot be empty');
    const resolvedPath = await resolveCreatableWithinRoot(vaultRoot, folderPath);

    if (await exists(resolvedPath)) {
      throw new ValidationError('Folder already exists', 'VAULT_FOLDER_EXISTS');
    }

    await ensureParentFolder(resolvedPath);
  }

  async createMarkdownFile(vaultRoot: string, filePath: string, content: string): Promise<void> {
    ensureProvidedPath(filePath, 'VAULT_FILE_PATH_EMPTY', 'File path cannot be empty');
    ensureMarkdownPath(filePath);
    const resolvedPath = await resolveCreatableWithinRoot(vaultRoot, filePath);

    if (await exists(resolvedPath)) {
      throw new ValidationError('File already exists', 'VAULT_FILE_EXISTS');
    }

    await ensureParentFolder(path.dirname(resolvedPath));
    await fs.writeFile(resolvedPath, content, 'utf8');
  }

  async editMarkdownFile(vaultRoot: string, filePath: string, content: string): Promise<void> {
    ensureProvidedPath(filePath, 'VAULT_FILE_PATH_EMPTY', 'File path cannot be empty');
    ensureMarkdownPath(filePath);
    const resolvedPath = await resolveExistingWithinRoot(vaultRoot, filePath);
    const stat = await fs.stat(resolvedPath);

    if (!stat.isFile()) {
      throw new ValidationError('Target is not a file', 'VAULT_TARGET_NOT_FILE');
    }

    await fs.writeFile(resolvedPath, content, 'utf8');
  }

  async editMarkdownFileIfUnchanged(vaultRoot: string, filePath: string, expectedContentHash: string, content: string): Promise<boolean> {
    ensureProvidedPath(filePath, 'VAULT_FILE_PATH_EMPTY', 'File path cannot be empty');
    ensureMarkdownPath(filePath);
    const resolvedPath = await resolveExistingWithinRoot(vaultRoot, filePath);
    const stat = await fs.stat(resolvedPath);

    if (!stat.isFile()) {
      throw new ValidationError('Target is not a file', 'VAULT_TARGET_NOT_FILE');
    }

    const currentContent = await fs.readFile(resolvedPath, 'utf8');
    if (createHash('sha256').update(currentContent).digest('hex') !== expectedContentHash) {
      return false;
    }

    await fs.writeFile(resolvedPath, content, 'utf8');
    return true;
  }

  async renamePath(vaultRoot: string, sourcePath: string, destinationPath: string): Promise<void> {
    await this.movePath(vaultRoot, sourcePath, destinationPath);
  }

  async movePath(vaultRoot: string, sourcePath: string, destinationPath: string): Promise<void> {
    ensureProvidedPath(sourcePath, 'VAULT_SOURCE_PATH_EMPTY', 'Source path cannot be empty');
    ensureProvidedPath(destinationPath, 'VAULT_DESTINATION_PATH_EMPTY', 'Destination path cannot be empty');
    const resolvedSource = await resolveExistingWithinRoot(vaultRoot, sourcePath);
    const resolvedDestination = await resolveCreatableWithinRoot(vaultRoot, destinationPath);

    if (await exists(resolvedDestination)) {
      throw new ValidationError('Destination already exists', 'VAULT_DESTINATION_EXISTS');
    }

    await ensureParentFolder(path.dirname(resolvedDestination));
    await fs.rename(resolvedSource, resolvedDestination);
  }

  async deletePath(vaultRoot: string, targetPath: string): Promise<void> {
    ensureProvidedPath(targetPath, 'VAULT_TARGET_PATH_EMPTY', 'Target path cannot be empty');
    const resolvedTarget = await resolveExistingWithinRoot(vaultRoot, targetPath);
    const stat = await fs.stat(resolvedTarget);

    if (stat.isDirectory()) {
      await fs.rm(resolvedTarget, { recursive: true, force: false });
      return;
    }

    if (!stat.isFile()) {
      throw new ValidationError('Target is not a file or folder', 'VAULT_TARGET_INVALID');
    }

    await fs.unlink(resolvedTarget);
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
