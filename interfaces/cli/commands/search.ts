import { presentAiBridgeJson, presentSearchResponse } from '../presenters/ai-bridge.presenter';
import { createAiBridgeRunner } from '../runtime/ai-bridge-runner';
import { LocalNoteSearchService } from '../../../application/services/local-note-search.service';
import type { SearchMatchDto } from '../../../application/dto/ai-bridge.dto';
import type { NoteSnapshotDto } from '../../../application/dto/note-snapshot.dto';

export interface SearchCommandOptions {
  readonly vaultRoot?: string;
  readonly query?: string;
  readonly phrase?: string;
  readonly tags?: readonly string[];
  readonly format?: 'text' | 'json';
}

export interface SearchCriteria {
  readonly query?: string;
  readonly phrase?: string;
  readonly tags?: readonly string[];
}
export function buildSearchMatches(notes: readonly NoteSnapshotDto[], criteria: SearchCriteria): readonly SearchMatchDto[] {
  return new LocalNoteSearchService().buildMatches(notes, criteria);
}

export async function executeSearchCommand(options: SearchCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRunner(options.vaultRoot);
  const response = await service.search({
    vaultRoot,
    query: options.query,
    phrase: options.phrase,
    tags: options.tags
  });

  if (options.format === 'json') {
    presentAiBridgeJson(response);
    return;
  }

  presentSearchResponse(response);
}
