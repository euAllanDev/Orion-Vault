import type { VaultWorkspacePort } from '../ports/vault-workspace.port';

export class VaultWorkspaceService {
  constructor(private readonly workspace: VaultWorkspacePort) {}

  createFolder(vaultRoot: string, folderPath: string): Promise<void> {
    return this.workspace.createFolder(vaultRoot, folderPath);
  }

  createMarkdownFile(vaultRoot: string, filePath: string, content: string): Promise<void> {
    return this.workspace.createMarkdownFile(vaultRoot, filePath, content);
  }

  editMarkdownFile(vaultRoot: string, filePath: string, content: string): Promise<void> {
    return this.workspace.editMarkdownFile(vaultRoot, filePath, content);
  }

  renamePath(vaultRoot: string, sourcePath: string, destinationPath: string): Promise<void> {
    return this.workspace.renamePath(vaultRoot, sourcePath, destinationPath);
  }

  movePath(vaultRoot: string, sourcePath: string, destinationPath: string): Promise<void> {
    return this.workspace.movePath(vaultRoot, sourcePath, destinationPath);
  }
}
