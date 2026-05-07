import type { NoteSnapshotDto } from './note-snapshot.dto';

export interface VaultContextDto {
  readonly vaultRoot: string;
  readonly notes: readonly NoteSnapshotDto[];
}
