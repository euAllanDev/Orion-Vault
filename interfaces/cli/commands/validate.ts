import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { VaultVerificationService } from '../../../vault/services/vault-verification.service';

export interface ValidateCommandOptions {
  readonly vaultRoot?: string;
}

export async function executeValidateCommand(_options: ValidateCommandOptions): Promise<void> {
  const config = loadAppConfig();
  const service = new VaultVerificationService(new NodeVaultScanner());
  const report = await service.verify(config.vaultRoot);

  console.log(`Vault valid: ${report.issues.length === 0 ? 'yes' : 'no'}`);
  console.log(`Vault: ${report.vaultRoot}`);
  console.log(`Folders: ${report.folderCount}`);
  console.log(`Files: ${report.fileCount}`);
  console.log(`Markdown files: ${report.markdownFileCount}`);
  console.log(`Total bytes: ${report.totalBytes}`);

  if (report.issues.length > 0) {
    console.log('Issues:');
    for (const issue of report.issues) {
      console.log(`- ${issue}`);
    }
  }
}
