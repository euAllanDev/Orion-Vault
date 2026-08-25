import type {
  AiBridgeAgentContextDataDto,
  AiBridgeAgentContextRequestDto,
  AiBridgeResponseDto,
  AiBridgeSearchDataDto,
  AiBridgeSearchRequestDto,
  SearchMatchDto
} from '../../application/dto/ai-bridge.dto';
import type { RetrievalChunkDto } from '../../application/dto/semantic-retrieval.dto';
import type { NoteSnapshotDto } from '../../application/dto/note-snapshot.dto';

export interface OrionMultiVaultService {
  search(request: AiBridgeSearchRequestDto): Promise<AiBridgeResponseDto<AiBridgeSearchDataDto>>;
  loadAgentContext(request: AiBridgeAgentContextRequestDto): Promise<AiBridgeResponseDto<AiBridgeAgentContextDataDto>>;
}

export interface OrionMultiVaultNoteSource {
  getNote(vaultRoot: string, relativePath: string): Promise<NoteSnapshotDto | null>;
}

interface VaultResponse<T> {
  readonly vaultIndex: number;
  readonly response: AiBridgeResponseDto<T>;
}

export interface MultiVaultSearchData extends AiBridgeSearchDataDto {
  readonly resultVaultIndexes: readonly number[];
}

export interface MultiVaultContextData extends AiBridgeAgentContextDataDto {
  readonly chunkVaultIndexes: readonly number[];
  readonly focusVaultIndex?: number;
}

const CONTEXT_MAX_CHUNKS = 8;
const CONTEXT_MAX_CHARACTERS = 4800;

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsable<T>(response: AiBridgeResponseDto<T>): boolean {
  return response.status !== 'error' && response.status !== 'conflict';
}

async function collect<T>(
  vaultRoots: readonly string[],
  operation: (vaultRoot: string) => Promise<AiBridgeResponseDto<T>>
): Promise<readonly VaultResponse<T>[]> {
  const responses: VaultResponse<T>[] = [];

  for (const [vaultIndex, vaultRoot] of vaultRoots.entries()) {
    try {
      responses.push({ vaultIndex, response: await operation(vaultRoot) });
    } catch {
      // A failed Vault must not prevent a later configured Vault from serving the request.
    }
  }

  return responses;
}

function mergeRanked<T extends { readonly score: number; readonly path: string }>(
  values: readonly { readonly value: T; readonly vaultIndex: number; readonly key: string }[]
): readonly { readonly value: T; readonly vaultIndex: number }[] {
  const bestByKey = new Map<string, { readonly value: T; readonly vaultIndex: number }>();

  for (const candidate of values) {
    const existing = bestByKey.get(candidate.key);
    if (!existing || candidate.value.score > existing.value.score || (
      candidate.value.score === existing.value.score && candidate.vaultIndex < existing.vaultIndex
    )) {
      bestByKey.set(candidate.key, { value: candidate.value, vaultIndex: candidate.vaultIndex });
    }
  }

  return [...bestByKey.values()].sort((left, right) =>
    right.value.score - left.value.score || left.vaultIndex - right.vaultIndex || left.value.path.localeCompare(right.value.path)
  );
}

function searchKey(match: SearchMatchDto): string {
  return normalize([match.title ?? '', match.snippet ?? '', match.tags.join('|')].join('|')) || normalize(match.path);
}

function chunkKey(chunk: RetrievalChunkDto): string {
  return normalize(chunk.text) || normalize([chunk.title ?? '', chunk.heading ?? '', chunk.path].join('|'));
}

function retrievalMode(chunks: readonly RetrievalChunkDto[]): 'lexical-only' | 'hybrid' {
  return chunks.some((chunk) => chunk.rankingMode === 'hybrid') ? 'hybrid' : 'lexical-only';
}

export async function searchAcrossVaults(
  service: OrionMultiVaultService,
  vaultRoots: readonly string[],
  input: Omit<AiBridgeSearchRequestDto, 'vaultRoot'>
): Promise<AiBridgeResponseDto<MultiVaultSearchData>> {
  const responses = await collect(vaultRoots, (vaultRoot) => service.search({ ...input, vaultRoot }));
  const usable = responses.filter((item) => isUsable(item.response));

  if (usable.length === 0) {
    return {
      provider: 'system',
      summary: 'Unable to search Orion Vault.',
      actions: [],
      status: 'error',
      issues: [{ code: 'ORION_VAULT_UNAVAILABLE', message: 'No configured Orion Vault could be searched.' }],
      data: emptySearchData(vaultRoots[0] ?? '', input)
    };
  }

  const rankedMatches = mergeRanked(usable.flatMap(({ vaultIndex, response }) =>
    response.data.matches.map((match) => ({ value: match, vaultIndex, key: searchKey(match) }))
  ));
  const rankedChunks = mergeRanked(usable.flatMap(({ vaultIndex, response }) =>
    response.data.chunks.map((chunk) => ({ value: chunk, vaultIndex, key: chunkKey(chunk) }))
  ));
  const matches = rankedMatches.map((item) => item.value);
  const chunks = rankedChunks.map((item) => item.value);

  return {
    provider: 'system',
    summary: matches.length > 0 ? `Found ${matches.length} matching note(s).` : 'No matching notes found.',
    actions: [],
    status: matches.length > 0 ? 'success' : 'noop',
    issues: [],
    data: {
      vaultRoot: vaultRoots[0] ?? '',
      query: input.query,
      phrase: input.phrase,
      tags: input.tags ?? [],
      scopePath: input.scopePath,
      matches,
      chunks,
      retrievalMode: retrievalMode(chunks),
      counts: {
        notes: usable.reduce((count, item) => count + item.response.data.counts.notes, 0),
        matches: matches.length,
        chunks: chunks.length
      },
      resultVaultIndexes: rankedMatches.map((item) => item.vaultIndex)
    }
  };
}

export async function contextAcrossVaults(
  service: OrionMultiVaultService,
  vaultRoots: readonly string[],
  input: Omit<AiBridgeAgentContextRequestDto, 'vaultRoot'>
): Promise<AiBridgeResponseDto<MultiVaultContextData>> {
  const responses = await collect(vaultRoots, (vaultRoot) => service.loadAgentContext({ ...input, vaultRoot }));
  const usable = responses.filter((item) => isUsable(item.response));

  if (usable.length === 0) {
    return {
      provider: 'system',
      summary: 'Unable to load Orion Vault context.',
      actions: [],
      status: 'error',
      issues: [{ code: 'ORION_VAULT_UNAVAILABLE', message: 'No configured Orion Vault could provide context.' }],
      data: emptyContextData(vaultRoots[0] ?? '', input)
    };
  }

  const rankedChunks = mergeRanked(usable.flatMap(({ vaultIndex, response }) =>
    response.data.supportingChunks.map((chunk) => ({ value: chunk, vaultIndex, key: chunkKey(chunk) }))
  ));
  const selectedChunks: RetrievalChunkDto[] = [];
  const selectedVaultIndexes: number[] = [];
  let deliveredCharacters = 0;

  for (const candidate of rankedChunks) {
    if (selectedChunks.length >= CONTEXT_MAX_CHUNKS) break;
    const nextCharacters = deliveredCharacters + candidate.value.text.length;
    if (selectedChunks.length > 0 && nextCharacters > CONTEXT_MAX_CHARACTERS) continue;
    selectedChunks.push(candidate.value);
    selectedVaultIndexes.push(candidate.vaultIndex);
    deliveredCharacters = nextCharacters;
  }

  const focus = usable.find((item) => item.response.data.focusNote);
  const relatedNotes = mergeRanked(usable.flatMap(({ vaultIndex, response }) =>
    response.data.relatedNotes.map((note) => ({ value: note, vaultIndex, key: normalize(`${note.title}|${note.path}`) }))
  ));
  const relevantPaths = [...new Set(usable.flatMap((item) => item.response.data.relevantPaths))];
  const focusTitle = focus?.response.data.focusNote?.title;
  const query = input.query?.trim() || focusTitle;

  return {
    provider: 'system',
    summary: selectedChunks.length > 0 ? `Prepared agent context with ${selectedChunks.length} chunk(s).` : 'No agent context could be prepared from the configured Vaults.',
    actions: [],
    status: selectedChunks.length > 0 || Boolean(focus) ? 'success' : 'noop',
    issues: [],
    data: {
      vaultRoot: vaultRoots[0] ?? '',
      query,
      summaryText: `Contexto montado para ${focusTitle ?? query ?? 'a tarefa atual'}, ${selectedChunks.length} chunk(s) principais selecionados.`,
      scopePath: input.scopePath,
      focusPath: focus?.response.data.focusPath,
      focusNote: focus?.response.data.focusNote,
      supportingChunks: selectedChunks,
      retrievalMode: retrievalMode(selectedChunks),
      relatedNotes: relatedNotes.map((item) => item.value),
      relevantPaths,
      budget: {
        maxChunks: CONTEXT_MAX_CHUNKS,
        maxCharacters: CONTEXT_MAX_CHARACTERS,
        deliveredChunks: selectedChunks.length
      },
      chunkVaultIndexes: selectedVaultIndexes,
      focusVaultIndex: focus?.vaultIndex
    }
  };
}

export async function readAcrossVaults(
  noteSource: OrionMultiVaultNoteSource,
  vaultRoots: readonly string[],
  relativePath: string
): Promise<NoteSnapshotDto | null> {
  for (const vaultRoot of vaultRoots) {
    try {
      const note = await noteSource.getNote(vaultRoot, relativePath);
      if (note) return note;
    } catch {
      // A failed Vault must not prevent a later configured Vault from serving the note.
    }
  }

  return null;
}

function emptySearchData(vaultRoot: string, input: Omit<AiBridgeSearchRequestDto, 'vaultRoot'>): MultiVaultSearchData {
  return {
    vaultRoot,
    query: input.query,
    phrase: input.phrase,
    tags: input.tags ?? [],
    scopePath: input.scopePath,
    matches: [],
    chunks: [],
    retrievalMode: 'lexical-only',
    counts: { notes: 0, matches: 0, chunks: 0 },
    resultVaultIndexes: []
  };
}

function emptyContextData(vaultRoot: string, input: Omit<AiBridgeAgentContextRequestDto, 'vaultRoot'>): MultiVaultContextData {
  return {
    vaultRoot,
    query: input.query,
    summaryText: '',
    scopePath: input.scopePath,
    focusPath: input.focusPath,
    supportingChunks: [],
    retrievalMode: 'lexical-only',
    relatedNotes: [],
    relevantPaths: [],
    budget: { maxChunks: CONTEXT_MAX_CHUNKS, maxCharacters: CONTEXT_MAX_CHARACTERS, deliveredChunks: 0 },
    chunkVaultIndexes: []
  };
}
