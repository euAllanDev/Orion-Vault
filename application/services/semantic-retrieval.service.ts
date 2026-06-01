import fs from 'node:fs/promises';
import path from 'node:path';
import type { NoteSnapshotDto } from '../dto/note-snapshot.dto';
import type { RetrievalChunkDto, SemanticRetrievalRequestDto, SemanticRetrievalResponseDto } from '../dto/semantic-retrieval.dto';
import { ChunkedNoteIndexService, type IndexedChunk } from './chunked-note-index.service';
import type { EmbeddingProviderPort, LocalEmbeddingVector } from '../ports/embedding-provider.port';

export interface SemanticRetrievalServiceOptions {
  readonly excludedPaths?: readonly string[];
}

type PersistedQueryEmbedding = {
  readonly model: string;
  readonly version: string;
  readonly dimensions: number;
  readonly vector: readonly number[];
  readonly fingerprint: string;
};

type PersistedQueryEmbeddingIndex = {
  readonly version: 1;
  readonly providers: Record<string, Record<string, PersistedQueryEmbedding>>;
};

type ConceptAliasPack = {
  readonly id: string;
  readonly triggerTokens: readonly string[];
  readonly evidenceTokens: readonly string[];
};

const conceptAliasPacks: readonly ConceptAliasPack[] = [
  {
    id: 'architecture-core',
    triggerTokens: ['software', 'design', 'layers', 'architecture', 'modular', 'boundaries'],
    evidenceTokens: ['use', 'cases', 'adapters', 'domain', 'rules', 'infrastructure', 'boundaries', 'architecture']
  },
  {
    id: 'operations-incident',
    triggerTokens: ['support', 'diagnosis', 'outage', 'recovery', 'incident', 'service'],
    evidenceTokens: ['incident', 'rollback', 'runbook', 'recovery', 'maintenance', 'service', 'diagnosis']
  },
  {
    id: 'product-discovery',
    triggerTokens: ['customer', 'learning', 'assumption', 'testing', 'research', 'discovery'],
    evidenceTokens: ['interviews', 'evidence', 'hypothesis', 'checks', 'experiments', 'product', 'decisions', 'discovery']
  },
  {
    id: 'learning-retention',
    triggerTokens: ['memory', 'retention', 'reinforcement', 'learning', 'study', 'recall'],
    evidenceTokens: ['recall', 'review', 'practice', 'retention', 'retrieval', 'spaced', 'understanding']
  },
  {
    id: 'knowledge-links',
    triggerTokens: ['connected', 'ideas', 'notes', 'knowledge', 'relationships'],
    evidenceTokens: ['linked', 'ideas', 'connected', 'knowledge', 'note', 'relationships', 'graph']
  },
  {
    id: 'writing-revision',
    triggerTokens: ['text', 'refinement', 'publication', 'writing', 'editing'],
    evidenceTokens: ['revision', 'editing', 'outline', 'draft', 'publication', 'writing']
  },
  {
    id: 'finance-planning',
    triggerTokens: ['money', 'planning', 'spending', 'control', 'finance', 'budget'],
    evidenceTokens: ['budget', 'spending', 'expenses', 'costs', 'money', 'finance']
  }
] as const;

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return [...new Set(
    normalizeText(value)
      .replace(/[`*_>~\[\]#!|():,.;]/g, ' ')
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter(Boolean)
  )];
}

function formatSnippet(text: string, terms: readonly string[]): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  const normalizedCompact = compact.toLowerCase();

  for (const term of terms) {
    const needle = term.toLowerCase();
    const index = normalizedCompact.indexOf(needle);
    if (index >= 0) {
      const start = Math.max(0, index - 60);
      const end = Math.min(compact.length, index + needle.length + 60);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < compact.length ? '...' : '';
      return `${prefix}${compact.slice(start, end)}${suffix}`;
    }
  }

  return compact.slice(0, 160);
}

function buildChunkDuplicateSignature(text: string): { normalizedText: string; tokenSet: ReadonlySet<string> } {
  const normalizedText = normalizeText(text).replace(/[`*_>~\[\]#!|():,.;-]/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    normalizedText,
    tokenSet: new Set(tokenize(normalizedText))
  };
}

function calculateTokenOverlap(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.max(left.size, right.size);
}

function isNearDuplicateChunk(
  candidate: RetrievalChunkDto,
  selected: readonly Array<{ normalizedText: string; tokenSet: ReadonlySet<string> }>
): boolean {
  const candidateSignature = buildChunkDuplicateSignature(candidate.text);
  if (!candidateSignature.normalizedText) {
    return false;
  }

  return selected.some((existing) => {
    if (existing.normalizedText === candidateSignature.normalizedText) {
      return true;
    }

    const lengthRatio = existing.normalizedText.length > candidateSignature.normalizedText.length
      ? candidateSignature.normalizedText.length / existing.normalizedText.length
      : existing.normalizedText.length / candidateSignature.normalizedText.length;
    if (lengthRatio < 0.88) {
      return false;
    }

    return calculateTokenOverlap(candidateSignature.tokenSet, existing.tokenSet) >= 0.92;
  });
}

function filterScope(chunk: IndexedChunk, scopePaths: readonly string[] | undefined): boolean {
  if (!scopePaths || scopePaths.length === 0) {
    return true;
  }

  return scopePaths.some((scopePath) => {
    const normalizedScope = scopePath.replace(/\\/g, '/').trim();
    return chunk.notePath === normalizedScope || chunk.notePath.startsWith(`${normalizedScope}/`);
  });
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function matchesExcludedPath(notePath: string, excludedPaths: readonly string[]): boolean {
  const normalizedPath = normalizeRelativePath(notePath);
  return excludedPaths.some((excludedPath) => {
    const normalizedExcludedPath = normalizeRelativePath(excludedPath);
    return normalizedPath === normalizedExcludedPath || normalizedPath.startsWith(`${normalizedExcludedPath}/`);
  });
}

async function readPersistedQueryEmbeddingIndex(indexPath: string): Promise<PersistedQueryEmbeddingIndex | null> {
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw) as PersistedQueryEmbeddingIndex;
    return parsed.version === 1 && parsed.providers ? parsed : null;
  } catch {
    return null;
  }
}

async function writePersistedQueryEmbeddingIndex(indexPath: string, index: PersistedQueryEmbeddingIndex): Promise<void> {
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function scoreChunk(
  chunk: IndexedChunk,
  queryTokens: readonly string[],
  tagTokens: readonly string[],
  documentFrequencies: ReadonlyMap<string, number>,
  documentCount: number,
  queryEmbedding: readonly number[] | undefined,
  rankingWeights: { lexical: number; vector: number; structural: number },
  focusPath?: string
): RetrievalChunkDto | null {
  const matchedTerms: string[] = [];
  const reasons: string[] = [];
  let lexicalScore = 0;

  for (const token of queryTokens) {
    const termCount = chunk.terms.get(token) ?? 0;
    if (termCount === 0) {
      continue;
    }

    const df = documentFrequencies.get(token) ?? 1;
    const idf = Math.log(1 + (documentCount / df));
    lexicalScore += termCount * idf * 2.4;
    matchedTerms.push(token);
  }

  if (tagTokens.length > 0) {
    const normalizedChunkTags = new Set(chunk.tags.map((tag) => normalizeText(tag).replace(/^#/, '')));
    const tagMatches = tagTokens.filter((tag) => normalizedChunkTags.has(tag));
    if (tagMatches.length === 0) {
      return null;
    }
    lexicalScore += tagMatches.length * 2.5;
    reasons.push(`tags: ${tagMatches.join(', ')}`);
    matchedTerms.push(...tagMatches);
  }

  const normalizedTitle = normalizeText(chunk.title ?? '');
  const normalizedHeading = normalizeText(chunk.heading ?? '');
  const normalizedPath = normalizeText(chunk.notePath);
  const normalizedQuery = queryTokens.join(' ').trim();

  if (normalizedQuery) {
    if (normalizedTitle.includes(normalizedQuery)) {
      lexicalScore += 3;
      reasons.push('title match');
    }
    if (normalizedHeading.includes(normalizedQuery)) {
      lexicalScore += 2.2;
      reasons.push('heading match');
    }
  }

  const pathMatches = queryTokens.filter((token) => normalizedPath.includes(token));
  if (pathMatches.length > 0) {
    lexicalScore += pathMatches.length * 0.9;
    reasons.push('path match');
  }

  if (focusPath && chunk.notePath === focusPath) {
    lexicalScore += 1.5;
    reasons.push('focus note');
  }

  const vectorScore = queryEmbedding && chunk.embedding
    ? Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding)) * 8
    : 0;

  const structuralBoost = (focusPath && chunk.notePath === focusPath ? 1.5 : 0)
    + (pathMatches.length > 0 ? pathMatches.length * 0.15 : 0)
    + (normalizedQuery && normalizedTitle.includes(normalizedQuery) ? 0.5 : 0)
    + (normalizedQuery && normalizedHeading.includes(normalizedQuery) ? 0.35 : 0);

  const conceptAlias = scoreConceptAlias({
    path: chunk.notePath,
    title: chunk.title,
    heading: chunk.heading,
    tags: chunk.tags,
    text: chunk.text
  }, queryTokens);

  const score = (
    (lexicalScore * rankingWeights.lexical)
    + (vectorScore * rankingWeights.vector)
    + (structuralBoost * rankingWeights.structural)
    + (conceptAlias.score * 0.45)
  ) * chunk.qualityWeight;
  const rankingMode = vectorScore > 0 ? 'hybrid' as const : 'lexical-only' as const;

  if (score <= 0 || (queryTokens.length > 0 && matchedTerms.length === 0 && tagTokens.length === 0 && vectorScore === 0 && conceptAlias.score === 0)) {
    return null;
  }

  if (vectorScore > 0) {
    reasons.push('vector similarity');
  }
  reasons.push(...conceptAlias.reasons);

  const uniqueMatchedTerms = [...new Set(matchedTerms)];
  return {
    chunkId: chunk.chunkId,
    path: chunk.notePath,
    title: chunk.title,
    heading: chunk.heading,
    tags: chunk.tags,
    score,
    snippet: formatSnippet(chunk.text, uniqueMatchedTerms),
    text: chunk.text,
    tokenCount: chunk.tokenCount,
    matchedTerms: uniqueMatchedTerms,
    reasons: reasons.length > 0 ? reasons : ['content similarity'],
    lexicalScore,
    vectorScore: vectorScore > 0 ? vectorScore : undefined,
    rankingMode
  };
}

function countTokenHits(text: string, queryTokens: readonly string[]): number {
  const normalizedText = normalizeText(text);
  return queryTokens.filter((token) => normalizedText.includes(token)).length;
}

function scoreConceptAlias(
  chunk: Pick<RetrievalChunkDto, 'title' | 'heading' | 'path' | 'tags' | 'text'>,
  queryTokens: readonly string[]
): { score: number; reasons: string[] } {
  if (queryTokens.length === 0) {
    return { score: 0, reasons: [] };
  }

  const chunkTokens = new Set(tokenize([
    chunk.title ?? '',
    chunk.heading ?? '',
    chunk.path,
    chunk.tags.join(' '),
    chunk.text
  ].join(' ')));
  const queryTokenSet = new Set(queryTokens);
  let totalScore = 0;
  const reasons: string[] = [];

  for (const pack of conceptAliasPacks) {
    const triggerHits = pack.triggerTokens.filter((token) => queryTokenSet.has(token)).length;
    if (triggerHits < 2) {
      continue;
    }

    const evidenceHits = pack.evidenceTokens.filter((token) => chunkTokens.has(token)).length;
    if (evidenceHits === 0) {
      continue;
    }

    totalScore += (triggerHits * 0.28) + (evidenceHits * 0.36);
    reasons.push(`concept alias: ${pack.id}`);
  }

  return { score: totalScore, reasons };
}

function rerankChunk(
  chunk: RetrievalChunkDto,
  queryTokens: readonly string[],
  query: string | undefined,
  focusPath?: string
): { score: number; reasons: string[] } {
  const normalizedQuery = normalizeText(query ?? '');
  const coverageRatio = queryTokens.length > 0
    ? chunk.matchedTerms.length / queryTokens.length
    : 0;
  const titleHits = countTokenHits(chunk.title ?? '', queryTokens);
  const headingHits = countTokenHits(chunk.heading ?? '', queryTokens);
  const textHits = countTokenHits(chunk.text, queryTokens);
  const pathHits = countTokenHits(chunk.path, queryTokens);
  const exactTextMatch = normalizedQuery && normalizeText(chunk.text).includes(normalizedQuery) ? 1 : 0;
  const exactHeadingMatch = normalizedQuery && normalizeText(chunk.heading ?? '').includes(normalizedQuery) ? 1 : 0;
  const exactTitleMatch = normalizedQuery && normalizeText(chunk.title ?? '').includes(normalizedQuery) ? 1 : 0;
  const focusBoost = focusPath && chunk.path === focusPath ? 0.45 : 0;
  const conceptAlias = scoreConceptAlias(chunk, queryTokens);

  const reasons: string[] = [];
  if (coverageRatio >= 0.75) {
    reasons.push('high query coverage');
  }
  if (exactTextMatch) {
    reasons.push('exact query phrase in body');
  }
  if (exactTitleMatch) {
    reasons.push('exact query phrase in title');
  }
  if (exactHeadingMatch) {
    reasons.push('exact query phrase in heading');
  }
  if (titleHits > 0) {
    reasons.push('title token hits');
  }
  if (headingHits > 0) {
    reasons.push('heading token hits');
  }
  if (focusBoost > 0) {
    reasons.push('focus note boost');
  }
  reasons.push(...conceptAlias.reasons);

  return {
    score: chunk.score
      + (coverageRatio * 2.1)
      + (titleHits * 0.28)
      + (headingHits * 0.22)
      + (textHits * 0.06)
      + (pathHits * 0.04)
      + (exactTextMatch * 0.75)
      + (exactHeadingMatch * 0.45)
      + (exactTitleMatch * 0.6)
      + focusBoost
      + conceptAlias.score,
    reasons
  };
}

function rerankChunks(
  chunks: readonly RetrievalChunkDto[],
  queryTokens: readonly string[],
  query: string | undefined,
  focusPath?: string
): RetrievalChunkDto[] {
  if (chunks.length === 0) {
    return [];
  }

  if (chunks.length === 1) {
    const rerank = rerankChunk(chunks[0], queryTokens, query, focusPath);
    return [{
      ...chunks[0],
      rerankScore: rerank.score,
      rerankReasons: rerank.reasons
    }];
  }

  return chunks
    .map((chunk) => ({
      chunk,
      rerank: rerankChunk(chunk, queryTokens, query, focusPath)
    }))
    .sort((left, right) => right.rerank.score - left.rerank.score || right.chunk.score - left.chunk.score || left.chunk.path.localeCompare(right.chunk.path))
    .map((item) => ({
      ...item.chunk,
      rerankScore: item.rerank.score,
      rerankReasons: item.rerank.reasons
    }));
}

export class SemanticRetrievalService {
  private readonly queryEmbeddingIndexCache = new Map<string, PersistedQueryEmbeddingIndex>();

  constructor(
    private readonly indexService = new ChunkedNoteIndexService(),
    private readonly embeddingProvider?: EmbeddingProviderPort,
    private readonly options: SemanticRetrievalServiceOptions = {}
  ) {}

  async retrieve(notes: readonly NoteSnapshotDto[], request: SemanticRetrievalRequestDto): Promise<SemanticRetrievalResponseDto> {
    const query = request.query?.trim() || undefined;
    const queryTokens = tokenize(query ?? '');
    const tagTokens = [...new Set((request.tags ?? []).map((tag) => normalizeText(tag).replace(/^#/, '')).filter(Boolean))];

    const rankingWeights = request.rankingWeights ?? {
      lexical: 0.55,
      vector: 0.35,
      structural: 0.10
    };

    if (queryTokens.length === 0 && tagTokens.length === 0) {
      return {
        vaultRoot: request.vaultRoot,
        query,
        chunks: []
      };
    }

    const eligibleNotes = (this.options.excludedPaths?.length ?? 0) > 0
      ? notes.filter((note) => !matchesExcludedPath(note.relativePath, this.options.excludedPaths ?? []))
      : notes;
    const index = await this.indexService.build(request.vaultRoot, eligibleNotes);
    const queryEmbedding = query
      ? (await this.resolveQueryEmbedding(request.vaultRoot, query))?.vector
      : undefined;
    const maxChunks = Math.max(1, request.maxChunks ?? 8);
    const maxCharacters = Math.max(400, request.maxCharacters ?? 5000);
    let usedCharacters = 0;

    const ranked = rerankChunks(index.chunks
      .filter((chunk) => filterScope(chunk, request.scopePaths))
      .map((chunk) => scoreChunk(chunk, queryTokens, tagTokens, index.documentFrequencies, index.chunks.length || 1, queryEmbedding, rankingWeights, request.focusPath))
      .filter((chunk): chunk is RetrievalChunkDto => chunk !== null)
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path)), queryTokens, query, request.focusPath);
    const topRankScore = ranked[0] ? (ranked[0].rerankScore ?? ranked[0].score) : 0;
    const minimumScore = topRankScore > 0 ? Math.max(1.6, topRankScore * 0.22) : 0;

    const chunks: RetrievalChunkDto[] = [];
    const seenChunkIds = new Set<string>();
    const selectedSignatures: Array<{ normalizedText: string; tokenSet: ReadonlySet<string> }> = [];
    for (const chunk of ranked) {
      const effectiveScore = chunk.rerankScore ?? chunk.score;
      if (effectiveScore < minimumScore) {
        continue;
      }

      if (seenChunkIds.has(chunk.chunkId)) {
        continue;
      }

      if (isNearDuplicateChunk(chunk, selectedSignatures)) {
        continue;
      }

      const nextCharacters = usedCharacters + chunk.text.length;
      if (chunks.length >= maxChunks || (chunks.length > 0 && nextCharacters > maxCharacters)) {
        break;
      }

      seenChunkIds.add(chunk.chunkId);
      usedCharacters = nextCharacters;
      chunks.push(chunk);
      selectedSignatures.push(buildChunkDuplicateSignature(chunk.text));
    }

    return {
      vaultRoot: request.vaultRoot,
      query,
      chunks
    };
  }

  private async resolveQueryEmbedding(vaultRoot: string, query: string): Promise<LocalEmbeddingVector | null> {
    if (!this.embeddingProvider) {
      return null;
    }

    const fingerprint = normalizeText(query);
    const providerKey = this.embeddingProvider.providerId;
    const indexPath = path.join(vaultRoot, '.orion', 'index', 'semantic-query-embeddings.json');
    const cacheKey = `${vaultRoot}::${providerKey}`;

    let persistedIndex = this.queryEmbeddingIndexCache.get(cacheKey);
    if (!persistedIndex) {
      persistedIndex = (await readPersistedQueryEmbeddingIndex(indexPath)) ?? { version: 1, providers: {} };
      this.queryEmbeddingIndexCache.set(cacheKey, persistedIndex);
    }

    const providerEntries = persistedIndex.providers[providerKey] ?? {};
    const cached = providerEntries[fingerprint];
    if (cached && cached.vector.length > 0) {
      return { ...cached, vector: [...cached.vector] };
    }

    const computed = await this.embeddingProvider.embedQuery({ text: query });
    if (!computed || computed.vector.length === 0) {
      return null;
    }

    persistedIndex.providers[providerKey] = {
      ...providerEntries,
      [fingerprint]: {
        model: computed.model,
        version: computed.version,
        dimensions: computed.dimensions,
        vector: [...computed.vector],
        fingerprint: computed.fingerprint
      }
    };
    this.queryEmbeddingIndexCache.set(cacheKey, persistedIndex);
    await writePersistedQueryEmbeddingIndex(indexPath, persistedIndex);
    return computed;
  }
}
