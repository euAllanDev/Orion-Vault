import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { VaultVerificationService } from '../../../vault/services/vault-verification.service';

export interface ScanCommandOptions {
  readonly vaultRoot?: string;
}

export async function executeScanCommand(options: ScanCommandOptions): Promise<void> {
  const config = loadAppConfig();
  const service = new VaultVerificationService(new NodeVaultScanner());
  const report = await service.verify(options.vaultRoot ?? config.vaultRoot);

  console.log(JSON.stringify(report.root, null, 2));
}
