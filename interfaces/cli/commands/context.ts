import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { VaultVerificationService } from '../../../vault/services/vault-verification.service';

export interface ContextCommandOptions {
  readonly vaultRoot?: string;
}

export async function executeContextCommand(options: ContextCommandOptions): Promise<void> {
  const config = loadAppConfig();
  const service = new VaultVerificationService(new NodeVaultScanner());
  const report = await service.verify(options.vaultRoot ?? config.vaultRoot);

  console.log(`Vault: ${report.vaultRoot}`);
  console.log(`Folders: ${report.folderCount}`);
  console.log(`Files: ${report.fileCount}`);
  console.log(`Markdown files: ${report.markdownFileCount}`);
  console.log('Top level:');

  if (report.root.kind === 'folder') {
    for (const child of report.root.children) {
      console.log(`- ${child.relativePath || child.name}`);
    }
  }
}
