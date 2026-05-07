import fs from 'node:fs/promises';
import path from 'node:path';

export async function syncRegistry(): Promise<boolean> {
  const registryPath = path.resolve('openspec/registry.md');
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

void main();
