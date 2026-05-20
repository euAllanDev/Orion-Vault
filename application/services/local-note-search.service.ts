import path from 'node:path';
import type { NoteSnapshotDto } from '../dto/note-snapshot.dto';
import type { SearchMatchDto } from '../dto/ai-bridge.dto';

export interface LocalNoteSearchCriteria {
  readonly query?: string;
  readonly phrase?: string;
  readonly tags?: readonly string[];
}

function normalizeTag(value: string): string {
  return normalizeText(value).replace(/^#/, '').trim();
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeQuery(query: string): string[] {
  return [...new Set(normalizeText(query).split(/[\s/]+/).filter(Boolean))];
}

function normalizeCriteriaTags(tags: readonly string[] | undefined): readonly string[] {
  return [...new Set((tags ?? []).map(normalizeTag).filter(Boolean))];
}

function buildSearchText(criteria: LocalNoteSearchCriteria): string {
  return [criteria.query, criteria.phrase].filter(Boolean).join(' ').trim();
}

function containsNormalized(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function matchExactPhrase(note: NoteSnapshotDto, phrase: string): boolean {
  const normalizedPhrase = normalizeText(phrase);
   if (!normalizedPhrase) {
    return true;
  }

  const fields = [
    note.title ?? '',
    note.content,
    note.relativePath,
    path.basename(note.relativePath),
    note.tags.join(' ')
  ];

  return fields.some((field) => containsNormalized(field, normalizedPhrase));
}

function formatSnippet(text: string, needle: string): string | undefined {
  const source = text.replace(/\r?\n+/g, ' ').trim();
  if (!source) {
    return undefined;
  }

  const normalizedSource = source.toLowerCase();
  const normalizedNeedle = needle.toLowerCase().trim();

  if (!normalizedNeedle) {
    return undefined;
  }

  const index = normalizedSource.indexOf(normalizedNeedle);
  if (index < 0) {
    return undefined;
  }

  const snippetStart = Math.max(0, index - 32);
  const snippetEnd = Math.min(source.length, index + normalizedNeedle.length + 32);
  const prefix = snippetStart > 0 ? '...' : '';
  const suffix = snippetEnd < source.length ? '...' : '';
  const slice = source.slice(snippetStart, snippetEnd);
  const localIndex = index - snippetStart;

  return `${prefix}${slice.slice(0, localIndex)}[[${slice.slice(localIndex, localIndex + normalizedNeedle.length)}]]${slice.slice(localIndex + normalizedNeedle.length)}${suffix}`;
}

function buildSnippet(note: NoteSnapshotDto, criteria: LocalNoteSearchCriteria, queryTokens: readonly string[]): string | undefined {
  const needles = [criteria.phrase, ...queryTokens, ...(criteria.tags ?? [])]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean);

  const candidates = [note.title ?? '', note.content, note.relativePath, note.tags.join(' ')];

  for (const needle of needles) {
    for (const candidate of candidates) {
      const snippet = formatSnippet(candidate, needle);
      if (snippet) {
        return snippet;
      }
    }
  }

  return undefined;
}

function scoreNote(note: NoteSnapshotDto, criteria: LocalNoteSearchCriteria): SearchMatchDto | null {
  const searchText = buildSearchText(criteria);
  const queryTokens = tokenizeQuery(searchText);
  const requiredTags = normalizeCriteriaTags(criteria.tags);

  if (requiredTags.length > 0) {
    const noteTags = new Set(note.tags.map(normalizeTag));
    for (const tag of requiredTags) {
      if (!noteTags.has(tag)) {
        return null;
      }
    }
  }

  if (criteria.phrase && !matchExactPhrase(note, criteria.phrase)) {
    return null;
  }

  const fields = [
    { name: 'title', value: note.title ?? '', weight: 5 },
    { name: 'tags', value: note.tags.join(' '), weight: 4 },
    { name: 'content', value: note.content, weight: 2 },
    { name: 'path', value: note.relativePath, weight: 3 },
    { name: 'filename', value: path.basename(note.relativePath), weight: 3 }
  ];

  let score = 0;
  const matchedFields = new Set<string>();

  for (const token of queryTokens) {
    let tokenMatched = false;

    for (const field of fields) {
      if (!field.value) {
        continue;
      }

      if (normalizeText(field.value).includes(token)) {
        tokenMatched = true;
        matchedFields.add(field.name);
        score += field.weight;
      }
    }

    if (!tokenMatched) {
      return null;
    }
  }

  const normalizedQuery = normalizeText(searchText);
  if (normalizedQuery && normalizeText(note.title ?? '').includes(normalizedQuery)) {
    score += 2;
  }

  if (criteria.phrase) {
    score += 10;
  }

  return {
    kind: 'note',
    path: note.relativePath,
    title: note.title,
    tags: note.tags,
    score,
    matchedFields: [...matchedFields],
    snippet: buildSnippet(note, criteria, queryTokens)
  };
}

export class LocalNoteSearchService {
  buildMatches(notes: readonly NoteSnapshotDto[], criteria: LocalNoteSearchCriteria): readonly SearchMatchDto[] {
    const searchText = buildSearchText(criteria);
    const queryTokens = tokenizeQuery(searchText);
    const requiredTags = normalizeCriteriaTags(criteria.tags);

    if (queryTokens.length === 0 && requiredTags.length === 0 && !criteria.phrase) {
      return [];
    }

    return notes
      .map((note) => scoreNote(note, criteria))
      .filter((match): match is SearchMatchDto => match !== null)
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
  }

  normalizeTags(tags: readonly string[] | undefined): readonly string[] {
    return normalizeCriteriaTags(tags);
  }
}
