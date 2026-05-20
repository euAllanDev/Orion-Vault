export interface VaultWorkspacePort {
  createFolder(vaultRoot: string, folderPath: string): Promise<void>;
  createMarkdownFile(vaultRoot: string, filePath: string, content: string): Promise<void>;
  editMarkdownFile(vaultRoot: string, filePath: string, content: string): Promise<void>;
  renamePath(vaultRoot: string, sourcePath: string, destinationPath: string): Promise<void>;
  movePath(vaultRoot: string, sourcePath: string, destinationPath: string): Promise<void>;
  deletePath(vaultRoot: string, targetPath: string): Promise<void>;
}
