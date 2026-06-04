import fs from 'node:fs/promises';
import path from 'node:path';
import { SemanticRetrievalService } from '../application/services/semantic-retrieval.service';
import { ChunkedNoteIndexService, type ChunkingStrategy } from '../application/services/chunked-note-index.service';
import { ExternalCommandEmbeddingProvider } from '../infra/ai/local-models/external-command-embedding.provider';
import { NoopLocalEmbeddingProvider } from '../infra/ai/local-models/noop-local-embedding.provider';
import { TokenHashEmbeddingProvider } from '../infra/ai/local-models/token-hash-embedding.provider';
import { ExpandedTokenHashEmbeddingProvider } from '../infra/ai/local-models/expanded-token-hash-embedding.provider';
import type { EmbeddingProviderPort } from '../application/ports/embedding-provider.port';
import type { NoteSnapshotDto } from '../application/dto/note-snapshot.dto';

type VaultSize = {
  readonly name: string;
  readonly domains: number;
  readonly notesPerDomain: number;
  readonly paragraphs: number;
};

type CuratedManifest = {
  readonly notes: readonly {
    readonly id: string;
    readonly relativePath: string;
    readonly tags: readonly string[];
  }[];
  readonly queries: readonly BenchmarkQuery[];
};

type BenchmarkResult = {
  readonly size: string;
  readonly providers: readonly NamedProviderResult[];
  readonly comparisonSummary: readonly ProviderComparisonSummary[];
};

type ProviderComparisonSummary = {
  readonly key: string;
  readonly providerName: string;
  readonly vsBaseline: {
    readonly bytesRatio: number;
    readonly coldIndexRatio: number;
    readonly warmIndexRatio: number;
    readonly averageQueryRatio: number;
    readonly p95QueryRatio: number;
    readonly conceptualTop1Delta: number;
    readonly hardConceptualTop1Delta: number;
    readonly conceptualTop3Delta: number;
    readonly hardConceptualTop3Delta: number;
    readonly conceptualPathTop1Delta: number;
    readonly hardConceptualPathTop1Delta: number;
  };
};

type BenchmarkProviderCase = {
  readonly key: string;
  readonly providerName: string;
  readonly createProvider: () => EmbeddingProviderPort;
  readonly chunkingStrategy?: ChunkingStrategy;
  readonly rankingWeights?: {
    readonly lexical: number;
    readonly vector: number;
    readonly structural: number;
  };
};

type EmbeddingCompositionMode = 'full' | 'body-only';

type NamedProviderResult = {
  readonly key: string;
  readonly providerName: string;
  readonly result: ProviderResult;
};

type ProviderResult = {
  readonly notes: number;
  readonly bytes: number;
  readonly chunkCount: number;
  readonly coldIndexMs: number;
  readonly warmIndexMs: number;
  readonly timings: readonly QueryTiming[];
  readonly averageQueryMs: number;
  readonly p95QueryMs: number;
  readonly warmMs: number;
  readonly hybridQueryCount: number;
  readonly contextBudget: {
    readonly averageChunks: number;
    readonly maxChunks: number;
    readonly averageCharacters: number;
    readonly maxCharacters: number;
  };
  readonly quality: readonly QueryQuality[];
  readonly qualitySummary: QualitySummary;
};

type ClosableProvider = {
  close(): void;
};

type QueryTiming = {
  readonly label: string;
  readonly ms: number;
  readonly mode: 'lexical-only' | 'hybrid';
};

type BenchmarkQuery = {
  readonly label: string;
  readonly query: string;
  readonly expectedDomain: string;
  readonly queryType: 'direct' | 'conceptual' | 'hard-conceptual' | 'cross-domain';
  readonly expectedPathPrefix?: string;
};

type QueryQuality = {
  readonly label: string;
  readonly expectedDomain: string;
  readonly queryType: 'direct' | 'conceptual' | 'hard-conceptual' | 'cross-domain';
  readonly expectedPathPrefix?: string;
  readonly topPath: string | null;
  readonly topTitle: string | null;
  readonly topScore: number | null;
  readonly chunkCount: number;
  readonly top1DomainHit: boolean;
  readonly top3DomainHit: boolean;
  readonly relevantHitsInTop3: number;
  readonly top1PathHit: boolean;
  readonly top3PathHit: boolean;
};

type QualitySummary = {
  readonly totalQueries: number;
  readonly top1Hits: number;
  readonly top3Hits: number;
  readonly relevantHitsInTop3: number;
  readonly top1PathHits: number;
  readonly top3PathHits: number;
  readonly byType: Record<'direct' | 'conceptual' | 'hard-conceptual' | 'cross-domain', {
    readonly queries: number;
    readonly top1Hits: number;
    readonly top3Hits: number;
    readonly relevantHitsInTop3: number;
    readonly top1PathHits: number;
    readonly top3PathHits: number;
  }>;
};

type MutableQualityBucket = {
  queries: number;
  top1Hits: number;
  top3Hits: number;
  relevantHitsInTop3: number;
  top1PathHits: number;
  top3PathHits: number;
};

const baseRoot = path.join(process.env.TEMP ?? process.cwd(), 'opencode', 'orion-embedding-benchmark');
const curatedFixtureRoot = path.resolve('tests', 'fixtures', 'embedding-benchmark-curated');
const externalBenchmarkCommand = String(process.env.ORION_BENCHMARK_EMBEDDINGS_COMMAND ?? '').trim();
const externalBenchmarkLabel = String(process.env.ORION_BENCHMARK_EMBEDDINGS_LABEL ?? 'external-command').trim() || 'external-command';
const localEmbedderScript = path.resolve('scripts', 'local-embedder.js');
const localEmbedderExpandedScript = path.resolve('scripts', 'local-embedder-expanded.js');
const selectedSizeNames = new Set(
  String(process.env.ORION_BENCHMARK_SIZES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const selectedProviderKeys = new Set(
  String(process.env.ORION_BENCHMARK_PROVIDERS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

const sizes: readonly VaultSize[] = [
  { name: 'small', domains: 3, notesPerDomain: 8, paragraphs: 4 },
  { name: 'medium', domains: 8, notesPerDomain: 20, paragraphs: 5 },
  { name: 'large', domains: 12, notesPerDomain: 45, paragraphs: 6 }
];

const curatedSize: VaultSize = { name: 'curated', domains: 0, notesPerDomain: 0, paragraphs: 0 };

const domainSeeds = [
  {
    slug: 'architecture',
    title: 'Clean Architecture',
    terms: ['boundaries', 'use cases', 'adapters', 'domain rules', 'application layer'],
    conceptualAliases: ['software design layers', 'separation of concerns', 'modular boundaries']
  },
  {
    slug: 'finance',
    title: 'Household Budget',
    terms: ['monthly budget', 'expenses', 'cash flow', 'fixed costs', 'variable costs'],
    conceptualAliases: ['money planning', 'spending control', 'financial overview']
  },
  {
    slug: 'health',
    title: 'Training Routine',
    terms: ['strength training', 'recovery', 'mobility', 'weekly routine', 'exercise load'],
    conceptualAliases: ['body conditioning', 'movement practice', 'physical recovery']
  },
  {
    slug: 'writing',
    title: 'Writing Workflow',
    terms: ['drafting', 'revision', 'outline', 'editing pass', 'publication checklist'],
    conceptualAliases: ['authoring flow', 'text refinement', 'publication preparation']
  },
  {
    slug: 'product',
    title: 'Product Discovery',
    terms: ['user interview', 'problem framing', 'hypothesis', 'experiment', 'feedback loop'],
    conceptualAliases: ['research loop', 'assumption testing', 'customer learning']
  },
  {
    slug: 'learning',
    title: 'Study System',
    terms: ['spaced repetition', 'active recall', 'review cadence', 'study notes', 'practice session'],
    conceptualAliases: ['memory retention', 'knowledge reinforcement', 'practice based review']
  },
  {
    slug: 'travel',
    title: 'Travel Planning',
    terms: ['itinerary', 'lodging', 'transportation', 'daily budget', 'packing list'],
    conceptualAliases: ['trip preparation', 'route planning', 'journey logistics']
  },
  {
    slug: 'garden',
    title: 'Urban Garden',
    terms: ['soil health', 'watering schedule', 'seedling tray', 'sun exposure', 'compost'],
    conceptualAliases: ['plant care', 'growing conditions', 'garden maintenance']
  },
  {
    slug: 'software',
    title: 'Testing Strategy',
    terms: ['unit tests', 'integration tests', 'test pyramid', 'coverage', 'regression suite'],
    conceptualAliases: ['quality safety net', 'verification layers', 'change confidence']
  },
  {
    slug: 'knowledge',
    title: 'Knowledge Graph',
    terms: ['backlinks', 'relations', 'graph view', 'semantic links', 'connected notes'],
    conceptualAliases: ['linked ideas', 'connected knowledge', 'note relationships']
  },
  {
    slug: 'operations',
    title: 'Local Runbook',
    terms: ['incident response', 'checklist', 'maintenance window', 'rollback', 'service diagnosis'],
    conceptualAliases: ['service recovery', 'failure handling', 'operational response']
  },
  {
    slug: 'career',
    title: 'Career Planning',
    terms: ['skill gap', 'portfolio', 'job search', 'weekly goals', 'professional growth'],
    conceptualAliases: ['professional direction', 'growth planning', 'career development']
  }
] as const;

class ComposedEmbeddingProvider implements EmbeddingProviderPort, Partial<ClosableProvider> {
  readonly providerId: string;

  constructor(
    private readonly delegate: EmbeddingProviderPort,
    private readonly mode: EmbeddingCompositionMode
  ) {
    this.providerId = `${delegate.providerId}:${mode}`;
  }

  async embedChunk(input: Parameters<EmbeddingProviderPort['embedChunk']>[0]) {
    if (this.mode === 'body-only') {
      return this.delegate.embedChunk({
        ...input,
        title: undefined,
        heading: undefined,
        tags: [],
        text: input.text
      });
    }

    return this.delegate.embedChunk(input);
  }

  async embedQuery(input: Parameters<EmbeddingProviderPort['embedQuery']>[0]) {
    return this.delegate.embedQuery(input);
  }

  close(): void {
    if (typeof (this.delegate as Partial<ClosableProvider>).close === 'function') {
      (this.delegate as unknown as ClosableProvider).close();
    }
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function createNote(domain: (typeof domainSeeds)[number], domainIndex: number, noteIndex: number, paragraphs: number) {
  const title = `${domain.title} ${domainIndex + 1}-${noteIndex + 1}`;
  const relativePath = `${domain.slug}/${pad(noteIndex + 1)}-${domain.slug}-${domainIndex + 1}.md`;
  const tags = [domain.slug, domain.terms[0].replace(/\s+/g, '-'), `topic-${domainIndex + 1}`];
  const blocks: string[] = [];

  blocks.push(`# ${title}`);
  blocks.push(`Tags: ${tags.map((tag) => `#${tag}`).join(' ')}`);

  for (let index = 0; index < paragraphs; index += 1) {
    const term = domain.terms[(noteIndex + index) % domain.terms.length];
    const extra = domain.terms[(noteIndex + index + 1) % domain.terms.length];
    blocks.push(`## Section ${index + 1}`);
    blocks.push(`${domain.title} discusses ${term} and ${extra}. This note belongs to ${domain.slug} and documents practical details, examples, tradeoffs, and maintenance guidance for ${term}. The workflow emphasizes ${domain.terms.join(', ')} in a concrete local-first context.`);
  }

  return {
    relativePath,
    title,
    tags,
    content: `${blocks.join('\n\n')}\n`
  };
}

async function buildVault(root: string, size: VaultSize): Promise<NoteSnapshotDto[]> {
  if (size.name === 'curated') {
    return buildCuratedVault(root);
  }

  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });
  const notes: NoteSnapshotDto[] = [];

  for (let domainIndex = 0; domainIndex < size.domains; domainIndex += 1) {
    const domain = domainSeeds[domainIndex % domainSeeds.length];
    for (let noteIndex = 0; noteIndex < size.notesPerDomain; noteIndex += 1) {
      const note = createNote(domain, domainIndex, noteIndex, size.paragraphs);
      const absolutePath = path.join(root, note.relativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, note.content, 'utf8');
      notes.push({
        id: `${domain.slug}-${domainIndex}-${noteIndex}`,
        absolutePath,
        relativePath: note.relativePath.replace(/\\/g, '/'),
        title: note.title,
        tags: note.tags,
        content: note.content
      });
    }
  }

  const noiseCount = Math.max(3, Math.floor(size.notesPerDomain / 3));
  for (let index = 0; index < noiseCount; index += 1) {
    const relativePath = `drafts/scratch-${index + 1}.md`;
    const absolutePath = path.join(root, relativePath);
    const content = `# scratch ${index + 1}\n\nScratch draft temporary reminder with partial words and low-value repetitions for index noise control.\n\nScratch draft temporary reminder with partial words and low-value repetitions for index noise control.\n`;
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
    notes.push({
      id: `draft-${index}`,
      absolutePath,
      relativePath,
      title: `scratch ${index + 1}`,
      tags: ['scratch'],
      content
    });
  }

  const manualNotes = [
    {
      id: 'manual-architecture',
      relativePath: 'manual/architecture-concepts.md',
      title: 'Architecture Concepts',
      tags: ['architecture', 'manual-benchmark'],
      content: '# Architecture Concepts\n\nThis note explains separation of concerns, modular boundaries, and layered software design without depending on the original product vocabulary.\n\nTeams use these ideas to isolate responsibilities, reduce coupling, and keep adapters at the edges.\n'
    },
    {
      id: 'manual-operations',
      relativePath: 'manual/operations-recovery.md',
      title: 'Operations Recovery',
      tags: ['operations', 'manual-benchmark'],
      content: '# Operations Recovery\n\nThis note focuses on service recovery, failure handling, staged rollback, and operational response during incidents.\n\nThe emphasis is restoring service safely after disruption instead of following only literal runbook wording.\n'
    },
    {
      id: 'manual-knowledge',
      relativePath: 'manual/knowledge-relationships.md',
      title: 'Knowledge Relationships',
      tags: ['knowledge', 'manual-benchmark'],
      content: '# Knowledge Relationships\n\nThis note describes linked ideas, connected knowledge, and note relationships across a knowledge graph.\n\nThe goal is to surface semantic connections even when exact backlink vocabulary does not appear first.\n'
    },
    {
      id: 'manual-learning',
      relativePath: 'manual/learning-retention.md',
      title: 'Learning Retention',
      tags: ['learning', 'manual-benchmark'],
      content: '# Learning Retention\n\nThis note frames memory retention, knowledge reinforcement, and practice-based review as the core of sustained learning.\n\nThe wording intentionally avoids relying only on the usual flashcard phrasing.\n'
    },
    {
      id: 'manual-product',
      relativePath: 'manual/product-research.md',
      title: 'Product Research',
      tags: ['product', 'manual-benchmark'],
      content: '# Product Research\n\nThis note captures customer learning, assumption testing, and research loops for product discovery.\n\nIt connects interviews, feedback, and experiments under a more conceptual framing.\n'
    },
    {
      id: 'manual-garden',
      relativePath: 'manual/garden-conditions.md',
      title: 'Garden Conditions',
      tags: ['garden', 'manual-benchmark'],
      content: '# Garden Conditions\n\nThis note explains plant care, growing conditions, watering rhythm, and sunlight balance for an urban garden.\n\nIt groups the topic around conditions for healthy growth instead of just a checklist of tasks.\n'
    },
    {
      id: 'manual-architecture-hard',
      relativePath: 'manual/architecture-runtime-guidance.md',
      title: 'Architecture Runtime Guidance',
      tags: ['architecture', 'manual-benchmark', 'hard-conceptual'],
      content: '# Architecture Runtime Guidance\n\nThis note focuses on use cases, adapters at the edges, replaceable infrastructure, and domain rules kept isolated from delivery details.\n\nThe goal is to preserve clear application flow without coupling business rules to outer tools.\n'
    },
    {
      id: 'manual-operations-hard',
      relativePath: 'manual/operations-incident-playbook.md',
      title: 'Operations Incident Playbook',
      tags: ['operations', 'manual-benchmark', 'hard-conceptual'],
      content: '# Operations Incident Playbook\n\nThis note covers incident response, rollback decisions, maintenance windows, and concrete runbook steps for restoring a local service safely.\n\nThe emphasis stays on operational response under pressure instead of abstract recovery language.\n'
    }
  ] as const;

  for (const note of manualNotes) {
    const absolutePath = path.join(root, note.relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, note.content, 'utf8');
    notes.push({
      id: note.id,
      absolutePath,
      relativePath: note.relativePath,
      title: note.title,
      tags: note.tags,
      content: note.content
    });
  }

  return notes;
}

function inferTitleFromMarkdown(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return String(match?.[1] ?? fallback).trim();
}

async function readCuratedManifest(): Promise<CuratedManifest> {
  const manifestPath = path.join(curatedFixtureRoot, 'manifest.json');
  return JSON.parse(await fs.readFile(manifestPath, 'utf8')) as CuratedManifest;
}

async function buildCuratedVault(root: string): Promise<NoteSnapshotDto[]> {
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });
  const manifest = await readCuratedManifest();
  const notes: NoteSnapshotDto[] = [];

  for (const note of manifest.notes) {
    const sourcePath = path.join(curatedFixtureRoot, note.relativePath);
    const absolutePath = path.join(root, note.relativePath);
    const content = await fs.readFile(sourcePath, 'utf8');
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
    notes.push({
      id: note.id,
      absolutePath,
      relativePath: note.relativePath.replace(/\\/g, '/'),
      title: inferTitleFromMarkdown(content, path.basename(note.relativePath, path.extname(note.relativePath))),
      tags: [...note.tags],
      content
    });
  }

  return notes;
}

async function readIndexStats(vaultRoot: string): Promise<{ bytes: number; chunkCount: number }> {
  const indexPath = path.join(vaultRoot, '.orion', 'index', 'semantic-chunks.json');
  const stats = await fs.stat(indexPath);
  const parsed = JSON.parse(await fs.readFile(indexPath, 'utf8')) as {
    notes: Record<string, { chunks: readonly unknown[] }>;
  };
  const chunkCount = Object.values(parsed.notes).reduce((sum, entry) => sum + entry.chunks.length, 0);
  return { bytes: stats.size, chunkCount };
}

function inferDomainFromPath(relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }

  const normalized = relativePath.replace(/\\/g, '/').trim();
  if (normalized.startsWith('manual/')) {
    const manualName = normalized.slice('manual/'.length).split('/')[0] ?? '';
    for (const seed of domainSeeds) {
      if (manualName.startsWith(`${seed.slug}-`)) {
        return seed.slug;
      }
    }
  }
  const domain = normalized.split('/')[0]?.trim();
  return domain || null;
}

function evaluateQueryQuality(
  query: BenchmarkQuery,
  chunks: readonly { path: string; title?: string; score: number }[]
): QueryQuality {
  const topChunks = chunks.slice(0, 3);
  const top1Domain = inferDomainFromPath(chunks[0]?.path ?? null);
  const relevantHitsInTop3 = topChunks.filter((chunk) => inferDomainFromPath(chunk.path) === query.expectedDomain).length;
  const expectedPathPrefix = query.expectedPathPrefix;
  const top1PathHit = expectedPathPrefix
    ? String(chunks[0]?.path ?? '').startsWith(expectedPathPrefix)
    : false;
  const top3PathHit = expectedPathPrefix
    ? topChunks.some((chunk) => chunk.path.startsWith(expectedPathPrefix))
    : false;

  return {
    label: query.label,
    expectedDomain: query.expectedDomain,
    queryType: query.queryType,
    expectedPathPrefix,
    topPath: chunks[0]?.path ?? null,
    topTitle: chunks[0]?.title ?? null,
    topScore: chunks[0]?.score ?? null,
    chunkCount: chunks.length,
    top1DomainHit: top1Domain === query.expectedDomain,
    top3DomainHit: relevantHitsInTop3 > 0,
    relevantHitsInTop3,
    top1PathHit,
    top3PathHit
  };
}

function summarizeQuality(quality: readonly QueryQuality[]): QualitySummary {
  const createBucket = (): MutableQualityBucket => ({
    queries: 0,
    top1Hits: 0,
    top3Hits: 0,
    relevantHitsInTop3: 0,
    top1PathHits: 0,
    top3PathHits: 0
  });

  const byType: Record<'direct' | 'conceptual' | 'hard-conceptual' | 'cross-domain', MutableQualityBucket> = {
    direct: createBucket(),
    conceptual: createBucket(),
    'hard-conceptual': createBucket(),
    'cross-domain': createBucket()
  };

  let top1Hits = 0;
  let top3Hits = 0;
  let relevantHitsInTop3 = 0;
  let top1PathHits = 0;
  let top3PathHits = 0;

  for (const item of quality) {
    const bucket = byType[item.queryType];
    bucket.queries += 1;
    if (item.top1DomainHit) {
      bucket.top1Hits += 1;
      top1Hits += 1;
    }
    if (item.top3DomainHit) {
      bucket.top3Hits += 1;
      top3Hits += 1;
    }
    bucket.relevantHitsInTop3 += item.relevantHitsInTop3;
    relevantHitsInTop3 += item.relevantHitsInTop3;
    if (item.top1PathHit) {
      bucket.top1PathHits += 1;
      top1PathHits += 1;
    }
    if (item.top3PathHit) {
      bucket.top3PathHits += 1;
      top3PathHits += 1;
    }
  }

  return {
    totalQueries: quality.length,
    top1Hits,
    top3Hits,
    relevantHitsInTop3,
    top1PathHits,
    top3PathHits,
    byType
  };
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function safeRatio(value: number, baseline: number): number {
  if (baseline <= 0) {
    return value <= 0 ? 1 : Number.POSITIVE_INFINITY;
  }

  return value / baseline;
}

function getBucket(summary: QualitySummary, key: 'conceptual' | 'hard-conceptual') {
  return summary.byType[key];
}

function buildComparisonSummary(providers: readonly NamedProviderResult[]): readonly ProviderComparisonSummary[] {
  const baseline = providers.find((provider) => provider.key === 'noop') ?? providers[0];
  if (!baseline) {
    return [];
  }

  const baselineConceptual = getBucket(baseline.result.qualitySummary, 'conceptual');
  const baselineHardConceptual = getBucket(baseline.result.qualitySummary, 'hard-conceptual');

  return providers.map((provider) => {
    const conceptual = getBucket(provider.result.qualitySummary, 'conceptual');
    const hardConceptual = getBucket(provider.result.qualitySummary, 'hard-conceptual');

    return {
      key: provider.key,
      providerName: provider.providerName,
      vsBaseline: {
        bytesRatio: safeRatio(provider.result.bytes, baseline.result.bytes),
        coldIndexRatio: safeRatio(provider.result.coldIndexMs, baseline.result.coldIndexMs),
        warmIndexRatio: safeRatio(provider.result.warmIndexMs, baseline.result.warmIndexMs),
        averageQueryRatio: safeRatio(provider.result.averageQueryMs, baseline.result.averageQueryMs),
        p95QueryRatio: safeRatio(provider.result.p95QueryMs, baseline.result.p95QueryMs),
        conceptualTop1Delta: conceptual.top1Hits - baselineConceptual.top1Hits,
        hardConceptualTop1Delta: hardConceptual.top1Hits - baselineHardConceptual.top1Hits,
        conceptualTop3Delta: conceptual.top3Hits - baselineConceptual.top3Hits,
        hardConceptualTop3Delta: hardConceptual.top3Hits - baselineHardConceptual.top3Hits,
        conceptualPathTop1Delta: conceptual.top1PathHits - baselineConceptual.top1PathHits,
        hardConceptualPathTop1Delta: hardConceptual.top1PathHits - baselineHardConceptual.top1PathHits
      }
    };
  });
}

function createBenchmarkProviders(): readonly BenchmarkProviderCase[] {
  const providers: BenchmarkProviderCase[] = [
    {
      key: 'noop',
      providerName: 'noop',
      createProvider: () => new NoopLocalEmbeddingProvider()
    },
    {
      key: 'noop-sentence-tight',
      providerName: 'noop',
      createProvider: () => new NoopLocalEmbeddingProvider(),
      chunkingStrategy: 'sentence-tight'
    },
    {
      key: 'token-hash',
      providerName: 'token-hash',
      createProvider: () => new TokenHashEmbeddingProvider()
    },
    {
      key: 'token-hash-sentence-tight',
      providerName: 'token-hash',
      createProvider: () => new TokenHashEmbeddingProvider(),
      chunkingStrategy: 'sentence-tight'
    },
    {
      key: 'token-hash-vector-heavy',
      providerName: 'token-hash',
      createProvider: () => new TokenHashEmbeddingProvider(),
      rankingWeights: { lexical: 0.30, vector: 0.60, structural: 0.10 }
    },
    {
      key: 'token-hash-body-only',
      providerName: 'token-hash',
      createProvider: () => new ComposedEmbeddingProvider(new TokenHashEmbeddingProvider(), 'body-only')
    },
    {
      key: 'expanded-token-hash',
      providerName: 'expanded-token-hash',
      createProvider: () => new ExpandedTokenHashEmbeddingProvider()
    },
    {
      key: 'expanded-token-hash-vector-heavy',
      providerName: 'expanded-token-hash',
      createProvider: () => new ExpandedTokenHashEmbeddingProvider(),
      rankingWeights: { lexical: 0.30, vector: 0.60, structural: 0.10 }
    },
    {
      key: 'expanded-token-hash-body-only',
      providerName: 'expanded-token-hash',
      createProvider: () => new ComposedEmbeddingProvider(new ExpandedTokenHashEmbeddingProvider(), 'body-only')
    },
    {
      key: 'local-embedder-persistent',
      providerName: 'external-command',
      createProvider: () => new ExternalCommandEmbeddingProvider(`"${process.execPath}" "${localEmbedderScript}" --stdio-server`)
    },
    {
      key: 'local-embedder-persistent-body-only',
      providerName: 'external-command',
      createProvider: () => new ComposedEmbeddingProvider(new ExternalCommandEmbeddingProvider(`"${process.execPath}" "${localEmbedderScript}" --stdio-server`), 'body-only')
    },
    {
      key: 'local-embedder-expanded-persistent',
      providerName: 'external-command',
      createProvider: () => new ExternalCommandEmbeddingProvider(`"${process.execPath}" "${localEmbedderExpandedScript}" --stdio-server`)
    },
    {
      key: 'local-embedder-expanded-persistent-body-only',
      providerName: 'external-command',
      createProvider: () => new ComposedEmbeddingProvider(new ExternalCommandEmbeddingProvider(`"${process.execPath}" "${localEmbedderExpandedScript}" --stdio-server`), 'body-only')
    }
  ];

  if (externalBenchmarkCommand) {
    providers.push({
      key: externalBenchmarkLabel,
      providerName: 'external-command',
      createProvider: () => new ExternalCommandEmbeddingProvider(externalBenchmarkCommand)
    });
    providers.push({
      key: `${externalBenchmarkLabel}-body-only`,
      providerName: 'external-command',
      createProvider: () => new ComposedEmbeddingProvider(new ExternalCommandEmbeddingProvider(externalBenchmarkCommand), 'body-only')
    });
  }

  return selectedProviderKeys.size > 0
    ? providers.filter((provider) => selectedProviderKeys.has(provider.key) || selectedProviderKeys.has(provider.providerName))
    : providers;
}

async function runCase(size: VaultSize, providerCase: BenchmarkProviderCase): Promise<ProviderResult> {
  const vaultRoot = path.join(baseRoot, `${size.name}-${providerCase.key}`);
  const notes = await buildVault(vaultRoot, size);
  const provider = providerCase.createProvider();
  const indexService = new ChunkedNoteIndexService(provider, {
    chunkingStrategy: providerCase.chunkingStrategy
  });
  const service = new SemanticRetrievalService(indexService, provider);
  const queries: readonly BenchmarkQuery[] = size.name === 'curated'
    ? (await readCuratedManifest()).queries
    : [
    { label: 'direct-architecture', query: 'clean architecture boundaries adapters', expectedDomain: 'architecture', queryType: 'direct' },
    { label: 'conceptual-architecture', query: 'separation of concerns modular boundaries', expectedDomain: 'architecture', queryType: 'conceptual', expectedPathPrefix: 'manual/architecture-concepts' },
    { label: 'hard-architecture-alias', query: 'software design layers', expectedDomain: 'architecture', queryType: 'hard-conceptual', expectedPathPrefix: 'manual/architecture-runtime-guidance' },
    { label: 'ops-runbook', query: 'service recovery failure handling', expectedDomain: 'operations', queryType: 'conceptual', expectedPathPrefix: 'manual/operations-recovery' },
    { label: 'hard-ops-alias', query: 'support diagnosis during outage', expectedDomain: 'operations', queryType: 'hard-conceptual', expectedPathPrefix: 'manual/operations-incident-playbook' },
    { label: 'knowledge-links', query: 'linked ideas note relationships', expectedDomain: 'knowledge', queryType: 'conceptual', expectedPathPrefix: 'manual/knowledge-relationships' },
    { label: 'learning-memory', query: 'memory retention knowledge reinforcement', expectedDomain: 'learning', queryType: 'conceptual', expectedPathPrefix: 'manual/learning-retention' },
    { label: 'cross-product-research', query: 'customer learning assumption testing', expectedDomain: 'product', queryType: 'cross-domain', expectedPathPrefix: 'manual/product-research' },
    { label: 'cross-garden-routine', query: 'plant care growing conditions', expectedDomain: 'garden', queryType: 'cross-domain', expectedPathPrefix: 'manual/garden-conditions' }
  ] as const;
  const timings: QueryTiming[] = [];
  const quality: QueryQuality[] = [];
  const deliveredChunks: number[] = [];
  const deliveredCharacters: number[] = [];

  try {
    const coldIndexStart = process.hrtime.bigint();
    await indexService.build(vaultRoot, notes);
    const coldIndexMs = Number(process.hrtime.bigint() - coldIndexStart) / 1e6;

    for (const item of queries) {
      const startedAt = process.hrtime.bigint();
      const result = await service.retrieve(notes, {
        vaultRoot,
        query: item.query,
        maxChunks: 6,
        maxCharacters: 4000,
        rankingWeights: providerCase.rankingWeights
      });
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const mode = result.chunks.some((chunk) => chunk.rankingMode === 'hybrid') ? 'hybrid' : 'lexical-only';
      timings.push({ label: item.label, ms: elapsedMs, mode });
      quality.push(evaluateQueryQuality(item, result.chunks));
      deliveredChunks.push(result.chunks.length);
      deliveredCharacters.push(result.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0));
    }

    const warmIndexStart = process.hrtime.bigint();
    await indexService.build(vaultRoot, notes);
    const warmIndexMs = Number(process.hrtime.bigint() - warmIndexStart) / 1e6;

    const warmStart = process.hrtime.bigint();
    await service.retrieve(notes, {
      vaultRoot,
      query: size.name === 'curated' ? 'use cases adapters domain rules' : 'clean architecture boundaries adapters',
      maxChunks: 6,
      maxCharacters: 4000,
      rankingWeights: providerCase.rankingWeights
    });
    const warmMs = Number(process.hrtime.bigint() - warmStart) / 1e6;
    const indexStats = await readIndexStats(vaultRoot);

    return {
      notes: notes.length,
      bytes: indexStats.bytes,
      chunkCount: indexStats.chunkCount,
      coldIndexMs,
      warmIndexMs,
      timings,
      averageQueryMs: average(timings.map((item) => item.ms)),
      p95QueryMs: percentile(timings.map((item) => item.ms), 0.95),
      warmMs,
      hybridQueryCount: timings.filter((item) => item.mode === 'hybrid').length,
      contextBudget: {
        averageChunks: average(deliveredChunks),
        maxChunks: deliveredChunks.length > 0 ? Math.max(...deliveredChunks) : 0,
        averageCharacters: average(deliveredCharacters),
        maxCharacters: deliveredCharacters.length > 0 ? Math.max(...deliveredCharacters) : 0
      },
      quality,
      qualitySummary: summarizeQuality(quality)
    };
  } finally {
    if (typeof (provider as Partial<ClosableProvider>).close === 'function') {
      (provider as unknown as ClosableProvider).close();
    }
  }
}

async function main(): Promise<void> {
  const results: BenchmarkResult[] = [];
  const allSizes = [...sizes, curatedSize];
  const selectedSizes = selectedSizeNames.size > 0
    ? allSizes.filter((size) => selectedSizeNames.has(size.name))
    : allSizes;
  const providerCases = createBenchmarkProviders();
  for (const size of selectedSizes) {
    const providers: NamedProviderResult[] = [];
    for (const providerCase of providerCases) {
      providers.push({
        key: providerCase.key,
        providerName: providerCase.providerName,
        result: await runCase(size, providerCase)
      });
    }

    results.push({
      size: size.name,
      providers,
      comparisonSummary: buildComparisonSummary(providers)
    });
  }

  await fs.mkdir(baseRoot, { recursive: true });
  await fs.writeFile(path.join(baseRoot, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log(JSON.stringify(results, null, 2));
}

void main();
