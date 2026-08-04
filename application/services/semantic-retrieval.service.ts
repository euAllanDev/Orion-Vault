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

type ConceptAliasScore = {
  readonly score: number;
  readonly reasons: readonly string[];
  readonly matchedPackIds: readonly string[];
  readonly evidenceHits: number;
};

type ChunkRerankResult = {
  readonly score: number;
  readonly reasons: readonly string[];
  readonly coverageRatio: number;
  readonly titleHits: number;
  readonly headingHits: number;
  readonly textHits: number;
  readonly pathHits: number;
  readonly exactTextMatch: number;
  readonly exactHeadingMatch: number;
  readonly exactTitleMatch: number;
  readonly focusBoost: number;
  readonly conceptAlias: ConceptAliasScore;
};

type NoteRerankSummary = {
  readonly path: string;
  readonly chunkCount: number;
  readonly matchedTerms: ReadonlySet<string>;
  readonly titleHits: number;
  readonly headingHits: number;
  readonly textHits: number;
  readonly pathHits: number;
  readonly exactTextMatches: number;
  readonly exactHeadingMatches: number;
  readonly exactTitleMatches: number;
  readonly focusBoost: number;
  readonly conceptAliasScore: number;
  readonly conceptAliasEvidenceHits: number;
  readonly conceptAliasPacks: ReadonlySet<string>;
  readonly noteTokenCount: number;
  readonly referenceSignalHits: number;
  readonly actionSignalHits: number;
  readonly structuralSignalHits: number;
  readonly titleReferenceSignalHits: number;
  readonly titleActionSignalHits: number;
  readonly titleStructuralSignalHits: number;
};

type NoteRerankResult = {
  readonly score: number;
  readonly reasons: readonly string[];
};

const noteRerankWeight = 2;

const referenceStyleTokens = new Set(['glossary', 'terminology', 'vocabulary', 'wording', 'reference', 'definitions', 'naming', 'language', 'term', 'terms']);
const actionStyleTokens = new Set(['playbook', 'runbook', 'checklist', 'workflow', 'guide', 'steps', 'triage', 'rollback', 'practical', 'actions']);
const structuralStyleTokens = new Set(['map', 'maps', 'navigate', 'navigation', 'structure', 'structured', 'path', 'paths', 'connected', 'connections', 'clusters', 'cluster', 'across']);

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
      .replace(/[`*_>~[]#!|():,.;]/g, ' ')
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
  const normalizedText = normalizeText(text).replace(/[`*_>~[]#!|():,.;-]/g, ' ').replace(/\s+/g, ' ').trim();
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
  selected: ReadonlyArray<{ normalizedText: string; tokenSet: ReadonlySet<string> }>
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

  if (chunk.tokenCount < 8 && vectorScore === 0 && conceptAlias.score > 0 && matchedTerms.length <= 1 && lexicalScore < 3.2) {
    return null;
  }

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
): ConceptAliasScore {
  if (queryTokens.length === 0) {
    return { score: 0, reasons: [], matchedPackIds: [], evidenceHits: 0 };
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
  const matchedPackIds: string[] = [];
  let totalEvidenceHits = 0;

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
    matchedPackIds.push(pack.id);
    totalEvidenceHits += evidenceHits;
  }

  return { score: totalScore, reasons, matchedPackIds, evidenceHits: totalEvidenceHits };
}

function rerankChunk(
  chunk: RetrievalChunkDto,
  queryTokens: readonly string[],
  query: string | undefined,
  focusPath?: string
): ChunkRerankResult {
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
    reasons,
    coverageRatio,
    titleHits,
    headingHits,
    textHits,
    pathHits,
    exactTextMatch,
    exactHeadingMatch,
    exactTitleMatch,
    focusBoost,
    conceptAlias
  };
}

function buildNoteRerankSummaries(
  items: ReadonlyArray<{ chunk: RetrievalChunkDto; rerank: ChunkRerankResult }>
): ReadonlyMap<string, NoteRerankSummary> {
  const summaries = new Map<string, {
    chunkCount: number;
    matchedTerms: Set<string>;
    titleHits: number;
    headingHits: number;
    textHits: number;
    pathHits: number;
    exactTextMatches: number;
    exactHeadingMatches: number;
    exactTitleMatches: number;
    focusBoost: number;
    conceptAliasScore: number;
    conceptAliasEvidenceHits: number;
    conceptAliasPacks: Set<string>;
    noteTokenCount: number;
    referenceSignalHits: number;
    actionSignalHits: number;
    structuralSignalHits: number;
    titleReferenceSignalHits: number;
    titleActionSignalHits: number;
    titleStructuralSignalHits: number;
  }>();

  for (const item of items) {
    const current = summaries.get(item.chunk.path) ?? {
      chunkCount: 0,
      matchedTerms: new Set<string>(),
      titleHits: 0,
      headingHits: 0,
      textHits: 0,
      pathHits: 0,
      exactTextMatches: 0,
      exactHeadingMatches: 0,
      exactTitleMatches: 0,
      focusBoost: 0,
      conceptAliasScore: 0,
      conceptAliasEvidenceHits: 0,
      conceptAliasPacks: new Set<string>(),
      noteTokenCount: 0,
      referenceSignalHits: 0,
      actionSignalHits: 0,
      structuralSignalHits: 0,
      titleReferenceSignalHits: 0,
      titleActionSignalHits: 0,
      titleStructuralSignalHits: 0
    };

    current.chunkCount += 1;
    current.titleHits += item.rerank.titleHits;
    current.headingHits += item.rerank.headingHits;
    current.textHits += item.rerank.textHits;
    current.pathHits += item.rerank.pathHits;
    current.exactTextMatches += item.rerank.exactTextMatch;
    current.exactHeadingMatches += item.rerank.exactHeadingMatch;
    current.exactTitleMatches += item.rerank.exactTitleMatch;
    current.focusBoost = Math.max(current.focusBoost, item.rerank.focusBoost);
    current.conceptAliasScore += item.rerank.conceptAlias.score;
    current.conceptAliasEvidenceHits += item.rerank.conceptAlias.evidenceHits;
    current.noteTokenCount += item.chunk.tokenCount;
    const noteStyleTokens = tokenize([item.chunk.title ?? '', item.chunk.heading ?? '', item.chunk.text].join(' '));
    const titleTokens = tokenize(item.chunk.title ?? '');
    current.referenceSignalHits += noteStyleTokens.filter((token) => referenceStyleTokens.has(token)).length;
    current.actionSignalHits += noteStyleTokens.filter((token) => actionStyleTokens.has(token)).length;
    current.structuralSignalHits += noteStyleTokens.filter((token) => structuralStyleTokens.has(token)).length;
    current.titleReferenceSignalHits += titleTokens.filter((token) => referenceStyleTokens.has(token)).length;
    current.titleActionSignalHits += titleTokens.filter((token) => actionStyleTokens.has(token)).length;
    current.titleStructuralSignalHits += titleTokens.filter((token) => structuralStyleTokens.has(token)).length;

    for (const term of item.chunk.matchedTerms) {
      current.matchedTerms.add(term);
    }

    for (const packId of item.rerank.conceptAlias.matchedPackIds) {
      current.conceptAliasPacks.add(packId);
    }

    summaries.set(item.chunk.path, current);
  }

  return new Map([...summaries.entries()].map(([path, summary]) => [path, {
    path,
    chunkCount: summary.chunkCount,
    matchedTerms: summary.matchedTerms,
    titleHits: summary.titleHits,
    headingHits: summary.headingHits,
    textHits: summary.textHits,
    pathHits: summary.pathHits,
    exactTextMatches: summary.exactTextMatches,
    exactHeadingMatches: summary.exactHeadingMatches,
    exactTitleMatches: summary.exactTitleMatches,
    focusBoost: summary.focusBoost,
    conceptAliasScore: summary.conceptAliasScore,
    conceptAliasEvidenceHits: summary.conceptAliasEvidenceHits,
    conceptAliasPacks: summary.conceptAliasPacks,
    noteTokenCount: summary.noteTokenCount,
    referenceSignalHits: summary.referenceSignalHits,
    actionSignalHits: summary.actionSignalHits,
    structuralSignalHits: summary.structuralSignalHits,
    titleReferenceSignalHits: summary.titleReferenceSignalHits,
    titleActionSignalHits: summary.titleActionSignalHits,
    titleStructuralSignalHits: summary.titleStructuralSignalHits
  }]));
}

function rerankNote(
  summary: NoteRerankSummary,
  queryTokens: readonly string[],
  focusPath?: string
): NoteRerankResult {
  const queryReferenceHits = queryTokens.filter((token) => referenceStyleTokens.has(token)).length;
  const queryActionHits = queryTokens.filter((token) => actionStyleTokens.has(token)).length;
  const queryStructuralHits = queryTokens.filter((token) => structuralStyleTokens.has(token)).length;
  const coverageRatio = queryTokens.length > 0
    ? summary.matchedTerms.size / queryTokens.length
    : 0;
  const hasCoreAlignment = summary.matchedTerms.size > 0 || summary.conceptAliasScore > 0;
  const structuralAligned = queryStructuralHits > 0 || summary.conceptAliasPacks.has('knowledge-links');
  const actionAligned = queryActionHits > 0 || summary.conceptAliasPacks.has('operations-incident');
  const structuralOverreach = !structuralAligned && summary.structuralSignalHits > 0 && summary.titleStructuralSignalHits > 0 && summary.conceptAliasScore === 0;
  const operationalReferencePenalty = actionAligned && summary.referenceSignalHits > 0 && summary.actionSignalHits === 0;
  const operationalTitlePenalty = actionAligned && summary.titleReferenceSignalHits > 0 && summary.titleActionSignalHits === 0;
  const reasons: string[] = [];

  if (summary.conceptAliasPacks.size > 0) {
    reasons.push(`note concept support: ${[...summary.conceptAliasPacks].join(', ')}`);
  }
  if (summary.chunkCount > 1) {
    reasons.push('note multi-chunk support');
  }
  if (coverageRatio >= 0.75) {
    reasons.push('note query coverage');
  }
  if (summary.noteTokenCount >= 70) {
    reasons.push('note semantic depth');
  }
  if (focusPath && summary.path === focusPath) {
    reasons.push('note focus boost');
  }
  if (summary.referenceSignalHits > 0) {
    reasons.push('note reference-style signal');
  }
  if (summary.actionSignalHits > 0 && actionAligned) {
    reasons.push('note action-style signal');
  }
  if (summary.structuralSignalHits > 0 && structuralAligned) {
    reasons.push('note structural-style signal');
  }
  if (summary.titleReferenceSignalHits > 0) {
    reasons.push('note reference title signal');
  }
  if (summary.titleActionSignalHits > 0 && actionAligned) {
    reasons.push('note action title signal');
  }
  if (summary.titleStructuralSignalHits > 0 && structuralAligned) {
    reasons.push('note structural title signal');
  }
  if (structuralOverreach) {
    reasons.push('note structural overreach guard');
  }
  if (operationalReferencePenalty) {
    reasons.push('note operational-reference guard');
  }
  if (operationalTitlePenalty) {
    reasons.push('note operational title guard');
  }
  if (!hasCoreAlignment) {
    reasons.push('note weak alignment guard');
  }

  return {
    score: (
      (coverageRatio * 0.45)
      + Math.min(0.6, Math.max(0, summary.chunkCount - 1) * 0.24)
      + Math.min(4.6, summary.conceptAliasScore * 1.1)
      + Math.min(2.2, summary.conceptAliasEvidenceHits * 0.35)
      + (summary.exactTitleMatches > 0 ? 0.2 : 0)
      + (summary.exactHeadingMatches > 0 ? 0.14 : 0)
      + (summary.exactTextMatches > 0 ? 0.1 : 0)
      + Math.min(0.2, summary.titleHits * 0.025)
      + Math.min(0.14, summary.headingHits * 0.02)
      + Math.min(0.08, summary.pathHits * 0.015)
      + (summary.noteTokenCount >= 70 ? 0.8 : summary.noteTokenCount >= 35 ? 0.35 : 0)
      + (focusPath && summary.path === focusPath ? 0.2 : 0)
      + (actionAligned ? Math.min(3, summary.actionSignalHits * 0.7) : 0)
      + (actionAligned ? Math.min(3.2, summary.titleActionSignalHits * 1.6) : 0)
      + (structuralAligned ? Math.min(1.8, summary.structuralSignalHits * 0.3) : 0)
      + (structuralAligned ? Math.min(1.6, summary.titleStructuralSignalHits * 0.8) : 0)
      - Math.min(1.4, summary.referenceSignalHits * 0.35)
      - Math.min(1.8, summary.titleReferenceSignalHits * 0.9)
      - (structuralOverreach ? Math.min(1.8, summary.structuralSignalHits * 0.22) + Math.min(1.2, summary.titleStructuralSignalHits * 0.55) : 0)
      - (queryReferenceHits === 0 && summary.titleReferenceSignalHits > 0 && summary.conceptAliasScore === 0 ? Math.min(0.9, summary.titleReferenceSignalHits * 0.35) : 0)
      - (operationalReferencePenalty ? Math.min(2.4, summary.referenceSignalHits * 0.45) + Math.min(1.8, summary.titleReferenceSignalHits * 0.9) : 0)
      - (operationalTitlePenalty ? Math.min(2.2, summary.titleReferenceSignalHits * 1.1) : 0)
    ) * (hasCoreAlignment ? 1 : 0.08),
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
    const noteRerank = rerankNote(buildNoteRerankSummaries([{ chunk: chunks[0], rerank }]).get(chunks[0].path)!, queryTokens, focusPath);
    return [{
      ...chunks[0],
      rerankScore: rerank.score + (noteRerank.score * noteRerankWeight),
      rerankReasons: [...new Set([...rerank.reasons, ...noteRerank.reasons])]
    }];
  }

  const reranked = chunks.map((chunk) => ({
      chunk,
      rerank: rerankChunk(chunk, queryTokens, query, focusPath)
    }));
  const noteSummaries = buildNoteRerankSummaries(reranked);
  const noteReranks = new Map<string, NoteRerankResult>(
    [...noteSummaries.entries()].map(([path, summary]) => [path, rerankNote(summary, queryTokens, focusPath)])
  );

  return reranked
    .sort((left, right) => {
      const leftNoteScore = noteReranks.get(left.chunk.path)?.score ?? 0;
      const rightNoteScore = noteReranks.get(right.chunk.path)?.score ?? 0;
      const leftCombinedScore = left.rerank.score + (leftNoteScore * noteRerankWeight);
      const rightCombinedScore = right.rerank.score + (rightNoteScore * noteRerankWeight);
      return rightCombinedScore - leftCombinedScore
        || rightNoteScore - leftNoteScore
        || right.rerank.score - left.rerank.score
        || right.chunk.score - left.chunk.score
        || left.chunk.path.localeCompare(right.chunk.path);
    })
    .map((item) => ({
      ...item.chunk,
      rerankScore: item.rerank.score + ((noteReranks.get(item.chunk.path)?.score ?? 0) * noteRerankWeight),
      rerankReasons: [...new Set([
        ...item.rerank.reasons,
        ...(noteReranks.get(item.chunk.path)?.reasons ?? [])
      ])]
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
    const providerKey = this.embeddingProvider.cacheKey ?? this.embeddingProvider.providerId;
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

    let computed = null;
    try {
      computed = await this.embeddingProvider.embedQuery({ text: query });
    } catch {
      computed = null;
    }

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
