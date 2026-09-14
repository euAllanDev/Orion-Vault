export interface VaultFolderEntryDto {
  readonly kind: 'folder';
  readonly name: string;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly children: readonly VaultEntryDto[];
}

export interface VaultFileEntryDto {
  readonly kind: 'file';
  readonly name: string;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly sizeBytes: number;
  readonly extension: string;
  readonly title?: string;
  readonly preview: readonly string[];
  readonly modifiedAt: number;
  readonly createdAt: number;
}

export type VaultEntryDto = VaultFolderEntryDto | VaultFileEntryDto;
