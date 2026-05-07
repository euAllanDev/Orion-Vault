import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultWorkspace } from '../../../infra/filesystem/workspace/node-vault-workspace';
import { VaultWorkspaceService } from '../../../application/services/vault-workspace.service';

export function createVaultWorkspaceService(): {
  readonly config: ReturnType<typeof loadAppConfig>;
  readonly service: VaultWorkspaceService;
} {
  const config = loadAppConfig();

  return {
    config,
    service: new VaultWorkspaceService(new NodeVaultWorkspace())
  };
}
