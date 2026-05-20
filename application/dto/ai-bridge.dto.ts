import type { NoteLinkMatchDto, RelatedNoteDto } from './semantic-note-relations.dto';

export type AiBridgeStatus = 'success' | 'conflict' | 'noop' | 'error';

export interface AiBridgeIssueDto {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export type AiBridgeActionDto =
  | {
      readonly kind: 'move-note';
      readonly id: string;
      readonly reason?: string;
      readonly sourcePath: string;
      readonly destinationPath: string;
    }
  | {
      readonly kind: 'create-folder';
      readonly id: string;
      readonly reason?: string;
      readonly folderPath: string;
    };

export interface AiBridgeResponseDto<TData> {
  readonly provider: string;
  readonly summary: string;
  readonly actions: readonly AiBridgeActionDto[];
  readonly status: AiBridgeStatus;
  readonly issues: readonly AiBridgeIssueDto[];
  readonly data: TData;
}

export interface AiBridgeNoteSummaryDto {
  readonly path: string;
  readonly title?: string;
  readonly tags: readonly string[];
  readonly wordCount: number;
}

export interface AiBridgeFocusNoteDto extends AiBridgeNoteSummaryDto {
  readonly content: string;
}

export interface AiBridgeContextSummaryDto {
  readonly folderCount: number;
  readonly fileCount: number;
  readonly markdownFileCount: number;
  readonly totalBytes: number;
  readonly issueCount: number;
  readonly noteCount: number;
  readonly focusFound: boolean;
}

export interface AiBridgeContextRequestDto {
  readonly vaultRoot: string;
  readonly focusPath?: string;
  readonly relatedLimit?: number;
}

export interface AiBridgeContextDataDto {
  readonly vaultRoot: string;
  readonly focusPath?: string;
  readonly focusNote?: AiBridgeFocusNoteDto;
  readonly notes: readonly AiBridgeNoteSummaryDto[];
  readonly backlinks: readonly NoteLinkMatchDto[];
  readonly relatedNotes: readonly RelatedNoteDto[];
  readonly relevantPaths: readonly string[];
  readonly summary: AiBridgeContextSummaryDto;
}

export interface AiBridgeSearchRequestDto {
  readonly vaultRoot: string;
  readonly query?: string;
  readonly phrase?: string;
  readonly tags?: readonly string[];
}

export interface SearchMatchDto {
  readonly kind: 'note';
  readonly path: string;
  readonly title?: string;
  readonly tags: readonly string[];
  readonly score: number;
  readonly matchedFields: readonly string[];
  readonly snippet?: string;
}

export interface AiBridgeSearchDataDto {
  readonly vaultRoot: string;
  readonly query?: string;
  readonly phrase?: string;
  readonly tags: readonly string[];
  readonly matches: readonly SearchMatchDto[];
  readonly counts: {
    readonly notes: number;
    readonly matches: number;
  };
}

export interface AiBridgePlanRequestDto {
  readonly vaultRoot: string;
}

export interface AiBridgePlanDataDto {
  readonly vaultRoot: string;
  readonly dryRun: boolean;
  readonly previewId: string;
}

export interface AiBridgeApplyRequestDto {
  readonly vaultRoot: string;
  readonly previewId?: string;
  readonly actions?: readonly AiBridgeActionDto[];
  readonly force?: boolean;
}

export interface AiBridgeApplyDataDto {
  readonly vaultRoot: string;
  readonly previewId: string;
  readonly dryRun: false;
  readonly executedActions: readonly AiBridgeActionDto[];
  readonly skippedActions: readonly AiBridgeActionDto[];
}
