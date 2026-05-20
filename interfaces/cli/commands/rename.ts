import { createVaultWorkspaceService } from '../runtime/vault-workspace-runner';

export interface RenameCommandOptions {
  readonly vaultRoot?: string;
  readonly source?: string;
  readonly destination?: string;
}

export async function executeRenameCommand(options: RenameCommandOptions): Promise<void> {
  const { service, vaultRoot } = createVaultWorkspaceService(options.vaultRoot);
  const source = options.source ?? '';
  const destination = options.destination ?? '';

  await service.renamePath(vaultRoot, source, destination);
  console.log(`Renamed: ${source} -> ${destination}`);
}
