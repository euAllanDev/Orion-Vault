export interface VaultOperationResultDto {
  readonly operation: 'create-folder' | 'create-file' | 'edit-file' | 'rename-path' | 'move-path';
  readonly vaultRoot: string;
  readonly sourcePath?: string;
  readonly targetPath?: string;
  readonly message: string;
}
