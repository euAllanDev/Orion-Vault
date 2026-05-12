import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { VaultVerificationService } from '../../../vault/services/vault-verification.service';

export interface DoctorCommandOptions {
  readonly vaultRoot?: string;
}

export async function executeDoctorCommand(_options: DoctorCommandOptions): Promise<void> {
  const config = loadAppConfig();
  const service = new VaultVerificationService(new NodeVaultScanner());
  const report = await service.verify(config.vaultRoot);

  console.log('Doctor: OK');
  console.log(`Vault root: ${report.vaultRoot}`);
  console.log(`Readable: yes`);
  console.log(`Writable: not checked`);
}
