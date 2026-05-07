import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { VaultVerificationService } from '../../../vault/services/vault-verification.service';
import { presentVaultInspection } from '../presenters/vault-inspection.presenter';

export interface InspectCommandOptions {
  readonly vaultRoot?: string;
}

export async function executeInspectCommand(options: InspectCommandOptions): Promise<void> {
  const config = loadAppConfig();
  const service = new VaultVerificationService(new NodeVaultScanner());
  const report = await service.verify(options.vaultRoot ?? config.vaultRoot);

  presentVaultInspection(report);
}
