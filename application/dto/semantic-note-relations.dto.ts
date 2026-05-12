export type RelationIntensity = 'strong' | 'medium' | 'weak' | 'hidden';

export interface RelationSignalsDto {
  readonly tfidf: number;
  readonly tags: number;
  readonly titleHeadings: number;
  readonly links: number;
  readonly folder: number;
}

export interface NoteLinkMatchDto {
  readonly raw: string;
  readonly label: string;
  readonly kind: 'wiki' | 'markdown';
  readonly targetPath?: string;
  readonly candidates: readonly string[];
  readonly ambiguous: boolean;
}

export interface RelatedNoteDto {
  readonly path: string;
  readonly title: string;
  readonly score: number;
  readonly intensity: RelationIntensity;
  readonly signals: RelationSignalsDto;
  readonly reasons: readonly string[];
  readonly kind: 'manual' | 'inferred';
}

export interface RelatedNoteResponseDto {
  readonly vaultRoot: string;
  readonly sourcePath: string;
  readonly title?: string;
  readonly manualLinks: readonly NoteLinkMatchDto[];
  readonly backlinks: readonly NoteLinkMatchDto[];
  readonly related: readonly RelatedNoteDto[];
}

export interface LinkSuggestionDto {
  readonly targetPath: string;
  readonly title: string;
  readonly score: number;
  readonly intensity: RelationIntensity;
  readonly reasons: readonly string[];
  readonly matchedText?: string;
  readonly applicationMode: 'inline' | 'section';
  readonly ambiguous: boolean;
  readonly candidates?: readonly string[];
}

export interface LinkPreviewDiffDto {
  readonly before: readonly string[];
  readonly after: readonly string[];
}

export interface LinkPreviewDto {
  readonly vaultRoot: string;
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly title: string;
  readonly applicationMode: 'inline' | 'section';
  readonly reason: string;
  readonly diff: LinkPreviewDiffDto;
  readonly currentContent: string;
  readonly proposedContent: string;
  readonly linkText?: string;
}

export interface GraphNodeDto {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly kind: 'note' | 'folder';
  readonly score: number;
  readonly intensity: RelationIntensity;
  readonly summary?: string;
  readonly folderPath?: string;
}

export interface GraphEdgeDto {
  readonly from: string;
  readonly to: string;
  readonly kind: 'manual' | 'inferred' | 'folder';
  readonly score: number;
  readonly intensity: RelationIntensity;
}

export interface GlobalGraphDto {
  readonly vaultRoot: string;
  readonly focusPath?: string;
  readonly nodes: readonly GraphNodeDto[];
  readonly edges: readonly GraphEdgeDto[];
}
