import path from 'node:path';
import type { NoteSnapshotDto } from '../dto/note-snapshot.dto';
import type {
  GlobalGraphDto,
  GraphEdgeDto,
  GraphNodeDto,
  LinkPreviewDto,
  LinkSuggestionDto,
  NoteLinkMatchDto,
  RelationIntensity,
  RelationSignalsDto,
  RelatedNoteDto,
  RelatedNoteResponseDto
} from '../dto/semantic-note-relations.dto';

type ParsedLink = {
  readonly raw: string;
  readonly label: string;
  readonly kind: 'wiki' | 'markdown';
  readonly target: string;
};

type ParsedNote = {
  readonly note: NoteSnapshotDto;
  readonly title: string;
  readonly titleTokens: readonly string[];
  readonly headingTokens: readonly string[];
  readonly bodyTokens: readonly string[];
  readonly tagTokens: readonly string[];
  readonly pathTokens: readonly string[];
  readonly folderTokens: readonly string[];
  readonly links: readonly ParsedLink[];
  readonly bodyWithoutFrontmatter: string;
  readonly headings: readonly string[];
  readonly fingerprint: string;
  readonly identifiers: readonly string[];
  readonly termCounts: ReadonlyMap<string, number>;
  readonly uniqueTerms: ReadonlySet<string>;
  readonly folderPath: string;
};

type IndexedNote = ParsedNote & {
  readonly vector: ReadonlyMap<string, number>;
};

type VaultIndex = {
  readonly notes: readonly IndexedNote[];
  readonly byPath: Map<string, IndexedNote>;
  readonly identifiers: Map<string, string[]>;
  readonly incomingLinks: Map<string, Set<string>>;
  readonly outgoingLinks: Map<string, Set<string>>;
  readonly idf: ReadonlyMap<string, number>;
  readonly vocabularySize: number;
  readonly noteCount: number;
};

type CacheEntry = {
  noteFingerprints: Map<string, string>;
  parsedNotes: Map<string, ParsedNote>;
};

const INTENSITY_THRESHOLDS = [
  { intensity: 'strong' as const, min: 0.75 },
  { intensity: 'medium' as const, min: 0.55 },
  { intensity: 'weak' as const, min: 0.35 },
  { intensity: 'hidden' as const, min: 0 }
];

const RELATION_WEIGHTS = {
  tfidf: 0.55,
  tags: 0.15,
  titleHeadings: 0.1,
  links: 0.1,
  folder: 0.1
} as const;

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function stripMarkdownFormatting(value: string): string {
  return value
    .replace(/[`*_>~[]#!|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(stripMarkdownFormatting(value))
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseFrontmatter(content: string): { fields: Record<string, string>; body: string } {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { fields: {}, body: content };
  }

  const fields: Record<string, string> = {};
  let index = 1;

  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === '---') {
      index += 1;
      break;
    }

    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (match) {
      const key = String(match[1] ?? '').toLowerCase();
      const value = String(match[2] ?? '').trim().replace(/^['"`]|['"`]$/g, '');
      fields[key] = value;
    }
  }

  return { fields, body: lines.slice(index).join('\n') };
}

function extractHeadings(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^#{1,6}\s+/.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/, '').trim())
    .filter(Boolean);
}

function normalizeTag(value: string): string {
  return normalizeText(value).replace(/^#/, '').trim();
}

function extractTags(content: string): string[] {
  const { fields, body } = parseFrontmatter(content);
  const tags = new Set<string>();
  const frontmatterTags = fields.tags ?? '';

  for (const raw of frontmatterTags.split(/[[,\]]/g)) {
    const tag = normalizeTag(raw);
    if (tag) tags.add(tag);
  }

  for (const line of body.split(/\r?\n/)) {
    const matches = line.matchAll(/(^|\s)#([A-Za-z0-9][A-Za-z0-9_-]*)/g);
    for (const match of matches) {
      const tag = normalizeTag(String(match[2] ?? ''));
      if (tag) tags.add(tag);
    }
  }

  return [...tags];
}

function extractSummary(body: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => Boolean(line) && !line.startsWith('# '))
    ?.slice(0, 140) ?? '';
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function folderPathOf(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  const folder = path.posix.dirname(normalized);
  return folder === '.' ? '' : folder;
}

function basenameNoExt(relativePath: string): string {
  return path.posix.basename(normalizeRelativePath(relativePath), path.posix.extname(relativePath));
}

function buildIdentifiers(note: NoteSnapshotDto, title: string): string[] {
  return unique([
    normalizeText(normalizeRelativePath(note.relativePath)),
    normalizeText(basenameNoExt(note.relativePath)),
    normalizeText(title),
    normalizeText(path.posix.join(folderPathOf(note.relativePath), basenameNoExt(note.relativePath))),
    normalizeText(path.posix.basename(folderPathOf(note.relativePath) || ''))
  ]);
}

function extractBodyForIndex(content: string): { body: string; headings: string[]; tags: string[] } {
  const { fields, body } = parseFrontmatter(content);
  const headings = extractHeadings(body);
  const tags = extractTags(content);
  void fields;
  return { body, headings, tags };
}

function parseLinks(content: string): ParsedLink[] {
  const links: ParsedLink[] = [];

  for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const raw = String(match[0] ?? '');
    const target = String(match[1] ?? '').split('|')[0]?.split('#')[0]?.trim() ?? '';
    const label = String(match[1] ?? '').split('|')[1]?.trim() || target;
    if (target) links.push({ raw, label, kind: 'wiki', target });
  }

  for (const match of content.matchAll(/!?(\[([^\]]*)\]\(([^)]+)\))/g)) {
    const raw = String(match[1] ?? '');
    if (raw.startsWith('![')) continue;
    const label = String(match[2] ?? '').trim();
    const target = String(match[3] ?? '').split('#')[0]?.split('?')[0]?.trim() ?? '';
    if (!target || /^https?:\/\//i.test(target) || /^mailto:/i.test(target)) continue;
    links.push({ raw, label: label || target, kind: 'markdown', target });
  }

  return links;
}

function resolveLinkTarget(sourcePath: string, link: ParsedLink, identifiers: Map<string, string[]>): string[] {
  const normalizedTarget = normalizeText(link.target);
  const candidates = new Set<string>();

  const targetPath = link.kind === 'markdown' && !link.target.startsWith('/')
    ? normalizeRelativePath(path.posix.normalize(path.posix.join(folderPathOf(sourcePath), link.target)))
    : normalizeRelativePath(link.target);

  const targetNoExt = normalizeText(targetPath.replace(/\.(md|markdown)$/i, ''));
  const targetBase = normalizeText(path.posix.basename(targetPath, path.posix.extname(targetPath)));

  for (const [identifier, paths] of identifiers.entries()) {
    if (identifier === normalizedTarget || identifier === targetNoExt || identifier === targetBase || identifier === normalizeText(targetPath)) {
      for (const candidate of paths) candidates.add(candidate);
    }
  }

  return [...candidates];
}

function termCounts(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function weightedTokens(note: NoteSnapshotDto, title: string, body: string, headings: readonly string[], tags: readonly string[]): string[] {
  const tokens: string[] = [];
  const titleTokens = tokenize(title || note.title || basenameNoExt(note.relativePath));
  const headingTokens = headings.flatMap((heading) => tokenize(heading));
  const bodyTokens = tokenize(body);
  const tagTokens = tags.map((tag) => normalizeTag(tag)).filter(Boolean);
  const pathTokens = tokenize(normalizeRelativePath(note.relativePath).replace(/\.(md|markdown)$/i, ' '));
  const folderTokens = tokenize(folderPathOf(note.relativePath));

  for (let i = 0; i < 3; i += 1) tokens.push(...titleTokens);
  for (let i = 0; i < 2; i += 1) tokens.push(...headingTokens);
  tokens.push(...bodyTokens);
  for (let i = 0; i < 2; i += 1) tokens.push(...tagTokens);
  tokens.push(...pathTokens, ...folderTokens);
  return tokens.filter(Boolean);
}

function cosineSimilarity(left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const value of left.values()) leftMagnitude += value * value;
  for (const value of right.values()) rightMagnitude += value * value;

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;

  const smaller = left.size <= right.size ? left : right;
  const larger = smaller === left ? right : left;

  for (const [term, leftValue] of smaller.entries()) {
    const rightValue = larger.get(term);
    if (rightValue) dot += leftValue * rightValue;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function overlapScore(left: readonly string[], right: readonly string[]): number {
  const leftSet = new Set(left.map((value) => normalizeText(value)).filter(Boolean));
  const rightSet = new Set(right.map((value) => normalizeText(value)).filter(Boolean));
  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  let common = 0;
  for (const item of leftSet) {
    if (rightSet.has(item)) common += 1;
  }

  return (2 * common) / (leftSet.size + rightSet.size);
}

function commonFolderScore(leftPath: string, rightPath: string): number {
  const leftParts = folderPathOf(leftPath).split('/').filter(Boolean);
  const rightParts = folderPathOf(rightPath).split('/').filter(Boolean);
  if (leftParts.length === 0 && rightParts.length === 0) return 1;

  let common = 0;
  while (common < leftParts.length && common < rightParts.length && leftParts[common] === rightParts[common]) {
    common += 1;
  }

  const total = Math.max(leftParts.length, rightParts.length, 1);
  return common / total;
}

function intensityForScore(score: number): RelationIntensity {
  for (const entry of INTENSITY_THRESHOLDS) {
    if (score >= entry.min) return entry.intensity;
  }
  return 'hidden';
}

function formatScore(score: number): number {
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

function extractReasons(signals: RelationSignalsDto, source: ParsedNote, target: ParsedNote, manual: boolean): string[] {
  const reasons: string[] = [];

  if (signals.tfidf >= 0.45) reasons.push('Vocabulário semelhante');
  if (signals.tags >= 0.35) reasons.push('Tags em comum');
  if (signals.titleHeadings >= 0.35) reasons.push('Título ou headings próximos');
  if (signals.links >= 0.35) reasons.push(manual ? 'Link manual presente' : 'Backlink relevante');
  if (signals.folder >= 0.35) reasons.push('Pasta próxima');

  if (reasons.length === 0) {
    reasons.push(`Relação calculada entre ${source.title} e ${target.title}`);
  }

  return reasons;
}

function buildSignals(source: IndexedNote, target: IndexedNote, incomingLinks: Map<string, Set<string>>, outgoingLinks: Map<string, Set<string>>): RelationSignalsDto {
  const manualOutgoing = outgoingLinks.get(source.note.relativePath)?.has(target.note.relativePath) ?? false;
  const manualIncoming = incomingLinks.get(source.note.relativePath)?.has(target.note.relativePath) ?? false;
  const linkScore = manualOutgoing || manualIncoming ? (manualOutgoing && manualIncoming ? 1 : manualOutgoing ? 0.85 : 0.65) : 0;

  return {
    tfidf: formatScore(cosineSimilarity(source.vector, target.vector)),
    tags: formatScore(overlapScore(source.tagTokens, target.tagTokens)),
    titleHeadings: formatScore(overlapScore([...source.titleTokens, ...source.headingTokens], [...target.titleTokens, ...target.headingTokens])),
    links: formatScore(linkScore),
    folder: formatScore(commonFolderScore(source.note.relativePath, target.note.relativePath))
  };
}

function combineSignals(signals: RelationSignalsDto): number {
  return formatScore(
    (signals.tfidf * RELATION_WEIGHTS.tfidf) +
    (signals.tags * RELATION_WEIGHTS.tags) +
    (signals.titleHeadings * RELATION_WEIGHTS.titleHeadings) +
    (signals.links * RELATION_WEIGHTS.links) +
    (signals.folder * RELATION_WEIGHTS.folder)
  );
}

function snippetForEvidence(text: string, terms: readonly string[]): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '';

  for (const term of terms) {
    const index = normalizeText(compact).indexOf(normalizeText(term));
    if (index >= 0) {
      const start = Math.max(0, index - 56);
      const end = Math.min(compact.length, index + term.length + 56);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < compact.length ? '...' : '';
      return `${prefix}${compact.slice(start, end)}${suffix}`;
    }
  }

  return compact.slice(0, 150);
}

function buildSectionChunks(note: IndexedNote): Array<{ chunkId: string; heading?: string; text: string }> {
  const lines = note.note.content.split(/\r?\n/);
  const chunks: Array<{ chunkId: string; heading?: string; text: string }> = [];
  let currentHeading = note.title;
  let buffer: string[] = [];
  let index = 0;

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (!text) return;
    chunks.push({
      chunkId: `${note.note.relativePath}#${index}`,
      heading: currentHeading,
      text
    });
    index += 1;
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
  return chunks;
}

function buildEvidenceChunks(source: IndexedNote, target: IndexedNote): NonNullable<RelatedNoteDto['evidenceChunks']> {
  const queryTerms = unique([
    ...source.titleTokens,
    ...source.headingTokens,
    ...source.tagTokens
  ]).filter((term) => term.length >= 3);

  if (queryTerms.length === 0) {
    return [];
  }

  return buildSectionChunks(target)
    .map((chunk) => {
      let score = 0;
      const matchedTerms: string[] = [];
      const normalizedHeading = normalizeText(chunk.heading ?? '');
      const normalizedText = normalizeText(chunk.text);

      for (const term of queryTerms) {
        let count = 0;
        if (normalizedText.includes(term)) {
          count += 1;
        }
        if (count > 0) {
          matchedTerms.push(term);
          score += count;
          if (normalizedHeading.includes(term)) {
            score += 1.4;
          }
        }
      }

      return {
        chunkId: chunk.chunkId,
        heading: chunk.heading,
        snippet: snippetForEvidence(chunk.text, matchedTerms),
        score: Number(score.toFixed(3)),
        matchedTerms: unique(matchedTerms)
      };
    })
    .filter((chunk) => chunk.score > 0 && chunk.matchedTerms.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);
}

function buildDiff(before: string, after: string): { before: string[]; after: string[] } {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  return { before: beforeLines, after: afterLines };
}

function findNoteByPath(notes: readonly NoteSnapshotDto[], pathValue: string): NoteSnapshotDto | undefined {
  const normalized = normalizeRelativePath(pathValue);
  return notes.find((note) => normalizeRelativePath(note.relativePath) === normalized);
}

function buildDisplayTitle(note: NoteSnapshotDto): string {
  return note.title?.trim() || basenameNoExt(note.relativePath);
}

function buildParsedNote(note: NoteSnapshotDto): ParsedNote {
  const fingerprint = `${note.relativePath}::${note.content}`;
  const title = buildDisplayTitle(note);
  const { body, headings, tags } = extractBodyForIndex(note.content);
  const titleTokens = tokenize(title);
  const headingTokens = headings.flatMap((heading) => tokenize(heading));
  const bodyTokens = tokenize(body);
  const tagTokens = tags.map((tag) => normalizeTag(tag)).filter(Boolean);
  const pathTokens = tokenize(normalizeRelativePath(note.relativePath).replace(/\.(md|markdown)$/i, ' '));
  const folderTokens = tokenize(folderPathOf(note.relativePath));
  const links = parseLinks(note.content);
  const weighted = weightedTokens(note, title, body, headings, tags);

  return {
    note,
    title,
    titleTokens,
    headingTokens,
    bodyTokens,
    tagTokens,
    pathTokens,
    folderTokens,
    links,
    bodyWithoutFrontmatter: body,
    headings,
    fingerprint,
    identifiers: buildIdentifiers(note, title),
    termCounts: termCounts(weighted),
    uniqueTerms: new Set(weighted),
    folderPath: folderPathOf(note.relativePath)
  };
}

function buildIdf(parsedNotes: readonly ParsedNote[]): ReadonlyMap<string, number> {
  const documentFrequency = new Map<string, number>();
  for (const note of parsedNotes) {
    for (const term of note.uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  const total = Math.max(1, parsedNotes.length);
  for (const [term, count] of documentFrequency.entries()) {
    idf.set(term, Math.log((total + 1) / (count + 1)) + 1);
  }

  return idf;
}

function vectorize(note: ParsedNote, idf: ReadonlyMap<string, number>): ReadonlyMap<string, number> {
  const vector = new Map<string, number>();
  const totalTerms = [...note.termCounts.values()].reduce((sum, count) => sum + count, 0) || 1;
  for (const [term, count] of note.termCounts.entries()) {
    const weight = (count / totalTerms) * (idf.get(term) ?? 0);
    if (weight > 0) vector.set(term, weight);
  }
  return vector;
}

function buildIndex(notes: readonly NoteSnapshotDto[], cache?: CacheEntry): VaultIndex {
  const cacheEntry = cache ?? { noteFingerprints: new Map<string, string>(), parsedNotes: new Map<string, ParsedNote>() };
  const nextParsed = new Map<string, ParsedNote>();

  for (const note of notes) {
    const fingerprint = `${note.relativePath}::${note.content}`;
    const cached = cacheEntry.parsedNotes.get(note.relativePath);
    if (cached && cached.fingerprint === fingerprint) {
      nextParsed.set(note.relativePath, cached);
      continue;
    }
    nextParsed.set(note.relativePath, buildParsedNote(note));
  }

  const parsedNotes = [...nextParsed.values()];
  const idf = buildIdf(parsedNotes);
  const indexedNotes = parsedNotes.map((note) => ({ ...note, vector: vectorize(note, idf) }));
  const byPath = new Map(indexedNotes.map((note) => [note.note.relativePath, note] as const));
  const identifiers = new Map<string, string[]>();

  for (const note of indexedNotes) {
    for (const identifier of note.identifiers) {
      const current = identifiers.get(identifier) ?? [];
      current.push(note.note.relativePath);
      identifiers.set(identifier, unique(current));
    }
  }

  const outgoingLinks = new Map<string, Set<string>>();
  const incomingLinks = new Map<string, Set<string>>();

  for (const note of indexedNotes) {
    const resolvedTargets = new Set<string>();
    for (const link of note.links) {
      for (const candidate of resolveLinkTarget(note.note.relativePath, link, identifiers)) {
        if (candidate === note.note.relativePath) continue;
        resolvedTargets.add(candidate);
        const incoming = incomingLinks.get(candidate) ?? new Set<string>();
        incoming.add(note.note.relativePath);
        incomingLinks.set(candidate, incoming);
      }
    }
    outgoingLinks.set(note.note.relativePath, resolvedTargets);
  }

  return {
    notes: indexedNotes,
    byPath,
    identifiers,
    incomingLinks,
    outgoingLinks,
    idf,
    vocabularySize: idf.size,
    noteCount: indexedNotes.length
  };
}

function noteSummary(note: NoteSnapshotDto): string | undefined {
  const summary = extractSummary(note.content);
  return summary || undefined;
}

function mapLinkMatch(raw: ParsedLink, resolved: string[]): NoteLinkMatchDto {
  const uniqueCandidates = unique(resolved);
  return {
    raw: raw.raw,
    label: raw.label,
    kind: raw.kind,
    targetPath: uniqueCandidates.length === 1 ? uniqueCandidates[0] : undefined,
    candidates: uniqueCandidates,
    ambiguous: uniqueCandidates.length !== 1
  };
}

function suggestionPlacement(source: IndexedNote, target: IndexedNote): { mode: 'inline' | 'section'; matchedText?: string; ambiguous: boolean; reasons: string[] } {
  const title = target.title;
  const body = `${source.note.content}\n${source.title}\n${source.bodyWithoutFrontmatter}`;
  const normalizedTitle = normalizeText(title);
  const occurrences = normalizedTitle ? (normalizeText(body).match(new RegExp(`\\b${normalizedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'))?.length ?? 0) : 0;
  const inline = normalizedTitle && occurrences === 1;
  const ambiguous = occurrences > 1 || target.identifiers.some((identifier) => identifier === normalizeText(source.title));
  const reasons = inline ? ['Referência textual encontrada no corpo'] : ['Melhor aplicar em seção dedicada'];

  return { mode: inline && !ambiguous ? 'inline' : 'section', matchedText: inline ? title : undefined, ambiguous, reasons };
}

export class SemanticNoteRelationsService {
  private readonly cache = new Map<string, CacheEntry>();

  private getCache(vaultRoot: string): CacheEntry {
    const current = this.cache.get(vaultRoot);
    if (current) return current;

    const entry: CacheEntry = {
      noteFingerprints: new Map<string, string>(),
      parsedNotes: new Map<string, ParsedNote>()
    };
    this.cache.set(vaultRoot, entry);
    return entry;
  }

  private index(vaultRoot: string, notes: readonly NoteSnapshotDto[]): VaultIndex {
    const cache = this.getCache(vaultRoot);
    const index = buildIndex(notes, cache);
    cache.noteFingerprints = new Map(index.notes.map((note) => [note.note.relativePath, note.fingerprint] as const));
    cache.parsedNotes = new Map(index.notes.map((note) => [note.note.relativePath, { ...note, vector: new Map(note.vector) }] as const));
    return index;
  }

  getRelated(vaultRoot: string, notes: readonly NoteSnapshotDto[], sourcePath: string, limit = 12): RelatedNoteResponseDto {
    const index = this.index(vaultRoot, notes);
    const source = findNoteByPath(notes, sourcePath);
    const sourceIndexed = source ? index.byPath.get(source.relativePath) : undefined;

    if (!source || !sourceIndexed) {
      return { vaultRoot, sourcePath: normalizeRelativePath(sourcePath), manualLinks: [], backlinks: [], related: [] };
    }

    const incoming = [...(index.incomingLinks.get(source.relativePath) ?? new Set<string>())]
      .map((candidate) => index.byPath.get(candidate))
      .filter((value): value is IndexedNote => Boolean(value));

    const manualLinks = sourceIndexed.links
      .map((link) => mapLinkMatch(link, resolveLinkTarget(sourceIndexed.note.relativePath, link, index.identifiers)))
      .filter((link) => Boolean(link.targetPath));

    const backlinks = incoming.map((note) => ({
      raw: note.note.relativePath,
      label: note.title,
      kind: 'wiki' as const,
      targetPath: note.note.relativePath,
      candidates: [note.note.relativePath],
      ambiguous: false
    }));

    const excluded = new Set<string>([source.relativePath, ...manualLinks.flatMap((link) => link.targetPath ? [link.targetPath] : []), ...backlinks.map((link) => link.targetPath ?? '')].filter(Boolean));
    const related = index.notes
      .filter((target) => target.note.relativePath !== source.relativePath)
      .filter((target) => !excluded.has(target.note.relativePath))
      .map((target) => {
        const signals = buildSignals(sourceIndexed, target, index.incomingLinks, index.outgoingLinks);
        const score = combineSignals(signals);
        return {
          path: target.note.relativePath,
          title: target.title,
          score,
          intensity: intensityForScore(score),
          signals,
          reasons: extractReasons(signals, sourceIndexed, target, false),
          evidenceChunks: buildEvidenceChunks(sourceIndexed, target),
          kind: 'inferred' as const
        } satisfies RelatedNoteDto;
      })
      .filter((item) => item.score >= 0.35)
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, limit);

    return {
      vaultRoot,
      sourcePath: source.relativePath,
      title: sourceIndexed.title,
      manualLinks,
      backlinks,
      related
    };
  }

  suggestLinks(vaultRoot: string, notes: readonly NoteSnapshotDto[], sourcePath: string, limit = 8): LinkSuggestionDto[] {
    const index = this.index(vaultRoot, notes);
    const source = findNoteByPath(notes, sourcePath);
    const sourceIndexed = source ? index.byPath.get(source.relativePath) : undefined;
    if (!source || !sourceIndexed) return [];

    const directTargets = new Set<string>([
      ...(index.outgoingLinks.get(source.relativePath) ?? new Set<string>()),
      ...(index.incomingLinks.get(source.relativePath) ?? new Set<string>())
    ]);

    return index.notes
      .filter((target) => target.note.relativePath !== source.relativePath)
      .filter((target) => !directTargets.has(target.note.relativePath))
      .map((target) => {
        const signals = buildSignals(sourceIndexed, target, index.incomingLinks, index.outgoingLinks);
        const score = combineSignals(signals);
        const placement = suggestionPlacement(sourceIndexed, target);
        return {
          targetPath: target.note.relativePath,
          title: target.title,
          score,
          intensity: intensityForScore(score),
          reasons: [
            ...extractReasons(signals, sourceIndexed, target, false),
            ...placement.reasons
          ],
          matchedText: placement.matchedText,
          applicationMode: placement.mode,
          ambiguous: placement.ambiguous,
          candidates: placement.ambiguous ? [target.note.relativePath] : undefined
        } satisfies LinkSuggestionDto;
      })
      .filter((item) => item.score >= 0.35)
      .sort((left, right) => right.score - left.score || left.targetPath.localeCompare(right.targetPath))
      .slice(0, limit);
  }

  previewLinkApplication(vaultRoot: string, notes: readonly NoteSnapshotDto[], sourcePath: string, targetPath: string, mode: 'inline' | 'section' = 'section'): LinkPreviewDto {
    const index = this.index(vaultRoot, notes);
    const source = findNoteByPath(notes, sourcePath);
    const sourceIndexed = source ? index.byPath.get(source.relativePath) : undefined;
    const target = findNoteByPath(notes, targetPath);
    const targetIndexed = target ? index.byPath.get(target.relativePath) : undefined;

    if (!source || !sourceIndexed) {
      throw new Error('Source note not found');
    }
    if (!target || !targetIndexed) {
      throw new Error('Target note not found');
    }

    const placement = suggestionPlacement(sourceIndexed, targetIndexed);
    const applicationMode = mode === 'inline' && placement.mode === 'inline' ? 'inline' : 'section';
    const currentContent = source.content;
    const proposedContent = applicationMode === 'inline'
      ? applyInlineLink(currentContent, targetIndexed.title, target.relativePath)
      : applyRelatedSection(currentContent, targetIndexed.title, target.relativePath);

    return {
      vaultRoot,
      sourcePath: source.relativePath,
      targetPath: target.relativePath,
      title: targetIndexed.title,
      applicationMode,
      reason: applicationMode === 'inline'
        ? 'Referência textual inequívoca encontrada no corpo da nota.'
        : 'A relação será adicionada na seção ## Relacionadas para preservar a leitura natural.',
      diff: buildDiff(currentContent, proposedContent),
      currentContent,
      proposedContent,
      linkText: applicationMode === 'inline' ? targetIndexed.title : undefined
    };
  }

  buildGlobalGraph(vaultRoot: string, notes: readonly NoteSnapshotDto[], focusPath?: string, limit = Number.POSITIVE_INFINITY): GlobalGraphDto {
    const index = this.index(vaultRoot, notes);
    const focus = focusPath ? findNoteByPath(notes, focusPath) : undefined;
    const focusIndexed = focus ? index.byPath.get(focus.relativePath) : undefined;
    const focusId = focusIndexed?.note.relativePath;
    const nodeScores = index.notes.map((node) => {
      if (!focusIndexed) {
        return { node, score: node.note.relativePath === focusId ? 1 : 0.45, intensity: node.note.relativePath === focusId ? 'strong' as const : 'weak' as const };
      }

      if (node.note.relativePath === focusIndexed.note.relativePath) {
        return { node, score: 1, intensity: 'strong' as const };
      }

      const signals = buildSignals(focusIndexed, node, index.incomingLinks, index.outgoingLinks);
      const score = combineSignals(signals);
      return { node, score, intensity: intensityForScore(score) };
    })
      .sort((left, right) => right.score - left.score || left.node.note.relativePath.localeCompare(right.node.note.relativePath));

    const visibleNodeScores = Number.isFinite(limit)
      ? nodeScores.slice(0, Math.max(0, Math.min(limit, nodeScores.length)))
      : nodeScores;

    const selectedFolders = new Set<string>();
    for (const entry of visibleNodeScores) {
      let folder = entry.node.folderPath;
      while (folder) {
        selectedFolders.add(folder);
        const nextFolder = path.posix.dirname(folder);
        if (!nextFolder || nextFolder === '.' || nextFolder === folder) break;
        folder = nextFolder;
      }
    }

    const nodes: GraphNodeDto[] = [];
    const folderIds = new Map<string, string>();

    const sortedFolders = [...selectedFolders].sort((left, right) => left.localeCompare(right, 'pt-BR'));
    for (const folderPath of sortedFolders) {
      const id = `folder:${folderPath || 'root'}`;
      folderIds.set(folderPath, id);
      nodes.push({
        id,
        path: folderPath,
        label: folderPath ? path.posix.basename(folderPath) : 'Vault',
        kind: 'folder',
        score: focusIndexed ? commonFolderScore(focusIndexed.note.relativePath, folderPath || focusIndexed.note.relativePath) : 0.4,
        intensity: folderPath === focusIndexed?.folderPath ? 'strong' : 'weak'
      });
    }

    for (const entry of visibleNodeScores) {
      nodes.push({
        id: entry.node.note.relativePath,
        path: entry.node.note.relativePath,
        label: entry.node.title,
        kind: 'note',
        score: entry.score,
        intensity: entry.intensity,
        summary: noteSummary(entry.node.note),
        folderPath: entry.node.folderPath
      });
    }

    const edges: GraphEdgeDto[] = [];
    const selected = new Map(visibleNodeScores.map((entry) => [entry.node.note.relativePath, entry.node] as const));

    for (const entry of visibleNodeScores) {
      const parentPath = entry.node.folderPath;
      const parentId = parentPath ? folderIds.get(parentPath) : undefined;
      if (parentId) {
        edges.push({
          from: parentId,
          to: entry.node.note.relativePath,
          kind: 'folder',
          score: 0.5,
          intensity: 'weak'
        });
      }
    }

    for (const source of visibleNodeScores) {
      const sourcePathValue = source.node.note.relativePath;
      for (const targetPathValue of index.outgoingLinks.get(sourcePathValue) ?? new Set<string>()) {
        if (!selected.has(targetPathValue) || sourcePathValue === targetPathValue) continue;
        edges.push({
          from: sourcePathValue,
          to: targetPathValue,
          kind: 'manual',
          score: 1,
          intensity: 'strong'
        });
      }
    }

    for (let leftIndex = 0; leftIndex < visibleNodeScores.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < visibleNodeScores.length; rightIndex += 1) {
        const left = visibleNodeScores[leftIndex];
        const right = visibleNodeScores[rightIndex];
        const leftPath = left.node.note.relativePath;
        const rightPath = right.node.note.relativePath;
        const hasManual = (index.outgoingLinks.get(leftPath)?.has(rightPath) ?? false) || (index.outgoingLinks.get(rightPath)?.has(leftPath) ?? false);
        if (hasManual) continue;

        const signals = buildSignals(left.node, right.node, index.incomingLinks, index.outgoingLinks);
        const score = combineSignals(signals);
        if (score < 0.35) continue;

        edges.push({
          from: leftPath,
          to: rightPath,
          kind: 'inferred',
          score,
          intensity: intensityForScore(score)
        });
      }
    }

    const seen = new Set<string>();
    const graphEdges = edges.filter((edge) => {
      const key = `${edge.from}->${edge.to}:${edge.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      vaultRoot,
      focusPath: focusIndexed?.note.relativePath ?? focusPath,
      nodes,
      edges: graphEdges
    };
  }
}

function linkDisplayPath(targetPath: string): string {
  return normalizeRelativePath(targetPath);
}

function applyInlineLink(content: string, title: string, targetPath: string): string {
  const link = `[[${path.posix.basename(linkDisplayPath(targetPath), path.posix.extname(targetPath))}|${title}]]`;
  const normalizedContent = content;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  if (regex.test(normalizedContent)) {
    return normalizedContent.replace(regex, link);
  }
  return applyRelatedSection(normalizedContent, title, targetPath);
}

function applyRelatedSection(content: string, title: string, targetPath: string): string {
  const link = `[[${path.posix.basename(linkDisplayPath(targetPath), path.posix.extname(targetPath))}|${title}]]`;
  const lines = content.split(/\r?\n/);
  const existingIndex = lines.findIndex((line) => /^##\s+Relacionadas\s*$/i.test(line.trim()));
  if (existingIndex >= 0) {
    const insertionIndex = existingIndex + 1;
    const nextLine = lines[insertionIndex] ?? '';
    if (!nextLine.trim().startsWith('- ')) {
      lines.splice(insertionIndex, 0, `- ${link}`);
    } else if (!lines.slice(insertionIndex).some((line) => line.includes(link))) {
      lines.splice(insertionIndex, 0, `- ${link}`);
    }
    return lines.join('\n');
  }

  const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  return `${content}${suffix}\n## Relacionadas\n- ${link}`.trimStart();
}

export function createSemanticNoteRelationsService(): SemanticNoteRelationsService {
  return new SemanticNoteRelationsService();
}

export function buildSemanticNoteIndex(notes: readonly NoteSnapshotDto[], vaultRoot = ''): GlobalGraphDto {
  return createSemanticNoteRelationsService().buildGlobalGraph(vaultRoot, notes);
}

export { applyInlineLink, applyRelatedSection, buildIndex, buildSignals, combineSignals, intensityForScore, parseLinks, tokenize };
