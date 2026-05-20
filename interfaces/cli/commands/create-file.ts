import { createVaultWorkspaceService } from '../runtime/vault-workspace-runner';

export interface CreateFileCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
  readonly content?: string;
}

export async function executeCreateFileCommand(options: CreateFileCommandOptions): Promise<void> {
  const { service, vaultRoot } = createVaultWorkspaceService(options.vaultRoot);
  const filePath = options.path ?? '';

  await service.createMarkdownFile(vaultRoot, filePath, options.content ?? '');
  console.log(`File created: ${filePath}`);
}
