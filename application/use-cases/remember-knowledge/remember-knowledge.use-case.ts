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

export class RememberKnowledgeUseCase {
  constructor(private readonly dependencies: RememberKnowledgeDependencies) {}

  async execute(input: RememberKnowledgeInputDto): Promise<RememberKnowledgeResultDto> {
    const remember = normalizeInput(input);
    const writeVaultRoot = this.resolveWriteVaultRoot();
    const notes = (await this.dependencies.noteSource.listNotes(writeVaultRoot)).filter((note) => isSafeRelativeMarkdownPath(note.relativePath));
    const equivalent = notes.find((note) => containsEquivalentAssertion(note.content, remember.content));

    if (equivalent) {
      return success('noop', equivalent.relativePath, 'Equivalent knowledge already exists.');
    }

    const candidates = notes.filter((note) => isCandidate(note, remember));
    if (candidates.length > 1) {
      return conflict('multiple_strong_candidates', candidates);
    }

    const candidate = candidates[0];
    if (candidate) {
      if (!isCanonicalCandidate(candidate, remember) || mayContradict(candidate, remember)) {
        return conflict('candidate_requires_clarification', [candidate]);
      }

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

function isCandidate(note: NoteSnapshotDto, input: NormalizedRememberInput): boolean {
  const title = normalized(note.title ?? '');
  const signals = [input.subject, input.project, input.kind].filter((value): value is string => Boolean(value));
  if (signals.some((signal) => title === signal)) return true;

  const noteTokens = new Set(tokens(note.content));
  return tokens(input.content).filter((token) => noteTokens.has(token)).length >= 2;
}

function isCanonicalCandidate(note: NoteSnapshotDto, input: NormalizedRememberInput): boolean {
  return Boolean(input.subject && normalized(note.title ?? '') === input.subject);
}

function mayContradict(note: NoteSnapshotDto, input: NormalizedRememberInput): boolean {
  const existing = normalized(note.content);
  const incoming = input.content;
  if (/\bnao\b|\bnot\b/.test(existing) !== /\bnao\b|\bnot\b/.test(incoming)) return true;
  const existingPrefix = existing.match(/^(.{3,80}?)(?:\s+(?:is|are|uses|usa|tem|e)\s+)/)?.[1];
  const incomingPrefix = incoming.match(/^(.{3,80}?)(?:\s+(?:is|are|uses|usa|tem|e)\s+)/)?.[1];
  return Boolean(existingPrefix && incomingPrefix && existingPrefix === incomingPrefix);
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
