import fs from 'node:fs/promises';
import path from 'node:path';
import { NodeFolderWriter } from '../writers/node-folder-writer';

export class NodeFileMover {
  constructor(private readonly folderWriter = new NodeFolderWriter()) {}

  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    await this.folderWriter.ensureFolder(path.dirname(destinationPath));
    await fs.rename(sourcePath, destinationPath);
  }
}
