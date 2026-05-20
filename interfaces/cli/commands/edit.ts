import { createVaultWorkspaceService } from '../runtime/vault-workspace-runner';

export interface EditCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
  readonly content?: string;
}

export async function executeEditCommand(options: EditCommandOptions): Promise<void> {
  const { service, vaultRoot } = createVaultWorkspaceService(options.vaultRoot);
  const filePath = options.path ?? '';

  await service.editMarkdownFile(vaultRoot, filePath, options.content ?? '');
  console.log(`File updated: ${filePath}`);
}
