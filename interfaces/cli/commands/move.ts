import { createVaultWorkspaceService } from '../runtime/vault-workspace-runner';

export interface MoveCommandOptions {
  readonly vaultRoot?: string;
  readonly source?: string;
  readonly destination?: string;
}

export async function executeMoveCommand(options: MoveCommandOptions): Promise<void> {
  const { service, vaultRoot } = createVaultWorkspaceService(options.vaultRoot);
  const source = options.source ?? '';
  const destination = options.destination ?? '';

  await service.movePath(vaultRoot, source, destination);
  console.log(`Moved: ${source} -> ${destination}`);
}
