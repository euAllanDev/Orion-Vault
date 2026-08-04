import { createHash } from 'node:crypto';
import type { EmbeddingProviderPort, LocalChunkEmbeddingInput, LocalEmbeddingVector, LocalQueryEmbeddingInput } from '../../../application/ports/embedding-provider.port';

const synonymGroups = [
  ['architecture', 'design', 'structure', 'layers', 'layered', 'boundaries', 'adapters', 'modularity'],
  ['operations', 'ops', 'incident', 'rollback', 'runbook', 'maintenance', 'diagnosis', 'support'],
  ['writing', 'drafting', 'revision', 'editing', 'outline', 'authoring'],
  ['finance', 'budget', 'expenses', 'spending', 'cashflow', 'cash-flow', 'money'],
  ['learning', 'study', 'recall', 'review', 'practice', 'memory'],
  ['knowledge', 'notes', 'graph', 'backlinks', 'relations', 'connected'],
  ['health', 'training', 'fitness', 'recovery', 'mobility', 'exercise'],
  ['product', 'discovery', 'research', 'hypothesis', 'experiment', 'feedback']
] as const;

const synonymMap = new Map<string, readonly string[]>(
  synonymGroups.flatMap((group) => group.map((token) => [token, group] as const))
);

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
    .replace(/[`*_>~[]#!|():,.;]/g, ' ')
    .split(/[^a-z0-9-]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildCharacterTrigrams(value: string): string[] {
  const compact = normalizeText(value).replace(/[^a-z0-9]+/g, '');
  if (compact.length < 3) {
    return compact ? [compact] : [];
  }

  const trigrams: string[] = [];
  for (let index = 0; index <= compact.length - 3; index += 1) {
    trigrams.push(compact.slice(index, index + 3));
  }
  return trigrams;
}

function expandTokens(tokens: readonly string[]): string[] {
  const expanded = new Set<string>(tokens);
  for (const token of tokens) {
    const group = synonymMap.get(token);
    if (!group) {
      continue;
    }

    for (const synonym of group) {
      expanded.add(synonym);
    }
  }

  return [...expanded];
}

function hashToken(token: string): { bucket: number; sign: number } {
  const digest = createHash('sha256').update(token).digest();
  return {
    bucket: digest.readUInt32BE(0),
    sign: digest[4] % 2 === 0 ? 1 : -1
  };
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

export class ExpandedTokenHashEmbeddingProvider implements EmbeddingProviderPort {
  readonly providerId = 'expanded-token-hash-local';
  private readonly dimensions = 192;
  private readonly model = 'expanded-token-hash-local';
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
    const baseTokens = tokenize(text);
    const tokens = expandTokens(baseTokens);
    const trigrams = buildCharacterTrigrams(text);
    if (tokens.length === 0 && trigrams.length === 0) {
      return null;
    }

    const vector = new Array<number>(this.dimensions).fill(0);

    for (const token of tokens) {
      const { bucket, sign } = hashToken(`tok:${token}`);
      vector[bucket % this.dimensions] += sign * 1.2;
    }

    for (const trigram of trigrams) {
      const { bucket, sign } = hashToken(`tri:${trigram}`);
      vector[bucket % this.dimensions] += sign * 0.35;
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
