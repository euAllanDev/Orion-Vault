import type {
  AiBridgeAgentContextDataDto,
  AiBridgeAgentContextRequestDto,
  AiBridgeResponseDto,
  AiBridgeSearchDataDto,
  AiBridgeSearchRequestDto,
  SearchMatchDto
} from '../../application/dto/ai-bridge.dto';
import type { NoteSnapshotDto } from '../../application/dto/note-snapshot.dto';
import type { RetrievalChunkDto } from '../../application/dto/semantic-retrieval.dto';
import type { OrionSourceRegistry } from '../../application/services/orion-source-registry';

export interface OrionMultiVaultService {
  search(request: AiBridgeSearchRequestDto): Promise<AiBridgeResponseDto<AiBridgeSearchDataDto>>;
  loadAgentContext(request: AiBridgeAgentContextRequestDto): Promise<AiBridgeResponseDto<AiBridgeAgentContextDataDto>>;
}

export interface OrionMultiVaultNoteSource {
  getNote(vaultRoot: string, relativePath: string): Promise<NoteSnapshotDto | null>;
}

export interface MultiVaultSearchData extends AiBridgeSearchDataDto {
  readonly matches: readonly (SearchMatchDto & { readonly sourceRef?: string })[];
  readonly chunks: readonly (RetrievalChunkDto & { readonly sourceRef?: string })[];
  readonly resultVaultIndexes: readonly number[];
}

export interface MultiVaultContextData extends AiBridgeAgentContextDataDto {
  readonly supportingChunks: readonly (RetrievalChunkDto & { readonly sourceRef?: string })[];
  readonly chunkVaultIndexes: readonly number[];
  readonly focusVaultIndex?: number;
  readonly focusSourceRef?: string;
  readonly relatedNoteSourceRefs: readonly string[];
}

export interface MultiVaultReadResult {
  readonly note: NoteSnapshotDto | null;
  readonly vaultAvailable: boolean;
}

type VaultResponse<T> = { readonly vaultIndex: number; readonly response: AiBridgeResponseDto<T> };

const CONTEXT_MAX_CHUNKS = 8;
const CONTEXT_MAX_CHARACTERS = 4800;

function usable<T>(response: AiBridgeResponseDto<T>): boolean {
  return response.status !== 'error' && response.status !== 'conflict';
}

async function collect<T>(vaultRoots: readonly string[], operation: (vaultRoot: string) => Promise<AiBridgeResponseDto<T>>): Promise<readonly VaultResponse<T>[]> {
  const responses: VaultResponse<T>[] = [];
  for (const [vaultIndex, vaultRoot] of vaultRoots.entries()) {
    try {
      responses.push({ vaultIndex, response: await operation(vaultRoot) });
    } catch {
      // Later configured Vaults remain usable when one Vault fails.
    }
  }
  return responses;
}

function ranked<T extends { readonly score: number; readonly path: string }>(values: readonly { readonly value: T; readonly vaultIndex: number }[]): readonly { readonly value: T; readonly vaultIndex: number }[] {
  return [...values].sort((left, right) => right.value.score - left.value.score || left.vaultIndex - right.vaultIndex || left.value.path.localeCompare(right.value.path));
}

function mode(chunks: readonly RetrievalChunkDto[]): 'lexical-only' | 'hybrid' {
  return chunks.some((chunk) => chunk.rankingMode === 'hybrid') ? 'hybrid' : 'lexical-only';
}

export async function searchAcrossVaults(service: OrionMultiVaultService, vaultRoots: readonly string[], input: Omit<AiBridgeSearchRequestDto, 'vaultRoot'>, sourceRegistry?: OrionSourceRegistry): Promise<AiBridgeResponseDto<MultiVaultSearchData>> {
  const responses = (await collect(vaultRoots, (vaultRoot) => service.search({ ...input, vaultRoot }))).filter(({ response }) => usable(response));
  if (responses.length === 0) return unavailableSearch(vaultRoots[0] ?? '', input);

  const matches = ranked(responses.flatMap(({ vaultIndex, response }) => response.data.matches.map((value) => ({ value, vaultIndex }))));
  const chunks = ranked(responses.flatMap(({ vaultIndex, response }) => response.data.chunks.map((value) => ({ value, vaultIndex }))));
  return {
    provider: 'system', summary: matches.length ? `Found ${matches.length} matching note(s).` : 'No matching notes found.', actions: [], status: matches.length ? 'success' : 'noop', issues: [],
    data: {
      vaultRoot: vaultRoots[0] ?? '', query: input.query, phrase: input.phrase, tags: input.tags ?? [], scopePath: input.scopePath,
      matches: matches.map(({ value, vaultIndex }) => ({ ...value, sourceRef: sourceRegistry?.register(vaultIndex, value.path) })),
      chunks: chunks.map(({ value, vaultIndex }) => ({ ...value, sourceRef: sourceRegistry?.register(vaultIndex, value.path) })),
      retrievalMode: mode(chunks.map(({ value }) => value)),
      counts: { notes: responses.reduce((count, item) => count + item.response.data.counts.notes, 0), matches: matches.length, chunks: chunks.length },
      resultVaultIndexes: matches.map(({ vaultIndex }) => vaultIndex)
    }
  };
}

export async function contextAcrossVaults(service: OrionMultiVaultService, vaultRoots: readonly string[], input: Omit<AiBridgeAgentContextRequestDto, 'vaultRoot'>, sourceRegistry?: OrionSourceRegistry): Promise<AiBridgeResponseDto<MultiVaultContextData>> {
  const responses = (await collect(vaultRoots, (vaultRoot) => service.loadAgentContext({ ...input, vaultRoot }))).filter(({ response }) => usable(response));
  if (responses.length === 0) return unavailableContext(vaultRoots[0] ?? '', input);

  const chunks = ranked(responses.flatMap(({ vaultIndex, response }) => response.data.supportingChunks.map((value) => ({ value, vaultIndex }))));
  const selected: typeof chunks[number][] = [];
  let characters = 0;
  for (const candidate of chunks) {
    if (selected.length >= CONTEXT_MAX_CHUNKS) break;
    if (selected.length > 0 && characters + candidate.value.text.length > CONTEXT_MAX_CHARACTERS) continue;
    selected.push(candidate);
    characters += candidate.value.text.length;
  }
  const focus = responses.find(({ response }) => response.data.focusNote);
  const related = ranked(responses.flatMap(({ vaultIndex, response }) => response.data.relatedNotes.map((value) => ({ value, vaultIndex }))));
  const focusPath = focus?.response.data.focusPath;
  return {
    provider: 'system', summary: selected.length || focus ? `Prepared agent context with ${selected.length} chunk(s).` : 'No agent context could be prepared from the configured Vaults.', actions: [], status: selected.length || focus ? 'success' : 'noop', issues: [],
    data: {
      vaultRoot: vaultRoots[0] ?? '', query: input.query?.trim() || focus?.response.data.focusNote?.title,
      summaryText: `Contexto montado para ${focus?.response.data.focusNote?.title ?? input.query ?? 'a tarefa atual'}, ${selected.length} chunk(s) principais selecionados.`,
      scopePath: input.scopePath, focusPath, focusNote: focus?.response.data.focusNote,
      supportingChunks: selected.map(({ value, vaultIndex }) => ({ ...value, sourceRef: sourceRegistry?.register(vaultIndex, value.path) })),
      retrievalMode: mode(selected.map(({ value }) => value)),
      relatedNotes: related.map(({ value }) => value),
      relevantPaths: [...new Set(responses.flatMap(({ response }) => response.data.relevantPaths))],
      budget: { maxChunks: CONTEXT_MAX_CHUNKS, maxCharacters: CONTEXT_MAX_CHARACTERS, deliveredChunks: selected.length },
      chunkVaultIndexes: selected.map(({ vaultIndex }) => vaultIndex), focusVaultIndex: focus?.vaultIndex,
      focusSourceRef: focusPath ? sourceRegistry?.register(focus!.vaultIndex, focusPath) : undefined,
      relatedNoteSourceRefs: related.map(({ value, vaultIndex }) => sourceRegistry?.register(vaultIndex, value.path)).filter((value): value is string => Boolean(value))
    }
  };
}

export async function readAcrossVaults(noteSource: OrionMultiVaultNoteSource, vaultRoots: readonly string[], relativePath: string): Promise<MultiVaultReadResult> {
  let vaultAvailable = false;
  for (const vaultRoot of vaultRoots) {
    try {
      const note = await noteSource.getNote(vaultRoot, relativePath);
      vaultAvailable = true;
      if (note) return { note, vaultAvailable };
    } catch {
      // Keep configured priority while allowing another Vault to answer.
    }
  }
  return { note: null, vaultAvailable };
}

export async function readFromVault(noteSource: OrionMultiVaultNoteSource, vaultRoot: string, relativePath: string): Promise<MultiVaultReadResult> {
  try {
    return { note: await noteSource.getNote(vaultRoot, relativePath), vaultAvailable: true };
  } catch {
    return { note: null, vaultAvailable: false };
  }
}

function unavailableSearch(vaultRoot: string, input: Omit<AiBridgeSearchRequestDto, 'vaultRoot'>): AiBridgeResponseDto<MultiVaultSearchData> {
  return { provider: 'system', summary: 'Unable to search Orion Vault.', actions: [], status: 'error', issues: [{ code: 'ORION_VAULT_UNAVAILABLE', message: 'No configured Orion Vault could be searched.' }], data: { vaultRoot, query: input.query, phrase: input.phrase, tags: input.tags ?? [], scopePath: input.scopePath, matches: [], chunks: [], retrievalMode: 'lexical-only', counts: { notes: 0, matches: 0, chunks: 0 }, resultVaultIndexes: [] } };
}

function unavailableContext(vaultRoot: string, input: Omit<AiBridgeAgentContextRequestDto, 'vaultRoot'>): AiBridgeResponseDto<MultiVaultContextData> {
  return { provider: 'system', summary: 'Unable to load Orion Vault context.', actions: [], status: 'error', issues: [{ code: 'ORION_VAULT_UNAVAILABLE', message: 'No configured Orion Vault could provide context.' }], data: { vaultRoot, query: input.query, summaryText: '', scopePath: input.scopePath, focusPath: input.focusPath, supportingChunks: [], retrievalMode: 'lexical-only', relatedNotes: [], relevantPaths: [], budget: { maxChunks: CONTEXT_MAX_CHUNKS, maxCharacters: CONTEXT_MAX_CHARACTERS, deliveredChunks: 0 }, chunkVaultIndexes: [], relatedNoteSourceRefs: [] } };
}
