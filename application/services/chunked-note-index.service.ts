import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { NoteSnapshotDto } from '../dto/note-snapshot.dto';
import type { EmbeddingProviderPort } from '../ports/embedding-provider.port';

type PersistedChunk = {
  readonly chunkId: string;
  readonly notePath: string;
  readonly title?: string;
  readonly heading?: string;
  readonly tags: readonly string[];
  readonly text: string;
  readonly tokenCount: number;
  readonly terms: Record<string, number>;
  readonly embeddingModel?: string;
  readonly embeddingVersion?: string;
  readonly embeddingDimensions?: number;
  readonly embedding?: readonly number[];
  readonly embeddingFingerprint?: string;
  readonly embeddingProviderKey?: string;
};

type PersistedNoteEntry = {
  readonly fingerprint: string;
  readonly chunkingStrategy?: ChunkingStrategy;
  readonly chunks: readonly PersistedChunk[];
};

type PersistedIndex = {
  readonly version: 1;
  readonly notes: Record<string, PersistedNoteEntry>;
};

export interface IndexedChunk {
  readonly chunkId: string;
  readonly notePath: string;
  readonly title?: string;
  readonly heading?: string;
  readonly tags: readonly string[];
  readonly text: string;
  readonly tokenCount: number;
  readonly terms: ReadonlyMap<string, number>;
  readonly qualityWeight: number;
  readonly embeddingModel?: string;
  readonly embeddingVersion?: string;
  readonly embeddingDimensions?: number;
  readonly embedding?: readonly number[];
}

export interface ChunkedNoteIndex {
  readonly vaultRoot: string;
  readonly chunks: readonly IndexedChunk[];
  readonly noteFingerprints: ReadonlyMap<string, string>;
  readonly documentFrequencies: ReadonlyMap<string, number>;
}

export interface ChunkedNoteIndexServiceOptions {
  readonly excludedPaths?: readonly string[];
  readonly chunkingStrategy?: ChunkingStrategy;
}

export type ChunkingStrategy = 'section-balanced' | 'sentence-tight';

type ChunkingConfig = {
  readonly sentenceWindowTokens: number;
  readonly chunkMaxTokens: number;
};

function resolveChunkingConfig(strategy: ChunkingStrategy): ChunkingConfig {
  switch (strategy) {
    case 'sentence-tight':
      return {
        sentenceWindowTokens: 80,
        chunkMaxTokens: 110
      };
    case 'section-balanced':
    default:
      return {
        sentenceWindowTokens: 140,
        chunkMaxTokens: 180
      };
  }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .replace(/[`*_>~[]#!|():,.;]/g, ' ')
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function countTerms(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function toRecord(terms: ReadonlyMap<string, number>): Record<string, number> {
  return Object.fromEntries(terms.entries());
}

function fromRecord(terms: Record<string, number>): ReadonlyMap<string, number> {
  return new Map(Object.entries(terms));
}

function buildFingerprint(note: NoteSnapshotDto): string {
  const hash = createHash('sha1');
  hash.update(note.relativePath);
  hash.update('\n');
  hash.update(note.title ?? '');
  hash.update('\n');
  hash.update(note.tags.join(','));
  hash.update('\n');
  hash.update(note.content);
  return hash.digest('hex');
}

function buildChunkId(notePath: string, heading: string | undefined, index: number, text: string): string {
  const hash = createHash('sha1');
  hash.update(notePath);
  hash.update('|');
  hash.update(heading ?? '');
  hash.update('|');
  hash.update(String(index));
  hash.update('|');
  hash.update(text);
  return hash.digest('hex').slice(0, 16);
}

function buildChunkEmbeddingFingerprint(chunk: Pick<PersistedChunk, 'notePath' | 'title' | 'heading' | 'tags' | 'text'>): string {
  const hash = createHash('sha1');
  hash.update(chunk.notePath);
  hash.update('\n');
  hash.update(chunk.title ?? '');
  hash.update('\n');
  hash.update(chunk.heading ?? '');
  hash.update('\n');
  hash.update(chunk.tags.join(','));
  hash.update('\n');
  hash.update(chunk.text);
  return hash.digest('hex');
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

function estimateQualityWeight(note: NoteSnapshotDto, tokenCount: number): number {
  const normalizedPath = note.relativePath.replace(/\\/g, '/').toLowerCase();
  let weight = 1;

  if (/(^|\/)(test|tests|__tests__)(\/|$)/.test(normalizedPath)) {
    weight *= 0.45;
  }

  if (/(^|\/)(draft|drafts|rascunho|rascunhos|scratch|tmp)(\/|$)/.test(normalizedPath)) {
    weight *= 0.35;
  }

  if (tokenCount < 25) {
    weight *= 0.55;
  } else if (tokenCount < 50) {
    weight *= 0.8;
  }

  return weight;
}

function splitParagraphIntoSentenceWindows(paragraph: string, maxTokensPerChunk: number): string[] {
  const normalizedParagraph = paragraph.trim();
  if (!normalizedParagraph) {
    return [];
  }

  if (tokenize(normalizedParagraph).length <= maxTokensPerChunk) {
    return [normalizedParagraph];
  }

  const sentenceMatches = normalizedParagraph.match(/[^.!?\n]+(?:[.!?]+|$)/g);
  const sentences = (sentenceMatches ?? [normalizedParagraph])
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    const words = normalizedParagraph.split(/\s+/).filter(Boolean);
    const windows: string[] = [];
    for (let start = 0; start < words.length; start += maxTokensPerChunk) {
      windows.push(words.slice(start, start + maxTokensPerChunk).join(' '));
    }
    return windows;
  }

  const windows: string[] = [];
  let currentSentences: string[] = [];
  let currentTokenCount = 0;

  const flush = () => {
    const text = currentSentences.join(' ').trim();
    if (!text) {
      return;
    }

    windows.push(text);
    if (currentSentences.length > 1) {
      const overlapSentence = currentSentences[currentSentences.length - 1] ?? '';
      currentSentences = overlapSentence ? [overlapSentence] : [];
      currentTokenCount = overlapSentence ? tokenize(overlapSentence).length : 0;
      return;
    }

    currentSentences = [];
    currentTokenCount = 0;
  };

  for (const sentence of sentences) {
    const sentenceTokenCount = tokenize(sentence).length;
    if (sentenceTokenCount > maxTokensPerChunk) {
      flush();
      for (const fallbackWindow of splitParagraphIntoSentenceWindows(sentence.replace(/[.!?]+$/g, ''), maxTokensPerChunk)) {
        windows.push(fallbackWindow);
      }
      continue;
    }

    if (currentTokenCount > 0 && currentTokenCount + sentenceTokenCount > maxTokensPerChunk) {
      flush();
    }

    currentSentences.push(sentence);
    currentTokenCount += sentenceTokenCount;
  }

  flush();
  return windows;
}

function splitIntoSections(note: NoteSnapshotDto): Array<{ heading?: string; text: string }> {
  const lines = note.content.split(/\r?\n/);
  const sections: Array<{ heading?: string; text: string }> = [];
  let currentHeading = note.title;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text) {
      sections.push({ heading: currentHeading, text });
    }
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.trim().match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentHeading = String(headingMatch[1] ?? '').trim() || currentHeading;
      buffer.push(line);
      continue;
    }

    buffer.push(line);
  }

  flush();
  return sections.length > 0 ? sections : [{ heading: note.title, text: note.content.trim() }];
}

function chunkSection(
  note: NoteSnapshotDto,
  heading: string | undefined,
  sectionText: string,
  config: ChunkingConfig
): readonly PersistedChunk[] {
  const paragraphs = sectionText
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const paragraphWindows = paragraphs.flatMap((paragraph) => splitParagraphIntoSentenceWindows(paragraph, config.sentenceWindowTokens));
  const chunks: PersistedChunk[] = [];
  let currentParts: string[] = [];
  let currentTokens = 0;
  let index = 0;

  const flush = () => {
    const text = currentParts.join('\n\n').trim();
    if (!text) return;
    const tokens = tokenize([note.title ?? '', heading ?? '', note.tags.join(' '), text].join(' '));
    const terms = countTerms(tokens);
    const tokenCount = tokenize(text).length;
    chunks.push({
      chunkId: buildChunkId(note.relativePath, heading, index, text),
      notePath: note.relativePath,
      title: note.title,
      heading,
      tags: [...note.tags],
      text,
      tokenCount,
      terms: toRecord(terms)
    });
    index += 1;
    currentParts = [];
    currentTokens = 0;
  };

  for (const paragraph of paragraphWindows) {
    const paragraphTokens = tokenize(paragraph).length;
    if (currentTokens > 0 && currentTokens + paragraphTokens > config.chunkMaxTokens) {
      flush();
    }

    currentParts.push(paragraph);
    currentTokens += paragraphTokens;
  }

  flush();

  if (chunks.length === 0) {
    const tokenCount = tokenize(sectionText).length;
    return [{
      chunkId: buildChunkId(note.relativePath, heading, 0, sectionText),
      notePath: note.relativePath,
      title: note.title,
      heading,
      tags: [...note.tags],
      text: sectionText,
      tokenCount,
      terms: toRecord(countTerms(tokenize([note.title ?? '', heading ?? '', note.tags.join(' '), sectionText].join(' '))))
    }];
  }

  return chunks;
}

function buildChunksForNote(note: NoteSnapshotDto, strategy: ChunkingStrategy): readonly PersistedChunk[] {
  const sections = splitIntoSections(note);
  const config = resolveChunkingConfig(strategy);
  return sections.flatMap((section) => chunkSection(note, section.heading, section.text, config));
}

async function readPersistedIndex(indexPath: string): Promise<PersistedIndex | null> {
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw) as PersistedIndex;
    return parsed.version === 1 && parsed.notes ? parsed : null;
  } catch {
    return null;
  }
}

async function writePersistedIndex(indexPath: string, index: PersistedIndex): Promise<void> {
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

function embeddingsSatisfyProvider(chunks: readonly PersistedChunk[], provider?: EmbeddingProviderPort): boolean {
  if (!provider || provider.providerId === 'noop') {
    return true;
  }

  const providerKey = provider.cacheKey ?? provider.providerId;
  return chunks.every((chunk) => chunk.embeddingProviderKey === providerKey && Array.isArray(chunk.embedding) && chunk.embedding.length > 0);
}

export class ChunkedNoteIndexService {
  private readonly indexFolderName = '.orion';
  private readonly chunkingStrategy: ChunkingStrategy;

  constructor(
    private readonly embeddingProvider?: EmbeddingProviderPort,
    private readonly options: ChunkedNoteIndexServiceOptions = {}
  ) {
    this.chunkingStrategy = options.chunkingStrategy ?? 'section-balanced';
  }

  async build(vaultRoot: string, notes: readonly NoteSnapshotDto[]): Promise<ChunkedNoteIndex> {
    const indexPath = path.join(vaultRoot, this.indexFolderName, 'index', 'semantic-chunks.json');
    const previous = await readPersistedIndex(indexPath);
    const notesRecord: Record<string, PersistedNoteEntry> = {};
    const eligibleNotes = (this.options.excludedPaths?.length ?? 0) > 0
      ? notes.filter((note) => !matchesExcludedPath(note.relativePath, this.options.excludedPaths ?? []))
      : notes;

    for (const note of eligibleNotes) {
      const fingerprint = buildFingerprint(note);
      const previousEntry = previous?.notes[note.relativePath];
      const chunks = previousEntry?.fingerprint === fingerprint
        && previousEntry.chunkingStrategy === this.chunkingStrategy
        && embeddingsSatisfyProvider(previousEntry.chunks, this.embeddingProvider)
        ? previousEntry.chunks
        : await this.enrichChunksWithEmbeddings(note, buildChunksForNote(note, this.chunkingStrategy), previousEntry?.chunks);

      notesRecord[note.relativePath] = {
        fingerprint,
        chunkingStrategy: this.chunkingStrategy,
        chunks
      };
    }

    await writePersistedIndex(indexPath, { version: 1, notes: notesRecord });

    const indexedChunks = eligibleNotes.flatMap((note) => {
      const entry = notesRecord[note.relativePath];
      return entry.chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        notePath: chunk.notePath,
        title: chunk.title,
        heading: chunk.heading,
        tags: chunk.tags,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        terms: fromRecord(chunk.terms),
        qualityWeight: estimateQualityWeight(note, chunk.tokenCount),
        embeddingModel: chunk.embeddingModel,
        embeddingVersion: chunk.embeddingVersion,
        embeddingDimensions: chunk.embeddingDimensions,
        embedding: chunk.embedding
      } satisfies IndexedChunk));
    });

    const documentFrequencies = new Map<string, number>();
    for (const chunk of indexedChunks) {
      const seen = new Set<string>(chunk.terms.keys());
      for (const term of seen) {
        documentFrequencies.set(term, (documentFrequencies.get(term) ?? 0) + 1);
      }
    }

    return {
      vaultRoot,
      chunks: indexedChunks,
      noteFingerprints: new Map(Object.entries(notesRecord).map(([notePath, entry]) => [notePath, entry.fingerprint])),
      documentFrequencies
    };
  }

  private async enrichChunksWithEmbeddings(
    note: NoteSnapshotDto,
    chunks: readonly PersistedChunk[],
    previousChunks: readonly PersistedChunk[] = []
  ): Promise<readonly PersistedChunk[]> {
    if (!this.embeddingProvider) {
      return chunks;
    }

    const providerKey = this.embeddingProvider.cacheKey ?? this.embeddingProvider.providerId;
    const reusableChunks = new Map<string, PersistedChunk>();
    for (const previousChunk of previousChunks) {
      if (previousChunk.embeddingProviderKey !== providerKey || !Array.isArray(previousChunk.embedding) || previousChunk.embedding.length === 0) {
        continue;
      }

      const fingerprint = previousChunk.embeddingFingerprint ?? buildChunkEmbeddingFingerprint(previousChunk);
      reusableChunks.set(fingerprint, previousChunk);
    }

    const enriched: PersistedChunk[] = [];
    for (const chunk of chunks) {
      const fingerprint = buildChunkEmbeddingFingerprint(chunk);
      const reusableChunk = reusableChunks.get(fingerprint);
      if (reusableChunk) {
        enriched.push({
          ...chunk,
          embeddingModel: reusableChunk.embeddingModel,
          embeddingVersion: reusableChunk.embeddingVersion,
          embeddingDimensions: reusableChunk.embeddingDimensions,
          embedding: reusableChunk.embedding,
          embeddingFingerprint: fingerprint,
          embeddingProviderKey: providerKey
        });
        continue;
      }

      let embedding = null;
      try {
        embedding = await this.embeddingProvider.embedChunk({
          chunkId: chunk.chunkId,
          notePath: note.relativePath,
          text: chunk.text,
          title: chunk.title,
          heading: chunk.heading,
          tags: chunk.tags,
          fingerprint
        });
      } catch {
        embedding = null;
      }

      enriched.push(embedding
        ? {
            ...chunk,
            embeddingModel: embedding.model,
            embeddingVersion: embedding.version,
            embeddingDimensions: embedding.dimensions,
            embedding: [...embedding.vector],
            embeddingFingerprint: embedding.fingerprint,
            embeddingProviderKey: providerKey
          }
        : chunk);
    }

    return enriched;
  }
}
