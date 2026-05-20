import { presentAiBridgeJson, presentPlanResponse } from '../presenters/ai-bridge.presenter';
import { createAiBridgeRunner } from '../runtime/ai-bridge-runner';

export interface PlanCommandOptions {
  readonly vaultRoot?: string;
  readonly format?: 'text' | 'json';
}

export async function executePlanCommand(options: PlanCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRunner(options.vaultRoot);
  const response = await service.preview({
    vaultRoot
  });

  if (options.format === 'json') {
    presentAiBridgeJson(response);
    return;
  }

  presentPlanResponse(response);
}
