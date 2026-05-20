import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultWorkspace } from '../../../infra/filesystem/workspace/node-vault-workspace';
import { VaultWorkspaceService } from '../../../application/services/vault-workspace.service';

export function createVaultWorkspaceService(vaultRootOverride?: string): {
  readonly config: ReturnType<typeof loadAppConfig>;
  readonly service: VaultWorkspaceService;
  readonly vaultRoot: string;
} {
  const config = loadAppConfig();
  const vaultRoot = vaultRootOverride?.trim() || config.vaultRoot;

  return {
    config,
    vaultRoot,
    service: new VaultWorkspaceService(new NodeVaultWorkspace())
  };
}
