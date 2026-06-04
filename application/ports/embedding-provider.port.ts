export interface LocalEmbeddingVector {
  readonly model: string;
  readonly version: string;
  readonly dimensions: number;
  readonly vector: readonly number[];
  readonly fingerprint: string;
}

export interface LocalChunkEmbeddingInput {
  readonly chunkId: string;
  readonly notePath: string;
  readonly text: string;
  readonly title?: string;
  readonly heading?: string;
  readonly tags: readonly string[];
  readonly fingerprint: string;
}

export interface LocalQueryEmbeddingInput {
  readonly text: string;
}

export interface EmbeddingProviderPort {
  readonly providerId: string;
  readonly cacheKey?: string;
  embedChunk(input: LocalChunkEmbeddingInput): Promise<LocalEmbeddingVector | null>;
  embedQuery(input: LocalQueryEmbeddingInput): Promise<LocalEmbeddingVector | null>;
}
