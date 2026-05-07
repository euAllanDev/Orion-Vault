import type { VaultEntryDto } from '../dto/vault-entry.dto';

export interface VaultScannerPort {
  scan(vaultRoot: string): Promise<VaultEntryDto>;
}
