import { createVaultWorkspaceService } from '../runtime/vault-workspace-runner';

export interface CreateFolderCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
}

export async function executeCreateFolderCommand(options: CreateFolderCommandOptions): Promise<void> {
  const { config, service } = createVaultWorkspaceService();
  const folderPath = options.path ?? '';

  await service.createFolder(options.vaultRoot ?? config.vaultRoot, folderPath);
  console.log(`Folder created: ${folderPath}`);
}
