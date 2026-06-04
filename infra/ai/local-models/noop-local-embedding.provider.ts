import type { EmbeddingProviderPort, LocalChunkEmbeddingInput, LocalEmbeddingVector, LocalQueryEmbeddingInput } from '../../../application/ports/embedding-provider.port';

export class NoopLocalEmbeddingProvider implements EmbeddingProviderPort {
  readonly providerId = 'noop';
  readonly cacheKey = this.providerId;

  async embedChunk(_input: LocalChunkEmbeddingInput): Promise<LocalEmbeddingVector | null> {
    return null;
  }

  async embedQuery(_input: LocalQueryEmbeddingInput): Promise<LocalEmbeddingVector | null> {
    return null;
  }
}
