import { presentAiBridgeJson, presentApplyResponse } from '../presenters/ai-bridge.presenter';
import { createAiBridgeRunner } from '../runtime/ai-bridge-runner';

export interface ApplyCommandOptions {
  readonly vaultRoot?: string;
  readonly previewId?: string;
  readonly path?: string;
  readonly query?: string;
  readonly force?: boolean;
  readonly format?: 'text' | 'json';
}

export async function executeApplyCommand(options: ApplyCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRunner(options.vaultRoot);
  const response = await service.apply({
    vaultRoot,
    previewId: options.previewId,
    scopePath: options.path?.trim() || undefined,
    query: options.query?.trim() || undefined,
    force: options.force
  });

  if (options.format === 'json') {
    presentAiBridgeJson(response);
    return;
  }

  presentApplyResponse(response);
}
