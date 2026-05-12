import { createOrganizeUseCase } from '../runtime/organization-runner';
import { presentOrganizeResult } from '../presenters/organization-result.presenter';

export interface PlanCommandOptions {
  readonly vaultRoot?: string;
}

export async function executePlanCommand(options: PlanCommandOptions): Promise<void> {
  const { useCase, config } = createOrganizeUseCase();
  const result = await useCase.execute({
    vaultRoot: config.vaultRoot,
    dryRun: true
  });

  presentOrganizeResult(result);
}
