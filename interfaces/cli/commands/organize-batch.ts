import { presentAiBridgeJson } from '../presenters/ai-bridge.presenter';
import { createAiBridgeRunner } from '../runtime/ai-bridge-runner';
import type { AiBridgePlanDataDto, AiBridgeResponseDto } from '../../../application/dto/ai-bridge.dto';
import { NodeNoteReader } from '../../../infra/filesystem/readers/node-note-reader';
import { LocalNoteSearchService } from '../../../application/services/local-note-search.service';
import type { NoteSnapshotDto } from '../../../application/dto/note-snapshot.dto';

export interface OrganizeBatchCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
  readonly query?: string;
  readonly format?: 'text' | 'json';
}

interface OrganizeBatchSummary {
  readonly totalNotes: number;
  readonly scopedNotes: number;
  readonly selectedNotes: number;
}

interface OrganizeBatchResponse extends AiBridgeResponseDto<AiBridgePlanDataDto> {
  readonly batch: OrganizeBatchSummary;
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function filterNotesByScope(notes: readonly NoteSnapshotDto[], scopePath: string | undefined): readonly NoteSnapshotDto[] {
  const normalizedScope = normalizeRelativePath(scopePath ?? '');
  if (!normalizedScope) {
    return notes;
  }

  if (/\.(md|markdown)$/i.test(normalizedScope)) {
    return notes.filter((note) => normalizeRelativePath(note.relativePath) === normalizedScope);
  }

  return notes.filter((note) => normalizeRelativePath(note.relativePath).startsWith(`${normalizedScope}/`));
}

async function buildBatchSummary(vaultRoot: string, scopePath?: string, query?: string): Promise<OrganizeBatchSummary> {
  const noteReader = new NodeNoteReader();
  const searchService = new LocalNoteSearchService();
  const notes = await noteReader.listNotes(vaultRoot);
  const scopedNotes = filterNotesByScope(notes, scopePath);
  const normalizedQuery = query?.trim() || undefined;
  const selectedNotes = normalizedQuery
    ? (() => {
        const matches = searchService.buildMatches(scopedNotes, { query: normalizedQuery });
        const matchedPaths = new Set(matches.map((match) => match.path));
        return scopedNotes.filter((note) => matchedPaths.has(note.relativePath));
      })()
    : scopedNotes;

  return {
    totalNotes: notes.length,
    scopedNotes: scopedNotes.length,
    selectedNotes: selectedNotes.length
  };
}

function presentText(response: OrganizeBatchResponse): void {
  console.log('Prepared batch organization preview.');
  console.log(`Status: ${response.status}`);
  console.log(`Vault: ${response.data.vaultRoot}`);
  if (response.data.query) {
    console.log(`Query: ${response.data.query}`);
  }
  if (response.data.scopePath) {
    console.log(`Scope: ${response.data.scopePath}`);
  }
  console.log(`Notes in vault: ${response.batch.totalNotes}`);
  console.log(`Notes in scope: ${response.batch.scopedNotes}`);
  console.log(`Notes selected: ${response.batch.selectedNotes}`);
  console.log(`Preview: ${response.data.previewId || '(none)'}`);
  console.log(`Actions: ${response.actions.length}`);

  for (const action of response.actions) {
    if (action.kind === 'move-note') {
      console.log(`- move ${action.sourcePath} -> ${action.destinationPath}`);
      continue;
    }

    console.log(`- create folder ${action.folderPath}`);
  }

  if (response.status !== 'error' && response.data.previewId) {
    const querySuffix = response.data.query ? ` --query "${response.data.query}"` : '';
    const scopeSuffix = response.data.scopePath ? ` --path "${response.data.scopePath}"` : '';
    console.log(`Next: orion /apply${scopeSuffix}${querySuffix} --preview-id ${response.data.previewId}`);
  }

  if (response.issues.length > 0) {
    console.log('Issues:');
    for (const issue of response.issues) {
      console.log(`- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ''}`);
    }
  }
}

export async function executeOrganizeBatchCommand(options: OrganizeBatchCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRunner(options.vaultRoot);
  const scopePath = options.path?.trim() || undefined;
  const query = options.query?.trim() || undefined;
  const response = await service.preview({
    vaultRoot,
    scopePath,
    query
  });
  const batch = await buildBatchSummary(vaultRoot, scopePath, query);
  const organizeBatchResponse: OrganizeBatchResponse = {
    ...response,
    batch
  };

  if (options.format === 'json') {
    presentAiBridgeJson(organizeBatchResponse);
    return;
  }

  presentText(organizeBatchResponse);
}
