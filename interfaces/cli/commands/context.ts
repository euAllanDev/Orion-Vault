import { presentAiBridgeJson, presentContextResponse } from '../presenters/ai-bridge.presenter';
import { createAiBridgeRuntime } from '../../runtime/ai-bridge-runtime';

export interface ContextCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
  readonly format?: 'text' | 'json';
}

export async function executeContextCommand(options: ContextCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRuntime(options.vaultRoot);
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
