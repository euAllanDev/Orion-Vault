import { createVaultWorkspaceService } from '../runtime/vault-workspace-runner';

export interface MoveCommandOptions {
  readonly vaultRoot?: string;
  readonly source?: string;
  readonly destination?: string;
}

export async function executeMoveCommand(options: MoveCommandOptions): Promise<void> {
  const { config, service } = createVaultWorkspaceService();
  const source = options.source ?? '';
  const destination = options.destination ?? '';

  await service.movePath(options.vaultRoot ?? config.vaultRoot, source, destination);
  console.log(`Moved: ${source} -> ${destination}`);
}
