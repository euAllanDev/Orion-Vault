import { createHash } from 'node:crypto';
import path from 'node:path';
import type { AiProviderPort } from '../ports/ai-provider.port';
import type { ActionExecutorPort } from '../ports/action-executor.port';
import type { NoteSourcePort } from '../ports/note-source.port';
import type {
  AiBridgeActionDto,
  AiBridgeAgentContextDataDto,
  AiBridgeAgentContextRequestDto,
  AiBridgeApplyDataDto,
  AiBridgeApplyRequestDto,
  AiBridgeContextDataDto,
  AiBridgeContextRequestDto,
  AiBridgeIssueDto,
  AiBridgeRetrieveDataDto,
  AiBridgeRetrieveRequestDto,
  AiBridgeNoteSummaryDto,
  AiBridgePlanDataDto,
  AiBridgePlanRequestDto,
  AiBridgeResponseDto,
  AiBridgeSearchDataDto,
  AiBridgeSearchRequestDto,
  AiBridgeStatus
} from '../dto/ai-bridge.dto';
import type { NoteSnapshotDto } from '../dto/note-snapshot.dto';
import type { VaultEntryDto } from '../../vault/dto/vault-entry.dto';
import { OrganizationContextService } from './organization-context.service';
import { OrganizationPlanService } from './organization-plan.service';
import { LocalNoteSearchService } from './local-note-search.service';
import type { SemanticNoteRelationsService } from './semantic-note-relations.service';
import type { VaultVerificationService } from './vault-verification.service';
import { ValidationError } from '../../domain/shared/errors/validation-error';
import type { OrganizationAction } from '../../domain/organization/entities/action';
import { SemanticRetrievalService } from './semantic-retrieval.service';
import { ChunkedNoteIndexService } from './chunked-note-index.service';
import type { EmbeddingProviderPort } from '../ports/embedding-provider.port';

export interface AiBridgeServiceDependencies {
  readonly noteSource: NoteSourcePort;
  readonly aiProvider: AiProviderPort;
  readonly actionExecutor: ActionExecutorPort;
  readonly vaultVerifier: VaultVerificationService;
  readonly relations: SemanticNoteRelationsService;
  readonly embeddingProvider?: EmbeddingProviderPort;
  readonly semanticExcludePaths?: readonly string[];
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function noteMatchesTarget(note: NoteSnapshotDto, target: string): boolean {
  const normalizedTarget = normalizeText(target);
  const candidates = [
    note.relativePath,
    path.basename(note.relativePath, path.extname(note.relativePath)),
    note.title ?? ''
  ];

  return candidates.some((candidate) => normalizeText(candidate) === normalizedTarget);
}

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

function toNoteSummary(note: NoteSnapshotDto): AiBridgeNoteSummaryDto {
  return {
    path: note.relativePath,
    title: note.title,
    tags: note.tags,
    wordCount: countWords(note.content)
  };
}

function collectVerifiedMarkdownPaths(entry: VaultEntryDto, paths: Set<string>): void {
  if (entry.kind === 'file') {
    if (entry.extension.toLowerCase() === 'md') {
      paths.add(normalizeRelativePath(entry.relativePath));
    }
    return;
  }

  for (const child of entry.children) {
    collectVerifiedMarkdownPaths(child, paths);
  }
}

function serializeAction(action: OrganizationAction): AiBridgeActionDto {
  if (action.kind === 'move-note') {
    return {
      kind: 'move-note',
      id: action.id.toString(),
      reason: action.reason,
      sourcePath: action.sourcePath ?? '',
      destinationPath: action.destinationPath ?? ''
    };
  }

  return {
    kind: 'create-folder',
    id: action.id.toString(),
    reason: action.reason,
    folderPath: action.folderPath ?? ''
  };
}

function serializeActions(actions: readonly OrganizationAction[]): readonly AiBridgeActionDto[] {
  return actions.map(serializeAction);
}

function buildPreviewId(vaultRoot: string, actions: readonly AiBridgeActionDto[]): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ vaultRoot, actions }));
  return hash.digest('hex').slice(0, 16);
}

function issueFromError(error: unknown, fallbackCode = 'BRIDGE_ERROR'): AiBridgeIssueDto {
  if (error instanceof ValidationError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code ?? fallbackCode;
    return { code, message: error.message };
  }

  return { code: fallbackCode, message: 'Unexpected bridge error.' };
}

function mergeRelevantPaths(
  focusPath: string | undefined,
  backlinks: readonly { targetPath?: string }[],
  relatedNotes: readonly { path: string }[]
): readonly string[] {
  const values = [
    focusPath,
    ...backlinks.map((item) => item.targetPath).filter((value): value is string => Boolean(value)),
    ...relatedNotes.map((item) => item.path)
  ].filter((value): value is string => Boolean(value));

  return [...new Set(values)];
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

function summarizePlan(provider: string, actionCount: number, dryRun: boolean): string {
  if (actionCount === 0) {
    return dryRun ? 'Preview found no changes to apply.' : 'Apply found no changes to execute.';
  }

  return dryRun
    ? `${provider} planned ${actionCount} action(s) for preview.`
    : `${provider} executed plan with ${actionCount} action(s).`;
}

function buildAgentContextSummary(params: {
  query?: string;
  focusTitle?: string;
  chunkCount: number;
  relatedTitles: readonly string[];
}): string {
  const parts: string[] = [];

  if (params.focusTitle) {
    parts.push(`Foco principal em ${params.focusTitle}`);
  } else if (params.query) {
    parts.push(`Contexto montado para ${params.query}`);
  } else {
    parts.push('Contexto montado para a tarefa atual');
  }

  parts.push(`${params.chunkCount} chunk(s) principais selecionados`);

  if (params.relatedTitles.length > 0) {
    parts.push(`relações fortes com ${params.relatedTitles.slice(0, 2).join(' e ')}`);
  }

  return `${parts.join(', ')}.`;
}

function inferRetrievalMode(chunks: readonly { rankingMode?: 'lexical-only' | 'hybrid' }[]): 'lexical-only' | 'hybrid' {
  return chunks.some((chunk) => chunk.rankingMode === 'hybrid') ? 'hybrid' : 'lexical-only';
}

export class AiBridgeService {
  private readonly contextService = new OrganizationContextService();
  private readonly planService = new OrganizationPlanService();
  private readonly searchService = new LocalNoteSearchService();
  private readonly retrievalService: SemanticRetrievalService;

  constructor(private readonly dependencies: AiBridgeServiceDependencies) {
    this.retrievalService = new SemanticRetrievalService(
      new ChunkedNoteIndexService(dependencies.embeddingProvider, { excludedPaths: dependencies.semanticExcludePaths }),
      dependencies.embeddingProvider,
      { excludedPaths: dependencies.semanticExcludePaths }
    );
  }

  async loadContext(request: AiBridgeContextRequestDto): Promise<AiBridgeResponseDto<AiBridgeContextDataDto>> {
    try {
      const report = await this.dependencies.vaultVerifier.verify(request.vaultRoot);
      const notes = await this.dependencies.noteSource.listNotes(report.vaultRoot);
      const focusPath = request.focusPath?.trim() || undefined;
      const focusNote = focusPath
        ? notes.find((note) => note.relativePath === focusPath || noteMatchesTarget(note, focusPath))
        : undefined;
      const relationResult = focusNote
        ? this.dependencies.relations.getRelated(report.vaultRoot, notes, focusNote.relativePath, request.relatedLimit ?? 12)
        : null;
      const relevantPaths = mergeRelevantPaths(focusNote?.relativePath ?? focusPath, relationResult?.backlinks ?? [], relationResult?.related ?? []);
      const retrieval = focusNote
        ? await this.retrievalService.retrieve(notes, {
            vaultRoot: report.vaultRoot,
            query: [focusNote.title ?? '', ...focusNote.tags].filter(Boolean).join(' ').trim() || focusNote.relativePath,
            tags: focusNote.tags,
            focusPath: focusNote.relativePath,
            scopePaths: relevantPaths,
            maxChunks: 6,
            maxCharacters: 3600
          })
        : { chunks: [] };
      const issues = focusPath && !focusNote
        ? [{ code: 'NOTE_NOT_FOUND', message: `Focus note not found: ${focusPath}`, path: focusPath }]
        : [];
      const data: AiBridgeContextDataDto = {
        vaultRoot: report.vaultRoot,
        focusPath: focusNote?.relativePath ?? focusPath,
        focusNote: focusNote
          ? {
              ...toNoteSummary(focusNote),
              content: focusNote.content
            }
          : undefined,
        notes: notes.map(toNoteSummary),
        backlinks: relationResult?.backlinks ?? [],
        relatedNotes: relationResult?.related ?? [],
        supportingChunks: retrieval.chunks,
        retrievalMode: inferRetrievalMode(retrieval.chunks),
        relevantPaths,
        summary: {
          folderCount: report.folderCount,
          fileCount: report.fileCount,
          markdownFileCount: report.markdownFileCount,
          totalBytes: report.totalBytes,
          issueCount: report.issues.length,
          noteCount: notes.length,
          focusFound: Boolean(focusNote) || !focusPath
        }
      };

      return {
        provider: 'system',
        summary: focusNote
          ? `Loaded context for ${focusNote.relativePath}.`
          : `Loaded vault context with ${notes.length} note(s).`,
        actions: [],
        status: issues.length > 0 ? 'conflict' : 'success',
        issues,
        data
      };
    } catch (error) {
      return this.errorResponse('Failed to load context.', error);
    }
  }

  async search(request: AiBridgeSearchRequestDto): Promise<AiBridgeResponseDto<AiBridgeSearchDataDto>> {
    try {
      const report = await this.dependencies.vaultVerifier.verify(request.vaultRoot);
      const notes = await this.dependencies.noteSource.listNotes(report.vaultRoot);
      const scopedNotes = filterNotesByScope(notes, request.scopePath);
      const query = request.query?.trim() || undefined;
      const phrase = request.phrase?.trim() || undefined;
      const tags = this.searchService.normalizeTags(request.tags);
      const verifiedMarkdownPaths = new Set<string>();
      collectVerifiedMarkdownPaths(report.root, verifiedMarkdownPaths);
      const verifiedNotes = scopedNotes.filter((note) => verifiedMarkdownPaths.has(normalizeRelativePath(note.relativePath)));
      const matches = this.searchService.buildMatches(verifiedNotes, { query, phrase, tags });
      const retrieval = await this.retrievalService.retrieve(verifiedNotes, {
        vaultRoot: report.vaultRoot,
        query: [query, phrase].filter(Boolean).join(' ').trim() || undefined,
        tags,
        scopePaths: request.scopePath ? [request.scopePath] : undefined,
        maxChunks: 8,
        maxCharacters: 4200
      });
        const data: AiBridgeSearchDataDto = {
          vaultRoot: report.vaultRoot,
          query,
          phrase,
          tags,
          scopePath: request.scopePath?.trim() || undefined,
          matches,
          chunks: retrieval.chunks,
          retrievalMode: inferRetrievalMode(retrieval.chunks),
          counts: {
          notes: verifiedNotes.length,
          matches: matches.length,
          chunks: retrieval.chunks.length
        }
      };

      return {
        provider: 'system',
        summary: matches.length > 0 ? `Found ${matches.length} matching note(s).` : 'No matching notes found.',
        actions: [],
        status: matches.length > 0 ? 'success' : 'noop',
        issues: report.issues.map((issue) => ({ code: 'VAULT_ISSUE', message: issue })),
        data
      };
    } catch (error) {
      return this.errorResponse('Failed to search vault.', error, {
        vaultRoot: request.vaultRoot,
        query: request.query?.trim() || undefined,
        phrase: request.phrase?.trim() || undefined,
        tags: request.tags ?? [],
        scopePath: request.scopePath?.trim() || undefined,
        matches: [],
        chunks: [],
        retrievalMode: 'lexical-only',
        counts: { notes: 0, matches: 0, chunks: 0 }
      });
    }
  }

  async retrieve(request: AiBridgeRetrieveRequestDto): Promise<AiBridgeResponseDto<AiBridgeRetrieveDataDto>> {
    try {
      const report = await this.dependencies.vaultVerifier.verify(request.vaultRoot);
      const notes = await this.dependencies.noteSource.listNotes(report.vaultRoot);
      const scopedNotes = filterNotesByScope(notes, request.scopePath);
      const tags = this.searchService.normalizeTags(request.tags);
      const retrieval = await this.retrievalService.retrieve(scopedNotes, {
        vaultRoot: report.vaultRoot,
        query: request.query?.trim() || undefined,
        tags,
        scopePaths: request.scopePath ? [request.scopePath] : undefined,
        maxChunks: request.maxChunks,
        maxCharacters: request.maxCharacters
      });
      const status: AiBridgeStatus = retrieval.chunks.length > 0 ? 'success' : 'noop';

      return {
        provider: 'system',
        summary: retrieval.chunks.length > 0
          ? `Retrieved ${retrieval.chunks.length} context chunk(s).`
          : 'No relevant context chunks found.',
        actions: [],
        status,
        issues: report.issues.map((issue) => ({ code: 'VAULT_ISSUE', message: issue })),
        data: {
          vaultRoot: report.vaultRoot,
          query: request.query?.trim() || undefined,
          tags,
          scopePath: request.scopePath?.trim() || undefined,
          chunks: retrieval.chunks,
          retrievalMode: inferRetrievalMode(retrieval.chunks),
          counts: {
            notes: scopedNotes.length,
            chunks: retrieval.chunks.length
          }
        }
      };
    } catch (error) {
      return this.errorResponse('Failed to retrieve agent context.', error, {
        vaultRoot: request.vaultRoot,
        query: request.query?.trim() || undefined,
        tags: request.tags ?? [],
        scopePath: request.scopePath?.trim() || undefined,
        chunks: [],
        retrievalMode: 'lexical-only',
        counts: { notes: 0, chunks: 0 }
      });
    }
  }

  async loadAgentContext(request: AiBridgeAgentContextRequestDto): Promise<AiBridgeResponseDto<AiBridgeAgentContextDataDto>> {
    const maxChunks = 8;
    const maxCharacters = 4800;

    try {
      const report = await this.dependencies.vaultVerifier.verify(request.vaultRoot);
      const notes = await this.dependencies.noteSource.listNotes(report.vaultRoot);
      const scopedNotes = filterNotesByScope(notes, request.scopePath);
      const focusPath = request.focusPath?.trim() || undefined;
      const focusNote = focusPath
        ? scopedNotes.find((note) => note.relativePath === focusPath || noteMatchesTarget(note, focusPath))
        : undefined;
      const query = request.query?.trim() || focusNote?.title || undefined;
      const tags = this.searchService.normalizeTags(request.tags ?? focusNote?.tags ?? []);
      const related = focusNote
        ? this.dependencies.relations.getRelated(report.vaultRoot, scopedNotes, focusNote.relativePath, 6)
        : null;
      const relevantPaths = mergeRelevantPaths(
        focusNote?.relativePath ?? focusPath,
        related?.backlinks ?? [],
        related?.related ?? []
      );
      const retrieval = await this.retrievalService.retrieve(scopedNotes, {
        vaultRoot: report.vaultRoot,
        query,
        tags,
        focusPath: focusNote?.relativePath,
        scopePaths: relevantPaths.length > 0 ? relevantPaths : request.scopePath ? [request.scopePath] : undefined,
        maxChunks,
        maxCharacters
      });

      return {
        provider: 'system',
        summary: retrieval.chunks.length > 0
          ? `Prepared agent context with ${retrieval.chunks.length} chunk(s).`
          : 'No agent context could be prepared from the current vault scope.',
        actions: [],
        status: retrieval.chunks.length > 0 || focusNote ? 'success' : 'noop',
        issues: [],
        data: {
          vaultRoot: report.vaultRoot,
          query,
          summaryText: buildAgentContextSummary({
            query,
            focusTitle: focusNote?.title,
            chunkCount: retrieval.chunks.length,
            relatedTitles: (related?.related ?? []).map((item) => item.title)
          }),
          scopePath: request.scopePath?.trim() || undefined,
          focusPath: focusNote?.relativePath ?? focusPath,
          focusNote: focusNote
            ? {
                ...toNoteSummary(focusNote),
                content: focusNote.content
              }
            : undefined,
          supportingChunks: retrieval.chunks,
          retrievalMode: inferRetrievalMode(retrieval.chunks),
          relatedNotes: related?.related ?? [],
          relevantPaths,
          budget: {
            maxChunks,
            maxCharacters,
            deliveredChunks: retrieval.chunks.length
          }
        }
      };
    } catch (error) {
      return this.errorResponse('Failed to load agent context.', error, {
        vaultRoot: request.vaultRoot,
        query: request.query?.trim() || undefined,
        summaryText: '',
        scopePath: request.scopePath?.trim() || undefined,
        focusPath: request.focusPath?.trim() || undefined,
        supportingChunks: [],
        retrievalMode: 'lexical-only',
        relatedNotes: [],
        relevantPaths: [],
        budget: {
          maxChunks,
          maxCharacters,
          deliveredChunks: 0
        }
      });
    }
  }

  async plan(request: AiBridgePlanRequestDto): Promise<AiBridgeResponseDto<AiBridgePlanDataDto>> {
    return this.buildPlanResponse(request, true);
  }

  async preview(request: AiBridgePlanRequestDto): Promise<AiBridgeResponseDto<AiBridgePlanDataDto>> {
    return this.buildPlanResponse(request, true);
  }

  async apply(request: AiBridgeApplyRequestDto): Promise<AiBridgeResponseDto<AiBridgeApplyDataDto>> {
    const emptyData = (): AiBridgeApplyDataDto => ({
      vaultRoot: request.vaultRoot,
      previewId: request.previewId?.trim() || '',
      dryRun: false,
      scopePath: request.scopePath?.trim() || undefined,
      query: request.query?.trim() || undefined,
      executedActions: [],
      skippedActions: []
    });

    try {
      const planned = request.actions && request.actions.length > 0
        ? {
            provider: 'manual',
            actions: this.planService.validate({ provider: 'manual', summary: 'Manual apply request', actions: request.actions })
          }
        : await this.createPlannedActions(
            request.vaultRoot,
            request.scopePath?.trim() || undefined,
            request.query?.trim() || undefined
          );
      const provider = planned.provider;
      const plan = planned.actions;
      const serializedActions = serializeActions(plan);
      const previewId = buildPreviewId(request.vaultRoot, serializedActions);

      if (!request.previewId?.trim() && !request.force) {
        return {
          provider,
          summary: 'Apply requires a validated preview before writing to the vault.',
          actions: serializedActions,
          status: 'conflict',
          issues: [{ code: 'PREVIEW_ID_REQUIRED', message: 'previewId is required unless force is enabled.' }],
          data: { ...emptyData(), previewId }
        };
      }

      if (request.previewId?.trim() && request.previewId.trim() !== previewId) {
        return {
          provider,
          summary: 'Apply preview no longer matches the current plan.',
          actions: serializedActions,
          status: 'conflict',
          issues: [{ code: 'PREVIEW_ID_MISMATCH', message: 'previewId does not match the validated plan.' }],
          data: { ...emptyData(), previewId }
        };
      }

      if (serializedActions.length === 0) {
        return {
          provider,
          summary: 'Apply found no changes to execute.',
          actions: [],
          status: 'noop',
          issues: [],
          data: { ...emptyData(), previewId }
        };
      }

      const report = await this.dependencies.actionExecutor.execute(plan, request.vaultRoot);
      const executedActions = serializeActions(report.executed);
      const skippedActions = serializeActions(report.skipped);
      const issues = skippedActions.map((action) => ({
        code: action.kind === 'move-note' ? 'ACTION_CONFLICT' : 'ACTION_SKIPPED',
        message: action.kind === 'move-note'
          ? `Destination already exists for ${action.sourcePath}.`
          : `Skipped action ${action.id}.`
      }));
      const status: AiBridgeStatus = executedActions.length === 0
        ? skippedActions.length > 0 ? 'conflict' : 'noop'
        : skippedActions.length > 0 ? 'conflict' : 'success';

      return {
        provider,
        summary: summarizePlan(provider, executedActions.length, false),
        actions: serializedActions,
        status,
        issues,
          data: {
            vaultRoot: request.vaultRoot,
            previewId,
            dryRun: false,
            scopePath: request.scopePath?.trim() || undefined,
            query: request.query?.trim() || undefined,
            executedActions,
            skippedActions
          }
      };
    } catch (error) {
      return this.errorResponse('Failed to apply actions.', error, emptyData());
    }
  }

  private async buildPlanResponse(request: AiBridgePlanRequestDto, dryRun: boolean): Promise<AiBridgeResponseDto<AiBridgePlanDataDto>> {
    const emptyData: AiBridgePlanDataDto = {
      vaultRoot: request.vaultRoot,
      dryRun,
      previewId: '',
      scopePath: request.scopePath?.trim() || undefined,
      query: request.query?.trim() || undefined
    };

    try {
      const scopePath = request.scopePath?.trim() || undefined;
      const query = request.query?.trim() || undefined;
      const aiResponse = await this.createAiResponse(request.vaultRoot, scopePath, query);
      const plannedActions = this.planService.validate(aiResponse);
      const actions = serializeActions(plannedActions);
      const previewId = buildPreviewId(request.vaultRoot, actions);
      const status: AiBridgeStatus = actions.length > 0 ? 'success' : 'noop';

      return {
        provider: aiResponse.provider,
        summary: aiResponse.summary?.trim() || summarizePlan(aiResponse.provider, actions.length, dryRun),
        actions,
        status,
        issues: [],
        data: {
          vaultRoot: request.vaultRoot,
          dryRun,
          previewId,
          scopePath,
          query
        }
      };
    } catch (error) {
      return this.errorResponse('Failed to build plan.', error, emptyData);
    }
  }

  private async createAiResponse(vaultRoot: string, scopePath?: string, query?: string) {
    const notes = await this.dependencies.noteSource.listNotes(vaultRoot);
    const scopedNotes = filterNotesByScope(notes, scopePath);
    const queryValue = query?.trim() || undefined;
    const filteredNotes = queryValue
      ? (() => {
          const matches = this.searchService.buildMatches(scopedNotes, { query: queryValue });
          const matchedPaths = new Set(matches.map((match) => match.path));
          return scopedNotes.filter((note) => matchedPaths.has(note.relativePath));
        })()
      : scopedNotes;
    const context = this.contextService.build(vaultRoot, filteredNotes);
    return this.dependencies.aiProvider.generateOrganizationPlan(context);
  }

  private async createPlannedActions(vaultRoot: string, scopePath?: string, query?: string): Promise<{ readonly provider: string; readonly actions: readonly OrganizationAction[] }> {
    const aiResponse = await this.createAiResponse(vaultRoot, scopePath, query);
    return {
      provider: aiResponse.provider,
      actions: this.planService.validate(aiResponse)
    };
  }

  private errorResponse<TData>(summary: string, error: unknown, data?: TData): AiBridgeResponseDto<TData> {
    const issue = issueFromError(error);

    return {
      provider: 'system',
      summary,
      actions: [],
      status: 'error',
      issues: [issue],
      data: data ?? ({} as TData)
    };
  }
}
