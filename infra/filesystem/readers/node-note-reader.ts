import fs from 'node:fs/promises';
import path from 'node:path';
import type { NoteSourcePort } from '../../../application/ports/note-source.port';

function shouldIgnoreVaultEntry(name: string): boolean {
  return ['.orion', '.opencode', 'node_modules'].includes(name.trim().toLowerCase());
}

async function walkMarkdownFiles(rootPath: string, currentPath = rootPath): Promise<string[]> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (shouldIgnoreVaultEntry(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(rootPath, absolutePath)));
      continue;
    }

    if (entry.isFile() && absolutePath.toLowerCase().endsWith('.md')) {
      files.push(absolutePath);
    }
  }

  return files;
}

function extractTitle(content: string): string | undefined {
  const heading = content.split(/\r?\n/).find((line) => line.startsWith('# '));
  return heading ? heading.replace(/^#\s+/, '').trim() || undefined : undefined;
}

function normalizeTag(value: string): string | undefined {
  const tag = value.trim().replace(/^['"`]|['"`]$/g, '').replace(/^#/, '').trim();
  return tag || undefined;
}

function extractFrontmatterTags(content: string): string[] {
  const lines = content.split(/\r?\n/);

  if (lines[0] !== '---') {
    return [];
  }

  const tags: string[] = [];
  let inTagsBlock = false;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (line === '---') {
      break;
    }

    const inlineMatch = line.match(/^tags:\s*\[(.*)\]\s*$/i);
    if (inlineMatch) {
      for (const rawTag of inlineMatch[1].split(',')) {
        const tag = normalizeTag(rawTag);
        if (tag) {
          tags.push(tag);
        }
      }
      continue;
    }

    if (/^tags:\s*$/i.test(line)) {
      inTagsBlock = true;
      continue;
    }

    if (inTagsBlock && /^-\s+/.test(line)) {
      const tag = normalizeTag(line.replace(/^-\s+/, ''));
      if (tag) {
        tags.push(tag);
      }
      continue;
    }

    if (inTagsBlock && line.length > 0 && !/^\w+\s*:/i.test(line)) {
      const tag = normalizeTag(line);
      if (tag) {
        tags.push(tag);
      }
    }

    if (inTagsBlock && /^\w+\s*:/i.test(line) && !/^tags:\s*$/i.test(line)) {
      inTagsBlock = false;
    }
  }

  return tags;
}

function extractInlineTags(content: string): string[] {
  const tags = new Set<string>();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith('# ')) {
      continue;
    }

    const matches = line.matchAll(/(^|\s)#([A-Za-z0-9][A-Za-z0-9_-]*)/g);
    for (const match of matches) {
      const tag = normalizeTag(match[2]);
      if (tag) {
        tags.add(tag);
      }
    }
  }

  return [...tags];
}

function extractTags(content: string): readonly string[] {
  return [...new Set([...extractFrontmatterTags(content), ...extractInlineTags(content)])];
}

export class NodeNoteReader implements NoteSourcePort {
  async listNotes(vaultRoot: string) {
    const absolutePaths = await walkMarkdownFiles(vaultRoot);

    return Promise.all(
      absolutePaths.map(async (absolutePath) => {
        const content = await fs.readFile(absolutePath, 'utf8');
        const stat = await fs.stat(absolutePath);
        const relativePath = path.relative(vaultRoot, absolutePath).replace(/\\/g, '/');
        
        return {
          id: relativePath,
          absolutePath,
          relativePath,
          content,
          title: extractTitle(content),
          tags: extractTags(content),
          mtime: stat.mtimeMs
        };
      })
    );
  }
}
