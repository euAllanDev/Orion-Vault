import type { VaultEntryDto } from './vault-entry.dto';

export interface VaultVerificationReportDto {
  readonly vaultRoot: string;
  readonly root: VaultEntryDto;
  readonly folderCount: number;
  readonly fileCount: number;
  readonly markdownFileCount: number;
  readonly totalBytes: number;
  readonly issues: readonly string[];
}
