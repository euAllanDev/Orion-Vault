import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NoteSnapshotDto } from '../../dto/note-snapshot.dto';
import type { EmbeddingProviderPort, LocalChunkEmbeddingInput, LocalEmbeddingVector, LocalQueryEmbeddingInput } from '../../ports/embedding-provider.port';
import { ChunkedNoteIndexService } from '../../services/chunked-note-index.service';

async function createVaultRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'orion-chunk-index-'));
}

class CountingEmbeddingProvider implements EmbeddingProviderPort {
  readonly providerId = 'counting-local';
  calls: string[] = [];

  async embedChunk(input: LocalChunkEmbeddingInput): Promise<LocalEmbeddingVector | null> {
    this.calls.push(input.heading ?? input.chunkId);
    return {
      model: this.providerId,
      version: '1',
      dimensions: 2,
      vector: [1, 0],
      fingerprint: input.fingerprint
    };
  }

  async embedQuery(_input: LocalQueryEmbeddingInput): Promise<LocalEmbeddingVector | null> {
    return null;
  }
}

function createNote(vaultRoot: string, sectionOneText: string): NoteSnapshotDto {
  const content = `# Architecture\n\n## Section One\n\n${sectionOneText}\n\n## Section Two\n\nStable chunk content remains the same.`;
  return {
    id: 'architecture',
    absolutePath: path.join(vaultRoot, 'Architecture.md'),
    relativePath: 'Architecture.md',
    title: 'Architecture',
    tags: ['architecture'],
    content
  };
}

describe('ChunkedNoteIndexService', () => {
  it('reuses embeddings for unchanged chunks when a note changes', async () => {
    const vaultRoot = await createVaultRoot();
    const provider = new CountingEmbeddingProvider();
    const service = new ChunkedNoteIndexService(provider);

    try {
      await service.build(vaultRoot, [createNote(vaultRoot, 'Original chunk content changes later.')]);
      expect(provider.calls).toHaveLength(3);

      provider.calls = [];
      const updatedIndex = await service.build(vaultRoot, [createNote(vaultRoot, 'Updated chunk content only in first section.')]);

      expect(provider.calls).toHaveLength(1);
      expect(provider.calls[0]).toBe('Section One');

      const stableChunk = updatedIndex.chunks.find((chunk) => chunk.heading === 'Section Two');
      expect(stableChunk?.embeddingModel).toBe(provider.providerId);
      expect(stableChunk?.embedding?.length).toBe(2);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('excludes configured note paths from the semantic index', async () => {
    const vaultRoot = await createVaultRoot();
    const provider = new CountingEmbeddingProvider();
    const service = new ChunkedNoteIndexService(provider, { excludedPaths: ['drafts'] });

    try {
      const included = createNote(vaultRoot, 'Important architecture content.');
      const excluded: NoteSnapshotDto = {
        id: 'draft',
        absolutePath: path.join(vaultRoot, 'drafts', 'scratch.md'),
        relativePath: 'drafts/scratch.md',
        title: 'scratch',
        tags: ['scratch'],
        content: '# scratch\n\nNoise that should stay out of the semantic index.'
      };

      const index = await service.build(vaultRoot, [included, excluded]);

      expect(index.chunks.every((chunk) => chunk.notePath !== 'drafts/scratch.md')).toBe(true);
      expect(index.noteFingerprints.has('drafts/scratch.md')).toBe(false);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('splits oversized paragraphs into deterministic sentence windows', async () => {
    const vaultRoot = await createVaultRoot();
    const service = new ChunkedNoteIndexService();
    const longSentences = Array.from({ length: 24 }, (_, index) => `Sentence ${index + 1} explains architectural boundaries and domain orchestration with explicit application flow details.`).join(' ');
    const note: NoteSnapshotDto = {
      id: 'long-paragraph',
      absolutePath: path.join(vaultRoot, 'Long.md'),
      relativePath: 'Long.md',
      title: 'Long',
      tags: ['architecture'],
      content: `# Long\n\n## Deep Dive\n\n${longSentences}`
    };

    try {
      const index = await service.build(vaultRoot, [note]);
      const deepDiveChunks = index.chunks.filter((chunk) => chunk.heading === 'Deep Dive');

      expect(deepDiveChunks.length).toBeGreaterThan(1);
      expect(deepDiveChunks.every((chunk) => chunk.tokenCount <= 180)).toBe(true);

      const rebuiltIndex = await service.build(vaultRoot, [note]);
      const rebuiltChunkIds = rebuiltIndex.chunks.filter((chunk) => chunk.heading === 'Deep Dive').map((chunk) => chunk.chunkId);
      expect(rebuiltChunkIds).toEqual(deepDiveChunks.map((chunk) => chunk.chunkId));
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });
});
