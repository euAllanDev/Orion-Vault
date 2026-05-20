import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { NodeNoteReader } from '../../../infra/filesystem/readers/node-note-reader';
import { NodeOrganizationActionExecutor } from '../../../infra/filesystem/movers/node-organization-action-executor';
import { LocalOrganizationAiProvider } from '../../../infra/ai/local-models/local-organization-ai.provider';
import { NoopOrganizationAiProvider } from '../../../infra/ai/local-models/noop-organization-ai.provider';
import { createSemanticNoteRelationsService } from '../../../application/services/semantic-note-relations.service';
import { VaultVerificationService } from '../../../application/services/vault-verification.service';
import { AiBridgeService } from '../../../application/services/ai-bridge.service';

export function createAiBridgeRunner(vaultRootOverride?: string): {
  readonly config: ReturnType<typeof loadAppConfig>;
  readonly service: AiBridgeService;
  readonly vaultRoot: string;
} {
  const config = loadAppConfig();
  const aiProvider = config.aiProvider === 'local'
    ? new LocalOrganizationAiProvider()
    : new NoopOrganizationAiProvider();
  const vaultRoot = vaultRootOverride?.trim() || config.vaultRoot;

  return {
    config,
    vaultRoot,
    service: new AiBridgeService({
      noteSource: new NodeNoteReader(),
      aiProvider,
      actionExecutor: new NodeOrganizationActionExecutor(),
      vaultVerifier: new VaultVerificationService(new NodeVaultScanner()),
      relations: createSemanticNoteRelationsService()
    })
  };
}
