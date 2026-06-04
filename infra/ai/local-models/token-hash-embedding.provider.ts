import { createHash } from 'node:crypto';
import type { EmbeddingProviderPort, LocalChunkEmbeddingInput, LocalEmbeddingVector, LocalQueryEmbeddingInput } from '../../../application/ports/embedding-provider.port';

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .replace(/[`*_>~\[\]#!|():,.;]/g, ' ')
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function hashToken(token: string): { bucket: number; sign: number } {
  const digest = createHash('sha256').update(token).digest();
  const bucket = digest.readUInt32BE(0);
  const sign = digest[4] % 2 === 0 ? 1 : -1;
  return { bucket, sign };
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

export class TokenHashEmbeddingProvider implements EmbeddingProviderPort {
  readonly providerId = 'token-hash-local';
  private readonly dimensions = 128;
  private readonly model = 'token-hash-local';
  private readonly version = '1';
  readonly cacheKey = `${this.providerId}:${this.version}:${this.dimensions}`;

  async embedChunk(input: LocalChunkEmbeddingInput): Promise<LocalEmbeddingVector | null> {
    const text = [input.title ?? '', input.heading ?? '', input.tags.join(' '), input.text].filter(Boolean).join(' ');
    return this.embed(text, input.fingerprint);
  }

  async embedQuery(input: LocalQueryEmbeddingInput): Promise<LocalEmbeddingVector | null> {
    return this.embed(input.text, normalizeText(input.text));
  }

  private async embed(text: string, fingerprint: string): Promise<LocalEmbeddingVector | null> {
    const tokens = tokenize(text);
    if (tokens.length === 0) {
      return null;
    }

    const vector = new Array<number>(this.dimensions).fill(0);
    for (const token of tokens) {
      const { bucket, sign } = hashToken(token);
      vector[bucket % this.dimensions] += sign;
    }

    return {
      model: this.model,
      version: this.version,
      dimensions: this.dimensions,
      vector: normalizeVector(vector),
      fingerprint
    };
  }
}
