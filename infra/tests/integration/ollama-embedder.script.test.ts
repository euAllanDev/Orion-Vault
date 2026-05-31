import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ExternalCommandEmbeddingProvider } from '../../../infra/ai/local-models/external-command-embedding.provider';

function createCommand(): string {
  const scriptPath = fileURLToPath(new URL('../../../scripts/ollama-embedder.js', import.meta.url));
  return `"${process.execPath}" "${path.resolve(scriptPath)}"`;
}

function createPersistentCommand(): string {
  return `${createCommand()} --stdio-server`;
}

function createPrefixedPersistentCommand(): string {
  return `${createCommand()} --stdio-server --query-prefix search_query --document-prefix search_document`;
}

async function withFakeOllama(handler: (requests: string[]) => Promise<void>) {
  const requests: string[] = [];
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/api/embed') {
      response.statusCode = 404;
      response.end();
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { model?: string; input?: string };
    requests.push(String(body.input ?? ''));
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({
      model: body.model,
      embeddings: [[0.25, 0.5, 0.75, String(body.input ?? '').length]]
    }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind fake Ollama server.');
  }

  const previousHost = process.env.OLLAMA_HOST;
  const previousModel = process.env.OLLAMA_EMBED_MODEL;
  process.env.OLLAMA_HOST = `http://127.0.0.1:${address.port}`;
  process.env.OLLAMA_EMBED_MODEL = 'nomic-embed-text';

  try {
    await handler(requests);
  } finally {
    if (previousHost === undefined) {
      delete process.env.OLLAMA_HOST;
    } else {
      process.env.OLLAMA_HOST = previousHost;
    }

    if (previousModel === undefined) {
      delete process.env.OLLAMA_EMBED_MODEL;
    } else {
      process.env.OLLAMA_EMBED_MODEL = previousModel;
    }

    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe('ollama-embedder script', () => {
  it('returns a vector through the external-command contract', async () => {
    await withFakeOllama(async () => {
      const provider = new ExternalCommandEmbeddingProvider(createCommand());
      const result = await provider.embedQuery({ text: 'software design layers' });

      expect(result?.model).toBe('ollama:nomic-embed-text');
      expect(result?.dimensions).toBe(4);
      expect(result?.vector).toEqual([0.25, 0.5, 0.75, 22]);
    });
  });

  it('supports persistent stdio mode across multiple requests', async () => {
    await withFakeOllama(async () => {
      const provider = new ExternalCommandEmbeddingProvider(createPersistentCommand());
      const first = await provider.embedChunk({
        chunkId: 'chunk-1',
        notePath: 'Architecture.md',
        title: 'Architecture',
        heading: 'Boundaries',
        tags: ['architecture'],
        text: 'Adapters stay thin.',
        fingerprint: 'chunk-fingerprint'
      });
      const second = await provider.embedQuery({ text: 'incident response' });

      expect(first?.model).toBe('ollama:nomic-embed-text');
      expect(first?.dimensions).toBe(4);
      expect(second?.model).toBe('ollama:nomic-embed-text');
      expect(second?.dimensions).toBe(4);
    });
  });

  it('applies optional query and document prefixes for embedding models that expect them', async () => {
    await withFakeOllama(async (requests) => {
      const provider = new ExternalCommandEmbeddingProvider(createPrefixedPersistentCommand());
      await provider.embedChunk({
        chunkId: 'chunk-1',
        notePath: 'Architecture.md',
        title: 'Architecture',
        heading: 'Boundaries',
        tags: ['architecture'],
        text: 'Adapters stay thin.',
        fingerprint: 'chunk-fingerprint'
      });
      await provider.embedQuery({ text: 'software design layers' });

      expect(requests[0]).toMatch(/^search_document:\s+/);
      expect(requests[1]).toMatch(/^search_query:\s+/);
    });
  });
});
