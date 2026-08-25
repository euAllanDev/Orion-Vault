export interface VaultWorkspacePort {
  createFolder(vaultRoot: string, folderPath: string): Promise<void>;
  createMarkdownFile(vaultRoot: string, filePath: string, content: string): Promise<void>;
  editMarkdownFile(vaultRoot: string, filePath: string, content: string): Promise<void>;
  editMarkdownFileIfUnchanged(vaultRoot: string, filePath: string, expectedContentHash: string, content: string): Promise<boolean>;
  renamePath(vaultRoot: string, sourcePath: string, destinationPath: string): Promise<void>;
  movePath(vaultRoot: string, sourcePath: string, destinationPath: string): Promise<void>;
  deletePath(vaultRoot: string, targetPath: string): Promise<void>;
}
