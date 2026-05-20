import { presentAiBridgeJson, presentApplyResponse, presentPlanResponse } from '../presenters/ai-bridge.presenter';
import { createAiBridgeRunner } from '../runtime/ai-bridge-runner';

export interface OrganizeCommandOptions {
  readonly vaultRoot?: string;
  readonly dryRun?: boolean;
  readonly format?: 'text' | 'json';
}

export async function executeOrganizeCommand(options: OrganizeCommandOptions): Promise<void> {
  const { service, vaultRoot, config } = createAiBridgeRunner(options.vaultRoot);

  if (options.dryRun ?? config.defaultDryRun) {
    const response = await service.preview({ vaultRoot });
    if (options.format === 'json') {
      presentAiBridgeJson(response);
      return;
    }

    presentPlanResponse(response);
    return;
  }

  const response = await service.apply({ vaultRoot });

  if (options.format === 'json') {
    presentAiBridgeJson(response);
    return;
  }

  presentApplyResponse(response);
}
