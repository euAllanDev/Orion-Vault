import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { NodeNoteReader } from '../../../infra/filesystem/readers/node-note-reader';
import { VaultVerificationService } from '../../../vault/services/vault-verification.service';
import path from 'node:path';
import type { NoteSnapshotDto } from '../../../application/dto/note-snapshot.dto';

export interface ContextCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractWikiTargets(content: string): string[] {
  const targets = new Set<string>();

  for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = String(match[1] ?? '').split('|')[0]?.trim();
    if (target) targets.add(target);
  }

  return [...targets];
}

function noteMatchesTarget(note: NoteSnapshotDto, target: string): boolean {
  const normalizedTarget = normalizeText(target);
  const candidates = [
    note.relativePath,
    path.basename(note.relativePath, path.extname(note.relativePath)),
    note.title ?? ''
  ];

  return candidates.some((candidate) => normalizeText(candidate) === normalizedTarget);
}

export async function executeContextCommand(options: ContextCommandOptions): Promise<void> {
  const config = loadAppConfig();
  const service = new VaultVerificationService(new NodeVaultScanner());
  const noteReader = new NodeNoteReader();
  const report = await service.verify(options.vaultRoot ?? config.vaultRoot);
  const notes = await noteReader.listNotes(report.vaultRoot);

  console.log(`Vault: ${report.vaultRoot}`);
  console.log(`Folders: ${report.folderCount}`);
  console.log(`Files: ${report.fileCount}`);
  console.log(`Markdown files: ${report.markdownFileCount}`);
  console.log('Top level:');

  if (report.root.kind === 'folder') {
    for (const child of report.root.children) {
      console.log(`- ${child.relativePath || child.name}`);
    }
  }

  if (options.path) {
    const focus = notes.find((note) => note.relativePath === options.path || noteMatchesTarget(note, options.path!));

    console.log('');
    console.log(`Focus: ${options.path}`);

    if (!focus) {
      console.log('Status: note not found');
      return;
    }

    const backlinks = notes.filter((note) => {
      if (note.relativePath === focus.relativePath) return false;
      return extractWikiTargets(note.content).some((target) => noteMatchesTarget(focus, target));
    });

    console.log(`Note: ${focus.relativePath}`);
    if (focus.title) console.log(`Title: ${focus.title}`);
    if (focus.tags.length > 0) console.log(`Tags: ${focus.tags.join(', ')}`);
    console.log(`Words: ${focus.content.split(/\s+/).filter(Boolean).length}`);
    console.log(`Backlinks: ${backlinks.length}`);

    if (backlinks.length > 0) {
      console.log('Backlink notes:');
      for (const backlink of backlinks) {
        console.log(`- ${backlink.relativePath}${backlink.title ? ` - ${backlink.title}` : ''}`);
      }
    }
  }
}
