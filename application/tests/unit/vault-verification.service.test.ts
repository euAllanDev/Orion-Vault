import { describe, expect, it } from 'vitest';
import { VaultVerificationService } from '../../../vault/services/vault-verification.service';

const NOW = Date.now();

describe('VaultVerificationService', () => {
  it('summarizes a scanned vault tree', async () => {
    const service = new VaultVerificationService({
      async scan() {
        return {
          kind: 'folder',
          name: 'vault',
          absolutePath: '/vault',
          relativePath: '',
          children: [
            {
              kind: 'folder',
              name: 'projects',
              absolutePath: '/vault/projects',
              relativePath: 'projects',
              children: [
                {
                  kind: 'file',
                  name: 'alpha.md',
                  absolutePath: '/vault/projects/alpha.md',
                  relativePath: 'projects/alpha.md',
                  sizeBytes: 12,
                  extension: 'md',
                  title: 'Alpha',
                  preview: ['# Alpha'],
                  modifiedAt: NOW,
                  createdAt: NOW
                }
              ]
            },
            {
              kind: 'file',
              name: 'root.txt',
              absolutePath: '/vault/root.txt',
              relativePath: 'root.txt',
              sizeBytes: 5,
              extension: 'txt',
              preview: [],
              modifiedAt: NOW,
              createdAt: NOW
            }
          ]
        };
      }
    });

    const report = await service.verify('/vault');

    expect(report.folderCount).toBe(2);
    expect(report.fileCount).toBe(2);
    expect(report.markdownFileCount).toBe(1);
    expect(report.totalBytes).toBe(17);
    expect(report.issues).toEqual([]);
  });
});
