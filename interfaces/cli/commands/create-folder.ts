import { createVaultWorkspaceService } from '../runtime/vault-workspace-runner';

export interface CreateFolderCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
}

export async function executeCreateFolderCommand(options: CreateFolderCommandOptions): Promise<void> {
  const { service, vaultRoot } = createVaultWorkspaceService(options.vaultRoot);
  const folderPath = options.path ?? '';

  await service.createFolder(vaultRoot, folderPath);
  console.log(`Folder created: ${folderPath}`);
}
