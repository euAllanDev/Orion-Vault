import type { VaultContextDto } from '../dto/vault-context.dto';
import type { NoteSnapshotDto } from '../dto/note-snapshot.dto';

export class OrganizationContextService {
  build(vaultRoot: string, notes: readonly NoteSnapshotDto[]): VaultContextDto {
    return {
      vaultRoot,
      notes: [...notes]
    };
  }
}
