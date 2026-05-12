import { createOrganizeUseCase } from '../runtime/organization-runner';

export interface DiffCommandOptions {
  readonly vaultRoot?: string;
}

export async function executeDiffCommand(options: DiffCommandOptions): Promise<void> {
  const { useCase, config } = createOrganizeUseCase();
  const result = await useCase.execute({
    vaultRoot: config.vaultRoot,
    dryRun: true
  });

  console.log(`Vault: ${config.vaultRoot}`);
  console.log(`Planned actions: ${result.plannedActions.length}`);
  for (const action of result.plannedActions) {
    if (action.kind === 'move-note') {
      console.log(`- move ${action.sourcePath} -> ${action.destinationPath}`);
      continue;
    }

    console.log(`- create folder ${action.folderPath}`);
  }
}
