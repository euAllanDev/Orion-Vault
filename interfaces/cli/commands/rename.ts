import { createVaultWorkspaceService } from '../runtime/vault-workspace-runner';

export interface RenameCommandOptions {
  readonly vaultRoot?: string;
  readonly source?: string;
  readonly destination?: string;
}

export async function executeRenameCommand(options: RenameCommandOptions): Promise<void> {
  const { config, service } = createVaultWorkspaceService();
  const source = options.source ?? '';
  const destination = options.destination ?? '';

  await service.renamePath(options.vaultRoot ?? config.vaultRoot, source, destination);
  console.log(`Renamed: ${source} -> ${destination}`);
}
