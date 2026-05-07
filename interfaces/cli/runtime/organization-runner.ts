import { OrganizeNotesUseCase } from '../../../application/use-cases/organize-notes/organize-notes.use-case';
import { loadAppConfig } from '../../../infra/config/app-config';
import { createConsoleLogger } from '../../../infra/logging/logger';
import { NodeNoteReader } from '../../../infra/filesystem/readers/node-note-reader';
import { NoopOrganizationAiProvider } from '../../../infra/ai/local-models/noop-organization-ai.provider';
import { LocalOrganizationAiProvider } from '../../../infra/ai/local-models/local-organization-ai.provider';
import { NodeOrganizationActionExecutor } from '../../../infra/filesystem/movers/node-organization-action-executor';

export function createOrganizeUseCase(): {
  readonly useCase: OrganizeNotesUseCase;
  readonly config: ReturnType<typeof loadAppConfig>;
} {
  const config = loadAppConfig();
  const logger = createConsoleLogger(config.logLevel);
  const aiProvider = config.aiProvider === 'local'
    ? new LocalOrganizationAiProvider()
    : new NoopOrganizationAiProvider();

  return {
    config,
    useCase: new OrganizeNotesUseCase({
      noteSource: new NodeNoteReader(),
      aiProvider,
      actionExecutor: new NodeOrganizationActionExecutor(),
      logger
    })
  };
}
