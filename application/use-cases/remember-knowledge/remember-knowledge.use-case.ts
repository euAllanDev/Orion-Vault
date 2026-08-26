import { createHash } from 'node:crypto';
import path from 'node:path';
import type { RememberKnowledgeInputDto, RememberKnowledgeResultDto } from '../../dto/remember-knowledge.dto';
import type { NoteSnapshotDto } from '../../dto/note-snapshot.dto';
import type { NoteSourcePort } from '../../ports/note-source.port';
import type { VaultWorkspacePort } from '../../ports/vault-workspace.port';

export class RememberKnowledgeError extends Error {
  constructor(readonly code: 'WRITE_TARGET_NOT_CONFIGURED' | 'WRITE_TARGET_NOT_READ_SOURCE' | 'REMEMBER_CONTENT_EMPTY') {
    super(code);
    this.name = 'RememberKnowledgeError';
  }
}

export interface RememberKnowledgeDependencies {
  readonly noteSource: NoteSourcePort;
  readonly workspace: VaultWorkspacePort;
  readonly writeVaultRoot?: string;
  readonly readVaultRoots: readonly string[];
}

interface NormalizedRememberInput {
  readonly content: string;
  readonly subject?: string;
  readonly project?: string;
  readonly kind?: string;
  readonly fingerprint: string;
}

export type RememberCandidateClassification = 'equivalent' | 'canonical' | 'related' | 'conflicting' | 'ignored';

export class RememberKnowledgeUseCase {
  constructor(private readonly dependencies: RememberKnowledgeDependencies) {}

  async execute(input: RememberKnowledgeInputDto): Promise<RememberKnowledgeResultDto> {
    const remember = normalizeInput(input);
    const writeVaultRoot = this.resolveWriteVaultRoot();
    const notes = (await this.dependencies.noteSource.listNotes(writeVaultRoot)).filter((note) => isSafeRelativeMarkdownPath(note.relativePath));
    const classifications = notes.map((note) => ({ note, classification: classifyRememberCandidate(note, remember) }));
    const equivalent = classifications.find(({ classification }) => classification === 'equivalent')?.note;

    if (equivalent) {
      return success('noop', equivalent.relativePath, 'Equivalent knowledge already exists.');
    }

    const conflictingCandidates = classifications
      .filter(({ classification }) => classification === 'conflicting')
      .map(({ note }) => note);
    if (conflictingCandidates.length) {
      return conflict('candidate_requires_clarification', conflictingCandidates);
    }

    const canonicalCandidates = classifications
      .filter(({ classification }) => classification === 'canonical')
      .map(({ note }) => note);
    if (canonicalCandidates.length > 1) {
      return conflict('multiple_strong_candidates', canonicalCandidates);
    }

    const candidate = canonicalCandidates[0];
    if (candidate) {

      const proposedContent = appendDelimited(candidate.content, input.content.trim());
      const changed = await this.dependencies.workspace.editMarkdownFileIfUnchanged(
        writeVaultRoot,
        candidate.relativePath,
        contentHash(candidate.content),
        proposedContent
      );
      if (!changed) {
        return conflict('note_changed_during_append', [candidate]);
      }
      return success('appended', candidate.relativePath, 'Knowledge appended to canonical note.');
    }

    const note = `remember-${remember.fingerprint.slice(0, 16)}.md`;
    if (notes.some((existing) => existing.relativePath.toLowerCase() === note)) {
      return conflict('create_target_collision');
    }

    try {
      await this.dependencies.workspace.createMarkdownFile(writeVaultRoot, note, createContent(remember, input.content.trim()));
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'VAULT_FILE_EXISTS') {
        return conflict('create_target_collision');
      }
      throw error;
    }
    return success('created', note, 'Knowledge saved in a new note.');
  }

  private resolveWriteVaultRoot(): string {
    const writeVaultRoot = this.dependencies.writeVaultRoot?.trim();
    if (!writeVaultRoot) throw new RememberKnowledgeError('WRITE_TARGET_NOT_CONFIGURED');

    const target = rootKey(writeVaultRoot);
    if (!this.dependencies.readVaultRoots.some((root) => rootKey(root) === target)) {
      throw new RememberKnowledgeError('WRITE_TARGET_NOT_READ_SOURCE');
    }
    return writeVaultRoot;
  }
}

function normalizeInput(input: RememberKnowledgeInputDto): NormalizedRememberInput {
  const content = normalized(input.content);
  if (!content) throw new RememberKnowledgeError('REMEMBER_CONTENT_EMPTY');
  const subject = optionalNormalized(input.subject);
  const project = optionalNormalized(input.project);
  const kind = optionalNormalized(input.kind);
  return { content, subject, project, kind, fingerprint: contentHash([content, subject ?? '', project ?? '', kind ?? ''].join('\n')) };
}

function normalized(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function optionalNormalized(value: string | undefined): string | undefined {
  const result = value === undefined ? undefined : normalized(value);
  return result || undefined;
}

function rootKey(value: string): string {
  return path.resolve(value).replace(/\\/g, '/').replace(/\/+$/, '').toLocaleLowerCase();
}

function isSafeRelativeMarkdownPath(value: string): boolean {
  const normalizedPath = value.trim().replace(/\\/g, '/');
  return Boolean(
    normalizedPath &&
    !normalizedPath.startsWith('/') &&
    !/^[A-Za-z]:/.test(normalizedPath) &&
    !normalizedPath.split('/').some((segment) => segment === '.' || segment === '..') &&
    normalizedPath.toLowerCase().endsWith('.md')
  );
}

function contentHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function tokens(value: string): readonly string[] {
  return normalized(value).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3);
}

function containsEquivalentAssertion(content: string, assertion: string): boolean {
  const escaped = assertion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'u').test(normalized(content));
}

export function classifyRememberCandidate(note: NoteSnapshotDto, input: Pick<RememberKnowledgeInputDto, 'content' | 'subject' | 'project' | 'kind'>): RememberCandidateClassification {
  const normalizedInput = {
    content: normalized(input.content),
    subject: optionalNormalized(input.subject),
    project: optionalNormalized(input.project),
    kind: optionalNormalized(input.kind)
  };
  if (containsEquivalentAssertion(note.content, normalizedInput.content)) return 'equivalent';
  if (isCanonicalCandidate(note, normalizedInput)) return mayContradict(note, normalizedInput) ? 'conflicting' : 'canonical';
  return isRelatedCandidate(note, normalizedInput) ? 'related' : 'ignored';
}

function isRelatedCandidate(note: NoteSnapshotDto, input: Pick<NormalizedRememberInput, 'content' | 'subject' | 'project' | 'kind'>): boolean {
  const noteTokens = new Set(tokens(`${note.title ?? ''} ${note.relativePath} ${note.content}`));
  return tokens(input.content).filter((token) => noteTokens.has(token)).length >= 2;
}

function isCanonicalCandidate(note: NoteSnapshotDto, input: Pick<NormalizedRememberInput, 'subject' | 'project'>): boolean {
  if (!input.subject) return false;

  const title = normalized(note.title ?? '');
  const pathSegments = note.relativePath
    .replace(/\.md$/i, '')
    .split('/')
    .map((segment) => normalized(segment.replace(/[-_]/g, ' ')));
  const subjectMatch = title === input.subject || pathSegments.includes(input.subject);
  if (!subjectMatch) return false;
  if (!input.project) return true;

  return title === input.project || pathSegments.includes(input.project) || normalized(note.content).includes(input.project);
}

function mayContradict(note: NoteSnapshotDto, input: Pick<NormalizedRememberInput, 'content'>): boolean {
  const existing = normalized(note.content.replace(/^#{1,6}\s+.*$/gm, ''));
  const incoming = input.content;
  if (/\bnao\b|\bnot\b/.test(existing) !== /\bnao\b|\bnot\b/.test(incoming)) return true;
  const existingStatement = existing.match(/^(.{3,80}?)\s+(is|are|uses|usa|tem|e)\s+/);
  const incomingStatement = incoming.match(/^(.{3,80}?)\s+(is|are|uses|usa|tem|e)\s+/);
  return Boolean(
    existingStatement &&
    incomingStatement &&
    existingStatement[1] === incomingStatement[1] &&
    existingStatement[2] === incomingStatement[2]
  );
}

function appendDelimited(content: string, incoming: string): string {
  return `${content.trimEnd()}\n\n## Remembered\n\n- ${incoming}\n`;
}

function createContent(input: NormalizedRememberInput, originalContent: string): string {
  const title = input.subject ? originalContent.slice(0, 80).replace(/[\r\n]+/g, ' ').trim() : 'Remembered knowledge';
  return `# ${title}\n\n${originalContent}\n`;
}

function success(action: 'noop' | 'created' | 'appended', note: string, summary: string): Extract<RememberKnowledgeResultDto, { action: 'noop' | 'created' | 'appended' }> {
  return action === 'noop'
    ? { action, reason: 'equivalent_knowledge_exists', note, summary, source: 'user-explicit-agent' }
    : { action, note, summary, source: 'user-explicit-agent' };
}

function conflict(reason: string, candidates?: readonly NoteSnapshotDto[]): RememberKnowledgeResultDto {
  return {
    action: 'conflict',
    reason,
    candidates: candidates?.map((candidate) => candidate.relativePath),
    nextStep: reason === 'candidate_requires_clarification' ? 'clarification_required' : 'confirmation_required'
  };
}
