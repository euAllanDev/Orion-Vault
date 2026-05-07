import type { VaultEntryDto } from '../../../vault/dto/vault-entry.dto';
import type { VaultVerificationReportDto } from '../../../vault/dto/vault-verification-report.dto';

function printEntry(entry: VaultEntryDto, depth = 0): void {
  const indent = '  '.repeat(depth);

  if (entry.kind === 'folder') {
    const label = entry.relativePath ? `${entry.name}/` : `${entry.absolutePath}/`;
    console.log(`${indent}${label}`);
    for (const child of entry.children) {
      printEntry(child, depth + 1);
    }
    return;
  }

  const titleSuffix = entry.title ? ` - ${entry.title}` : '';
  console.log(`${indent}${entry.name}${titleSuffix}`);

  for (const line of entry.preview) {
    if (line) {
      console.log(`${indent}  ${line}`);
      continue;
    }

    console.log('');
  }
}

export function presentVaultInspection(report: VaultVerificationReportDto): void {
  console.log(`Vault: ${report.root.absolutePath}`);
  console.log(`Folders: ${report.folderCount}`);
  console.log(`Files: ${report.fileCount}`);
  console.log(`Markdown files: ${report.markdownFileCount}`);
  console.log(`Total bytes: ${report.totalBytes}`);

  if (report.issues.length > 0) {
    console.log('Issues:');
    for (const issue of report.issues) {
      console.log(`- ${issue}`);
    }
  }

  if (report.root.kind === 'folder') {
    for (const child of report.root.children) {
      printEntry(child, 0);
    }
  }
}
