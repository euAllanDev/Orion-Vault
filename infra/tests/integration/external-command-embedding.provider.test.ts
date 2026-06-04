import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
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

function createCounterCommand(): string {
  const scriptPath = fileURLToPath(new URL('../../../tests/fixtures/external-command-call-counter.js', import.meta.url));
  return `"${process.execPath}" "${path.resolve(scriptPath)}"`;
}

function createCounterPersistentCommand(): string {
  return `${createCounterCommand()} --stdio-server`;
}

function createHangCommand(): string {
  const scriptPath = fileURLToPath(new URL('../../../tests/fixtures/external-command-hang.js', import.meta.url));
  return `"${process.execPath}" "${path.resolve(scriptPath)}"`;
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

  it('caches repeated query embeddings by fingerprint for single-request commands', async () => {
    const counterFilePath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'orion-external-embedder-')), 'counter.txt');
    await fs.writeFile(counterFilePath, '0', 'utf8');
    process.env.ORION_TEST_COUNTER_FILE = counterFilePath;
    const provider = new ExternalCommandEmbeddingProvider(createCounterCommand());

    try {
      const first = await provider.embedQuery({ text: 'software design layers' });
      const second = await provider.embedQuery({ text: 'software design layers' });
      const count = Number.parseInt(await fs.readFile(counterFilePath, 'utf8'), 10);

      expect(first?.model).toBe('counter-embedder-v1');
      expect(second?.model).toBe('counter-embedder-v1');
      expect(count).toBe(1);
    } finally {
      delete process.env.ORION_TEST_COUNTER_FILE;
      await fs.rm(path.dirname(counterFilePath), { recursive: true, force: true });
    }
  });

  it('caches repeated query embeddings by fingerprint for persistent commands', async () => {
    const counterFilePath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'orion-external-embedder-persistent-')), 'counter.txt');
    await fs.writeFile(counterFilePath, '0', 'utf8');
    process.env.ORION_TEST_COUNTER_FILE = counterFilePath;
    const provider = new ExternalCommandEmbeddingProvider(createCounterPersistentCommand());

    try {
      const first = await provider.embedQuery({ text: 'support diagnosis during outage' });
      const second = await provider.embedQuery({ text: 'support diagnosis during outage' });
      const count = Number.parseInt(await fs.readFile(counterFilePath, 'utf8'), 10);

      expect(first?.model).toBe('counter-embedder-v1');
      expect(second?.model).toBe('counter-embedder-v1');
      expect(count).toBe(1);
    } finally {
      provider.close();
      delete process.env.ORION_TEST_COUNTER_FILE;
      await fs.rm(path.dirname(counterFilePath), { recursive: true, force: true });
    }
  });

  it('batches concurrent persistent requests into a single script call when supported', async () => {
    const counterFilePath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'orion-external-embedder-batch-')), 'counter.txt');
    await fs.writeFile(counterFilePath, '0', 'utf8');
    process.env.ORION_TEST_COUNTER_FILE = counterFilePath;
    const provider = new ExternalCommandEmbeddingProvider(createCounterPersistentCommand());

    try {
      const [first, second] = await Promise.all([
        provider.embedQuery({ text: 'software design layers' }),
        provider.embedQuery({ text: 'support diagnosis during outage' })
      ]);
      const count = Number.parseInt(await fs.readFile(counterFilePath, 'utf8'), 10);

      expect(first?.model).toBe('counter-embedder-v1');
      expect(second?.model).toBe('counter-embedder-v1');
      expect(count).toBe(1);
    } finally {
      provider.close();
      delete process.env.ORION_TEST_COUNTER_FILE;
      await fs.rm(path.dirname(counterFilePath), { recursive: true, force: true });
    }
  });

  it('times out and returns null when a single-request command hangs', async () => {
    const provider = new ExternalCommandEmbeddingProvider(createHangCommand(), { requestTimeoutMs: 50 });
    const startedAt = Date.now();
    const result = await provider.embedQuery({ text: 'software design layers' });
    const elapsedMs = Date.now() - startedAt;

    expect(result).toBeNull();
    expect(elapsedMs).toBeGreaterThanOrEqual(40);
    expect(elapsedMs).toBeLessThan(1_000);
  });
});
