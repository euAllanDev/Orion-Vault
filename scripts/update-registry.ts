import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function getProjectRoot(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDirectory, '..'),
    path.resolve(moduleDirectory, '..', '..')
  ];

  return candidates.find((candidate) => existsSync(path.join(candidate, 'openspec', 'registry.md')))
    ?? candidates[0];
}

function isExecutedDirectly(): boolean {
  const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return entryPath !== '' && entryPath === fileURLToPath(import.meta.url);
}

export async function syncRegistry(): Promise<boolean> {
  const registryPath = path.join(getProjectRoot(), 'openspec', 'registry.md');
  const content = await fs.readFile(registryPath, 'utf8');

  if (!content.includes('`project-foundation`')) {
    const updated = `${content.trimEnd()}\n- \`project-foundation\` - draft\n`;
    await fs.writeFile(registryPath, updated, 'utf8');
    return true;
  }

  return false;
}

async function main(): Promise<void> {
  await syncRegistry();
}

if (isExecutedDirectly()) {
  void main();
}
