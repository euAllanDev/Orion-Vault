import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOrionGuideMarkdown, buildOrionStartMarkdown } from '../application/ai/skills/skill-catalog';

function withGeneratedHeader(content: string): string {
  return [
    '<!-- GENERATED FILE: run `pnpm docs:sync-ai` -->',
    '<!-- Source of truth: application/ai/skills/skill-registry.ts and skill-catalog.ts -->',
    '',
    content.trimEnd(),
    ''
  ].join('\n');
}

async function main(): Promise<void> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const startPath = path.join(projectRoot, 'ai-start-here.md');
  const guidePath = path.join(projectRoot, 'comandos.md');

  await fs.writeFile(startPath, withGeneratedHeader(buildOrionStartMarkdown()), 'utf8');
  await fs.writeFile(guidePath, withGeneratedHeader(buildOrionGuideMarkdown()), 'utf8');
}

void main();
