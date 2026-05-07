import { createOrganizeUseCase } from '../runtime/organization-runner';
import { presentOrganizeResult } from '../presenters/organization-result.presenter';

export interface OrganizeCommandOptions {
  readonly vaultRoot?: string;
  readonly dryRun?: boolean;
}

export async function executeOrganizeCommand(options: OrganizeCommandOptions): Promise<void> {
  const { useCase, config } = createOrganizeUseCase();

  const result = await useCase.execute({
    vaultRoot: options.vaultRoot ?? config.vaultRoot,
    dryRun: options.dryRun ?? config.defaultDryRun
  });

  presentOrganizeResult(result);
}
