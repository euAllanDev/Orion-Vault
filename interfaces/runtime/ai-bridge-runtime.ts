import { loadAppConfig } from '../../infra/config/app-config';
import { NodeVaultScanner } from '../../infra/filesystem/readers/node-vault-scanner';
import { NodeNoteReader } from '../../infra/filesystem/readers/node-note-reader';
import { NodeOrganizationActionExecutor } from '../../infra/filesystem/movers/node-organization-action-executor';
import { LocalOrganizationAiProvider } from '../../infra/ai/local-models/local-organization-ai.provider';
import { NoopOrganizationAiProvider } from '../../infra/ai/local-models/noop-organization-ai.provider';
import { createEmbeddingProvider } from '../../infra/ai/local-models/embedding-provider.factory';
import { createSemanticNoteRelationsService } from '../../application/services/semantic-note-relations.service';
import { AgentTaskContextService } from '../../application/services/agent-task-context.service';
import { OrionKnowledgeFacade } from '../../application/services/orion-knowledge-facade';
import { OrionSourceRegistry } from '../../application/services/orion-source-registry';
import { VaultVerificationService } from '../../application/services/vault-verification.service';
import { AiBridgeService } from '../../application/services/ai-bridge.service';
import type { NoteSourcePort } from '../../application/ports/note-source.port';
import { RememberKnowledgeUseCase } from '../../application/use-cases/remember-knowledge/remember-knowledge.use-case';
import { NodeVaultWorkspace } from '../../infra/filesystem/workspace/node-vault-workspace';

export const ORION_VAULT_ROOTS_SEPARATOR = ';';

export function resolveOrionVaultRoots(env: NodeJS.ProcessEnv, fallbackRoot: string): readonly string[] {
  const configuredRoots = (env.ORION_VAULT_ROOTS ?? '')
    .split(ORION_VAULT_ROOTS_SEPARATOR)
    .map((value) => value.trim())
    .filter(Boolean);
  const roots = configuredRoots.length > 0 ? configuredRoots : [fallbackRoot];
  const seen = new Set<string>();

  return roots.filter((root) => {
    const key = root.replace(/\\/g, '/').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createAiBridgeRuntime(vaultRootOverride?: string): {
  readonly config: ReturnType<typeof loadAppConfig>;
  readonly service: AiBridgeService;
  readonly noteSource: NoteSourcePort;
  readonly vaultRoot: string;
  readonly vaultRoots: readonly string[];
  readonly sourceRegistry: OrionSourceRegistry;
  readonly knowledge: OrionKnowledgeFacade;
  /** Session-owned task API. Do not expose the registry to skills directly. */
  readonly tasks: AgentTaskContextService;
  readonly rememberService: RememberKnowledgeUseCase;
} {
  const config = loadAppConfig();
  const aiProvider = config.aiProvider === 'local'
    ? new LocalOrganizationAiProvider()
    : new NoopOrganizationAiProvider();
  const embeddingProvider = createEmbeddingProvider(config);
  const vaultRoot = vaultRootOverride?.trim() || config.vaultRoot;

  const noteSource = new NodeNoteReader();

  const vaultRoots = vaultRootOverride?.trim() ? [vaultRoot] : resolveOrionVaultRoots(process.env, vaultRoot);

  const sourceRegistry = new OrionSourceRegistry();
  const service = new AiBridgeService({
    noteSource,
    aiProvider,
    embeddingProvider,
    semanticExcludePaths: config.semanticExcludePaths,
    actionExecutor: new NodeOrganizationActionExecutor(),
    vaultVerifier: new VaultVerificationService(new NodeVaultScanner()),
    relations: createSemanticNoteRelationsService()
  });

  return {
    config,
    vaultRoot,
    vaultRoots,
    sourceRegistry,
    knowledge: new OrionKnowledgeFacade({ service, noteSource, vaultRoots, sourceRegistry }),
    tasks: new AgentTaskContextService(sourceRegistry),
    noteSource,
    rememberService: new RememberKnowledgeUseCase({
      noteSource,
      workspace: new NodeVaultWorkspace(),
      writeVaultRoot: config.writeVaultRoot,
      readVaultRoots: vaultRoots
    }),
    service
  };
}
