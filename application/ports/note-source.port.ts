import type { NoteSnapshotDto } from '../dto/note-snapshot.dto';

export interface NoteSourcePort {
  listNotes(vaultRoot: string): Promise<readonly NoteSnapshotDto[]>;
}
