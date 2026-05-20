import { presentAiBridgeJson, presentContextResponse } from '../presenters/ai-bridge.presenter';
import { createAiBridgeRunner } from '../runtime/ai-bridge-runner';

export interface ContextCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
  readonly format?: 'text' | 'json';
}

export async function executeContextCommand(options: ContextCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRunner(options.vaultRoot);
  const response = await service.loadContext({
    vaultRoot,
    focusPath: options.path
  });

  if (options.format === 'json') {
    presentAiBridgeJson(response);
    return;
  }

  presentContextResponse(response);
}
