import { describe, expect, it } from 'vitest';
import { OrganizeNotesUseCase } from '../../use-cases/organize-notes/organize-notes.use-case';
import type { AiProviderPort } from '../../ports/ai-provider.port';
import type { ActionExecutorPort } from '../../ports/action-executor.port';
import type { LoggerPort } from '../../ports/logger.port';
import type { NoteSourcePort } from '../../ports/note-source.port';

describe('OrganizeNotesUseCase', () => {
  it('returns a local dry-run plan without filesystem writes', async () => {
    const noteSource: NoteSourcePort = {
      async listNotes() {
        return [
          {
            id: '/vault/alpha.md',
            absolutePath: '/vault/alpha.md',
            relativePath: 'alpha.md',
            content: '# Project Alpha\n\nBody',
            title: 'Project Alpha',
            tags: []
          }
        ];
      },
      async getNote() {
        return null;
      }
    };

    const aiProvider: AiProviderPort = {
      async generateOrganizationPlan() {
        return {
          provider: 'local',
          summary: 'ok',
          actions: [
            {
              kind: 'create-folder',
              id: 'create-folder:organized/project',
              folderPath: 'organized/project'
            },
            {
              kind: 'move-note',
              id: 'move-note:alpha.md->organized/project/alpha.md',
              sourcePath: 'alpha.md',
              destinationPath: 'organized/project/alpha.md'
            }
          ]
        };
      }
    };

    const actionExecutor: ActionExecutorPort = {
      async execute() {
        throw new Error('should not execute in dry-run');
      }
    };

    const logger: LoggerPort = {
      debug() {},
      info() {},
      warn() {},
      error() {}
    };

    const useCase = new OrganizeNotesUseCase({
      noteSource,
      aiProvider,
      actionExecutor,
      logger
    });

    const result = await useCase.execute({
      vaultRoot: '/vault',
      dryRun: true
    });

    expect(result.dryRun).toBe(true);
    expect(result.plannedActions).toHaveLength(2);
    expect(result.executedActions).toHaveLength(0);
    expect(result.skippedActions).toHaveLength(2);
  });
});
