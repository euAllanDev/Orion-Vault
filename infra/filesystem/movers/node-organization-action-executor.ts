import fs from 'node:fs/promises';
import type { ActionExecutorPort } from '../../../application/ports/action-executor.port';
import type { ActionExecutionReportDto } from '../../../application/dto/action-execution-report.dto';
import type { OrganizationAction } from '../../../domain/organization/entities/action';
import { NodeFileMover } from './node-file-mover';
import { NodeFolderWriter } from '../writers/node-folder-writer';
import { resolveWithinRoot } from '../path-resolution/path-boundary';

export class NodeOrganizationActionExecutor implements ActionExecutorPort {
  constructor(
    private readonly fileMover = new NodeFileMover(),
    private readonly folderWriter = new NodeFolderWriter()
  ) {}

  async execute(actions: readonly OrganizationAction[], vaultRoot: string): Promise<ActionExecutionReportDto> {
    const executed: OrganizationAction[] = [];
    const skipped: OrganizationAction[] = [];

    for (const action of actions) {
      if (action.kind === 'create-folder') {
        const folderPath = resolveWithinRoot(vaultRoot, action.folderPath ?? '');
        await this.folderWriter.ensureFolder(folderPath);
        executed.push(action);
        continue;
      }

      const sourcePath = resolveWithinRoot(vaultRoot, action.sourcePath ?? '');
      const destinationPath = resolveWithinRoot(vaultRoot, action.destinationPath ?? '');

      try {
        await fs.access(destinationPath);
        skipped.push(action);
        continue;
      } catch {
        await this.fileMover.moveFile(sourcePath, destinationPath);
        executed.push(action);
      }
    }

    return { executed, skipped };
  }
}
