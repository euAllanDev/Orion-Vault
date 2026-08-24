import { presentAgentContextResponse, presentAiBridgeJson } from '../presenters/ai-bridge.presenter';
import { createAiBridgeRuntime } from '../../runtime/ai-bridge-runtime';

export interface AgentContextCommandOptions {
  readonly vaultRoot?: string;
  readonly query?: string;
  readonly path?: string;
  readonly tags?: readonly string[];
  readonly format?: 'text' | 'json';
  readonly debug?: boolean;
}

export async function executeAgentContextCommand(options: AgentContextCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRuntime(options.vaultRoot);
  const response = await service.loadAgentContext({
    vaultRoot,
    query: options.query,
    focusPath: options.path,
    scopePath: options.path,
    tags: options.tags
  });

  if (options.format === 'json') {
    presentAiBridgeJson(response);
    return;
  }

  presentAgentContextResponse(response, options.debug);
}
