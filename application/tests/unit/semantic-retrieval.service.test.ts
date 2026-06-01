import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NoteSnapshotDto } from '../../dto/note-snapshot.dto';
import type { EmbeddingProviderPort, LocalChunkEmbeddingInput, LocalEmbeddingVector, LocalQueryEmbeddingInput } from '../../ports/embedding-provider.port';
import { ChunkedNoteIndexService } from '../../services/chunked-note-index.service';
import { SemanticRetrievalService } from '../../services/semantic-retrieval.service';
import { TokenHashEmbeddingProvider } from '../../../infra/ai/local-models/token-hash-embedding.provider';

async function createVaultRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'orion-semantic-retrieval-'));
}

function createNotes(vaultRoot: string): NoteSnapshotDto[] {
  return [
    {
      id: 'clean-architecture',
      absolutePath: path.join(vaultRoot, 'Architecture', 'Clean Architecture.md'),
      relativePath: 'Architecture/Clean Architecture.md',
      title: 'Clean Architecture',
      tags: ['architecture', 'clean-architecture'],
      content: `# Clean Architecture

## Use Cases

Application orchestrates use cases and depends only on domain contracts.

## Boundaries

Interfaces are thin adapters and infrastructure is replaceable.
`
    },
    {
      id: 'sdd',
      absolutePath: path.join(vaultRoot, 'Architecture', 'SDD.md'),
      relativePath: 'Architecture/SDD.md',
      title: 'SDD',
      tags: ['architecture', 'sdd'],
      content: `# SDD

## Rules

Specs are the source of truth for behavior and change control.

## Flow

Document before implementing and keep contracts explicit.
`
    },
    {
      id: 'draft',
      absolutePath: path.join(vaultRoot, 'drafts', 'clean scratch.md'),
      relativePath: 'drafts/clean scratch.md',
      title: 'clean scratch',
      tags: ['scratch'],
      content: '# scratch\n\nclean architecture maybe maybe maybe\n'
    }
  ];
}

class CountingQueryEmbeddingProvider implements EmbeddingProviderPort {
  readonly providerId = 'counting-query-provider';
  queryCalls = 0;

  async embedChunk(_input: LocalChunkEmbeddingInput): Promise<LocalEmbeddingVector | null> {
    return null;
  }

  async embedQuery(input: LocalQueryEmbeddingInput): Promise<LocalEmbeddingVector | null> {
    this.queryCalls += 1;
    return {
      model: this.providerId,
      version: '1',
      dimensions: 3,
      vector: [1, 2, 3],
      fingerprint: input.text.trim().toLowerCase()
    };
  }
}

describe('SemanticRetrievalService', () => {
  it('retrieves focused chunks for architecture questions and deprioritizes draft noise', async () => {
    const vaultRoot = await createVaultRoot();
    const service = new SemanticRetrievalService();

    try {
      const notes = createNotes(vaultRoot);
      const result = await service.retrieve(notes, {
        vaultRoot,
        query: 'clean architecture use cases',
        maxChunks: 4,
        maxCharacters: 2000
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks[0]?.path).toBe('Architecture/Clean Architecture.md');
      expect(result.chunks[0]?.text).toContain('Application orchestrates use cases');
      expect(result.chunks.some((chunk) => chunk.path === 'drafts/clean scratch.md')).toBe(false);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('supports scoped retrieval for agent-style domain focus', async () => {
    const vaultRoot = await createVaultRoot();
    const service = new SemanticRetrievalService();

    try {
      const notes = createNotes(vaultRoot);
      const result = await service.retrieve(notes, {
        vaultRoot,
        query: 'source of truth behavior',
        scopePaths: ['Architecture/SDD.md'],
        maxChunks: 3
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks.every((chunk) => chunk.path === 'Architecture/SDD.md')).toBe(true);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('persists optional embeddings and exposes hybrid ranking metadata when enabled', async () => {
    const vaultRoot = await createVaultRoot();
    const embeddingProvider = new TokenHashEmbeddingProvider();
    const service = new SemanticRetrievalService(new ChunkedNoteIndexService(embeddingProvider), embeddingProvider);

    try {
      const notes = createNotes(vaultRoot);
      const result = await service.retrieve(notes, {
        vaultRoot,
        query: 'clean architecture boundaries',
        maxChunks: 4,
        maxCharacters: 2200
      });
      const indexPath = path.join(vaultRoot, '.orion', 'index', 'semantic-chunks.json');
      const persisted = JSON.parse(await fs.readFile(indexPath, 'utf8')) as {
        notes: Record<string, { chunks: Array<{ embeddingModel?: string; embedding?: number[] }> }>;
      };

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks.some((chunk) => chunk.rankingMode === 'hybrid')).toBe(true);
      expect(result.chunks.some((chunk) => (chunk.vectorScore ?? 0) > 0)).toBe(true);
      expect(persisted.notes['Architecture/Clean Architecture.md']?.chunks.some((chunk) => chunk.embeddingModel === 'token-hash-local')).toBe(true);
      expect(persisted.notes['Architecture/Clean Architecture.md']?.chunks.some((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0)).toBe(true);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('avoids returning near-duplicate chunks in the same context package', async () => {
    const vaultRoot = await createVaultRoot();
    const service = new SemanticRetrievalService();

    try {
      const notes: NoteSnapshotDto[] = [
        {
          id: 'alpha',
          absolutePath: path.join(vaultRoot, 'Architecture', 'Alpha.md'),
          relativePath: 'Architecture/Alpha.md',
          title: 'Alpha',
          tags: ['architecture'],
          content: `# Alpha

## Use Cases

Application orchestrates use cases and depends only on domain contracts.
`
        },
        {
          id: 'beta',
          absolutePath: path.join(vaultRoot, 'Architecture', 'Beta.md'),
          relativePath: 'Architecture/Beta.md',
          title: 'Beta',
          tags: ['architecture'],
          content: `# Beta

## Use Cases

Application orchestrates use cases and depends only on domain contracts.
`
        },
        {
          id: 'gamma',
          absolutePath: path.join(vaultRoot, 'Architecture', 'Gamma.md'),
          relativePath: 'Architecture/Gamma.md',
          title: 'Gamma',
          tags: ['architecture'],
          content: `# Gamma

## Boundaries

Interfaces remain thin and infrastructure stays replaceable around the domain.
`
        }
      ];

      const result = await service.retrieve(notes, {
        vaultRoot,
        query: 'architecture use cases boundaries domain contracts',
        maxChunks: 4,
        maxCharacters: 2200
      });

      expect(result.chunks.length).toBe(2);
      expect(result.chunks.filter((chunk) => ['Architecture/Alpha.md', 'Architecture/Beta.md'].includes(chunk.path))).toHaveLength(1);
      expect(result.chunks.some((chunk) => chunk.path === 'Architecture/Gamma.md')).toBe(true);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('reranks top candidates to prefer exact phrase matches in the chunk body', async () => {
    const vaultRoot = await createVaultRoot();
    const service = new SemanticRetrievalService();

    try {
      const notes: NoteSnapshotDto[] = [
        {
          id: 'alpha',
          absolutePath: path.join(vaultRoot, 'Alpha.md'),
          relativePath: 'Alpha.md',
          title: 'Alpha',
          tags: ['architecture'],
          content: '# Alpha\n\napplication rules domain flow'
        },
        {
          id: 'beta',
          absolutePath: path.join(vaultRoot, 'Beta.md'),
          relativePath: 'Beta.md',
          title: 'Beta',
          tags: ['architecture'],
          content: '# Beta\n\napplication flow domain rules'
        }
      ];

      const result = await service.retrieve(notes, {
        vaultRoot,
        query: 'application flow domain rules',
        maxChunks: 4,
        maxCharacters: 2200
      });

      expect(result.chunks[0]?.path).toBe('Beta.md');
      expect(result.chunks[0]?.text).toContain('application flow domain rules');
      expect(result.chunks[0]?.rerankScore).toBeGreaterThanOrEqual(result.chunks[0]?.score ?? 0);
      expect(result.chunks[0]?.rerankReasons).toContain('exact query phrase in body');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('uses concept alias reranking to prefer product discovery over unrelated learning notes', async () => {
    const vaultRoot = await createVaultRoot();
    const service = new SemanticRetrievalService();

    try {
      const notes: NoteSnapshotDto[] = [
        {
          id: 'product-discovery',
          absolutePath: path.join(vaultRoot, 'product', 'discovery-loop.md'),
          relativePath: 'product/discovery-loop.md',
          title: 'Discovery Loop',
          tags: ['product'],
          content: '# Discovery Loop\n\nTeams learn through interviews, evidence gathering, hypothesis checks, and small experiments before expanding a solution.\n\nThe goal is to reduce uncertainty, refine the problem framing, and turn observations into better product decisions.'
        },
        {
          id: 'learning-practice',
          absolutePath: path.join(vaultRoot, 'learning', 'practice-routine.md'),
          relativePath: 'learning/practice-routine.md',
          title: 'Practice Routine',
          tags: ['learning'],
          content: '# Practice Routine\n\nThe routine alternates active recall, spaced review, and deliberate practice so understanding remains available over time.\n\nIt aims to strengthen recall strength and long-term retention by revisiting ideas through retrieval instead of passive rereading.'
        }
      ];

      const result = await service.retrieve(notes, {
        vaultRoot,
        query: 'customer learning assumption testing',
        maxChunks: 4,
        maxCharacters: 2200
      });

      expect(result.chunks[0]?.path).toBe('product/discovery-loop.md');
      expect(result.chunks[0]?.rerankReasons).toContain('concept alias: product-discovery');
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('persists query embeddings across service instances to avoid recomputation between sessions', async () => {
    const vaultRoot = await createVaultRoot();
    const provider = new CountingQueryEmbeddingProvider();
    const firstService = new SemanticRetrievalService(new ChunkedNoteIndexService(), provider);
    const secondService = new SemanticRetrievalService(new ChunkedNoteIndexService(), provider);

    try {
      const notes = createNotes(vaultRoot);

      await firstService.retrieve(notes, {
        vaultRoot,
        query: 'clean architecture boundaries',
        maxChunks: 4,
        maxCharacters: 2200
      });

      await secondService.retrieve(notes, {
        vaultRoot,
        query: 'clean architecture boundaries',
        maxChunks: 4,
        maxCharacters: 2200
      });

      expect(provider.queryCalls).toBe(1);

      const persisted = JSON.parse(await fs.readFile(path.join(vaultRoot, '.orion', 'index', 'semantic-query-embeddings.json'), 'utf8')) as {
        providers: Record<string, Record<string, { vector: number[] }>>;
      };
      expect(persisted.providers['counting-query-provider']).toBeDefined();
      expect(Object.values(persisted.providers['counting-query-provider'])[0]?.vector).toEqual([1, 2, 3]);
    } finally {
      await fs.rm(vaultRoot, { recursive: true, force: true });
    }
  });

});
