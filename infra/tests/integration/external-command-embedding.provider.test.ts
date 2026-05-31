import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ExternalCommandEmbeddingProvider } from '../../../infra/ai/local-models/external-command-embedding.provider';

function createCommand(): string {
  const scriptPath = fileURLToPath(new URL('../../../scripts/local-embedder.js', import.meta.url));
  return `"${process.execPath}" "${path.resolve(scriptPath)}"`;
}

function createPersistentCommand(): string {
  return `${createCommand()} --stdio-server`;
}

function createExpandedPersistentCommand(): string {
  const scriptPath = fileURLToPath(new URL('../../../scripts/local-embedder-expanded.js', import.meta.url));
  return `"${process.execPath}" "${path.resolve(scriptPath)}" --stdio-server`;
}

describe('ExternalCommandEmbeddingProvider', () => {
  it('returns a vector for chunk input through the local embedder command', async () => {
    const provider = new ExternalCommandEmbeddingProvider(createCommand());
    const result = await provider.embedChunk({
      chunkId: 'chunk-1',
      notePath: 'Architecture/Clean Architecture.md',
      text: 'Application boundaries keep adapters replaceable.',
      title: 'Clean Architecture',
      heading: 'Boundaries',
      tags: ['architecture'],
      fingerprint: 'chunk-fingerprint'
    });

    expect(result?.model).toBe('local-embedder-token-hash-v1');
    expect(result?.dimensions).toBe(128);
    expect(result?.vector.length).toBe(128);
    expect(result?.fingerprint).toBe('chunk-fingerprint');
  });

  it('returns a vector for query input through the local embedder command', async () => {
    const provider = new ExternalCommandEmbeddingProvider(createCommand());
    const result = await provider.embedQuery({
      text: 'software design layers'
    });

    expect(result?.model).toBe('local-embedder-token-hash-v1');
    expect(result?.dimensions).toBe(128);
    expect(result?.vector.length).toBe(128);
  });

  it('reuses a persistent stdio server across multiple requests', async () => {
    const provider = new ExternalCommandEmbeddingProvider(createPersistentCommand());
    const first = await provider.embedChunk({
      chunkId: 'chunk-1',
      notePath: 'Architecture/Clean Architecture.md',
      text: 'Application boundaries keep adapters replaceable.',
      title: 'Clean Architecture',
      heading: 'Boundaries',
      tags: ['architecture'],
      fingerprint: 'chunk-fingerprint-1'
    });
    const second = await provider.embedQuery({
      text: 'software design layers'
    });

    expect(first?.model).toBe('local-embedder-token-hash-v1');
    expect(first?.vector.length).toBe(128);
    expect(second?.model).toBe('local-embedder-token-hash-v1');
    expect(second?.vector.length).toBe(128);
  });

  it('supports a stronger expanded external embedder in persistent mode', async () => {
    const provider = new ExternalCommandEmbeddingProvider(createExpandedPersistentCommand());
    const result = await provider.embedQuery({
      text: 'software design layers'
    });

    expect(result?.model).toBe('local-embedder-expanded-v1');
    expect(result?.dimensions).toBe(192);
    expect(result?.vector.length).toBe(192);
  });
});
