import { presentAiBridgeJson, presentRetrieveResponse } from '../presenters/ai-bridge.presenter';
import { createAiBridgeRunner } from '../runtime/ai-bridge-runner';

export interface RetrieveCommandOptions {
  readonly vaultRoot?: string;
  readonly query?: string;
  readonly tags?: readonly string[];
  readonly path?: string;
  readonly format?: 'text' | 'json';
  readonly debug?: boolean;
}

export async function executeRetrieveCommand(options: RetrieveCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRunner(options.vaultRoot);
  const response = await service.retrieve({
    vaultRoot,
    query: options.query,
    tags: options.tags,
    scopePath: options.path
  });

  if (options.format === 'json') {
    presentAiBridgeJson(response);
    return;
  }

  presentRetrieveResponse(response, options.debug);
}
