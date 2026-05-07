import type { AiProviderPort } from '../../../application/ports/ai-provider.port';
import type { AIResponse } from '../../../domain/ai/entities/ai-response';
import type { AIResponseAction } from '../../../domain/ai/entities/ai-response';
import type { VaultContextDto } from '../../../application/dto/vault-context.dto';
import path from 'node:path';

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'misc';
}

function deriveCategory(note: VaultContextDto['notes'][number]): string {
  const source = note.title?.trim() || path.basename(note.relativePath).replace(/\.[^.]+$/, '');
  const firstToken = source.split(/\s+/)[0] ?? '';
  return slugify(firstToken);
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/');
}

export class LocalOrganizationAiProvider implements AiProviderPort {
  async generateOrganizationPlan(context: VaultContextDto): Promise<AIResponse> {
    const actions: AIResponseAction[] = [];
    const createdFolders = new Set<string>();

    for (const note of context.notes) {
      const relativePath = normalizeRelativePath(note.relativePath);
      const fileName = path.basename(relativePath);
      const category = deriveCategory(note);
      const destinationFolder = `organized/${category}`;
      const destinationPath = `${destinationFolder}/${fileName}`;

      if (relativePath === destinationPath) {
        continue;
      }

      if (!createdFolders.has(destinationFolder)) {
        actions.push({
          kind: 'create-folder',
          id: `create-folder:${destinationFolder}`,
          folderPath: destinationFolder,
          reason: `Prepare destination folder for ${category}`
        });
        createdFolders.add(destinationFolder);
      }

      actions.push({
        kind: 'move-note',
        id: `move-note:${relativePath}->${destinationPath}`,
        sourcePath: relativePath,
        destinationPath,
        reason: note.title ? `Organize note by title: ${note.title}` : 'Organize note by filename'
      });
    }

    return {
      provider: 'local',
      summary:
        actions.length > 0
          ? `Local planner proposed ${actions.length} action(s).`
          : 'Local planner found no changes to make.',
      actions
    };
  }
}
