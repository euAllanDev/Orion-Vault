export interface RetrievalChunkDto {
  readonly chunkId: string;
  readonly path: string;
  readonly title?: string;
  readonly heading?: string;
  readonly tags: readonly string[];
  readonly score: number;
  readonly snippet: string;
  readonly text: string;
  readonly tokenCount: number;
  readonly matchedTerms: readonly string[];
  readonly reasons: readonly string[];
  readonly lexicalScore?: number;
  readonly vectorScore?: number;
  readonly rankingMode?: 'lexical-only' | 'hybrid';
  readonly rerankScore?: number;
  readonly rerankReasons?: readonly string[];
}

export interface SemanticRetrievalRequestDto {
  readonly vaultRoot: string;
  readonly query?: string;
  readonly tags?: readonly string[];
  readonly focusPath?: string;
  readonly scopePaths?: readonly string[];
  readonly maxChunks?: number;
  readonly maxCharacters?: number;
  readonly rankingWeights?: {
    readonly lexical: number;
    readonly vector: number;
    readonly structural: number;
  };
}

export interface SemanticRetrievalResponseDto {
  readonly vaultRoot: string;
  readonly query?: string;
  readonly chunks: readonly RetrievalChunkDto[];
}
