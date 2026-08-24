import { createAiBridgeRuntime } from '../../runtime/ai-bridge-runtime';

export interface DiffCommandOptions {
  readonly vaultRoot?: string;
}

export async function executeDiffCommand(options: DiffCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRuntime(options.vaultRoot);
  const response = await service.preview({
    vaultRoot
  });

  console.log(`Vault: ${vaultRoot}`);
  console.log(`Planned actions: ${response.actions.length}`);
  for (const action of response.actions) {
    if (action.kind === 'move-note') {
      console.log(`- move ${action.sourcePath} -> ${action.destinationPath}`);
      continue;
    }

    console.log(`- create folder ${action.folderPath}`);
  }
}
