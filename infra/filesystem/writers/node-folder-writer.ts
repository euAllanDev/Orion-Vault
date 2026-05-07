import fs from 'node:fs/promises';

export class NodeFolderWriter {
  async ensureFolder(folderPath: string): Promise<void> {
    await fs.mkdir(folderPath, { recursive: true });
  }
}
