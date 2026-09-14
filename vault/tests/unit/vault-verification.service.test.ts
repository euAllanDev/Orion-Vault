import { describe, expect, it } from 'vitest';
import { VaultVerificationService } from '../../../vault/services/vault-verification.service';

const NOW = Date.now();

describe('VaultVerificationService', () => {
  it('reports empty files and missing markdown metadata', async () => {
    const service = new VaultVerificationService({
      async scan() {
        return {
          kind: 'folder',
          name: 'vault',
          absolutePath: '/vault',
          relativePath: '',
          children: [
            {
              kind: 'file',
              name: 'empty.md',
              absolutePath: '/vault/empty.md',
              relativePath: 'empty.md',
              sizeBytes: 0,
              extension: 'md',
              title: undefined,
              preview: [''],
              modifiedAt: NOW,
              createdAt: NOW
            }
          ]
        };
      }
    });

    const report = await service.verify('/vault');

    expect(report.issues).toEqual(
      expect.arrayContaining([
        'EMPTY_FILE:empty.md',
        'MISSING_METADATA:title:empty.md'
      ])
    );
  });

  it('reports conflicting paths and mismatches', async () => {
    const service = new VaultVerificationService({
      async scan() {
        return {
          kind: 'folder',
          name: 'vault',
          absolutePath: '/vault',
          relativePath: '',
          children: [
            {
              kind: 'file',
              name: 'a.md',
              absolutePath: '/vault/a.md',
              relativePath: 'notes/a.md',
              sizeBytes: 12,
              extension: 'md',
              title: 'A',
              preview: ['# A'],
              modifiedAt: NOW,
              createdAt: NOW
            },
            {
              kind: 'file',
              name: 'b.md',
              absolutePath: '/vault/b.md',
              relativePath: 'notes/a.md',
              sizeBytes: 12,
              extension: 'md',
              title: 'B',
              preview: ['# B'],
              modifiedAt: NOW,
              createdAt: NOW
            }
          ]
        };
      }
    });

    const report = await service.verify('/vault');

    expect(report.issues).toEqual(
      expect.arrayContaining([
        'PATH_MISMATCH:/vault/a.md',
        'PATH_CONFLICT:notes/a.md',
        'PATH_MISMATCH:/vault/b.md'
      ])
    );
  });

  it('reports paths that escape the vault', async () => {
    const service = new VaultVerificationService({
      async scan() {
        return {
          kind: 'folder',
          name: 'vault',
          absolutePath: '/vault',
          relativePath: '',
          children: [
            {
              kind: 'file',
              name: 'escape.md',
              absolutePath: '/other/escape.md',
              relativePath: '../other/escape.md',
              sizeBytes: 5,
              extension: 'md',
              title: 'Escape',
              preview: ['# Escape'],
              modifiedAt: NOW,
              createdAt: NOW
            }
          ]
        };
      }
    });

    const report = await service.verify('/vault');

    expect(report.issues).toContain('ESCAPE_PATH:/other/escape.md');
  });
});
