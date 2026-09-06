export interface NoteSnapshotDto {
  readonly id: string;
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly content: string;
  readonly title?: string;
  readonly tags: readonly string[];
  readonly mtime?: number;
}
