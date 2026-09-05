import { fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import type { NoteSnapshotDto } from '../../../application/dto/note-snapshot.dto';
import { OrionKnowledgeFacade } from '../../../application/services/orion-knowledge-facade';
import { OrionSourceRegistry } from '../../../application/services/orion-source-registry';
import { createOrionMcpError } from '../tool-error';

export const ORION_READ_MAX_CHARACTERS = 12_000;

export const ORION_READ_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string', minLength: 1, pattern: '\\S' },
    sourceRef: { type: 'string', minLength: 1, pattern: '\\S' }
  },
  anyOf: [{ required: ['path'] }, { required: ['sourceRef'] }],
  additionalProperties: false
} as const;

export const ORION_READ_TOOL = {
  description: 'Reads one Markdown note by relative path or opaque sourceRef from the configured Orion Vault.',
  inputSchema: fromJsonSchema<OrionReadInput>(ORION_READ_INPUT_SCHEMA)
};

export interface OrionReadInput {
  readonly path?: string;
  readonly sourceRef?: string;
}

export interface OrionReadService {
  getNote(vaultRoot: string, relativePath: string): Promise<NoteSnapshotDto | null>;
}

export interface OrionReadRuntime {
  readonly noteSource: OrionReadService;
  readonly vaultRoots: readonly string[];
  readonly sourceRegistry?: OrionSourceRegistry;
  readonly facade?: OrionKnowledgeFacade;
  readonly knowledge?: OrionKnowledgeFacade;
  readonly service?: import('../orion-multi-vault').OrionMultiVaultService;
}

function normalizeReadPath(value: string): string | null {
  const trimmed = value.trim();
  const normalizedSeparators = trimmed.replace(/\\/g, '/');

  if (
    !trimmed ||
    normalizedSeparators.startsWith('/') ||
    /^[A-Za-z]:/.test(normalizedSeparators) ||
    normalizedSeparators.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    return null;
  }

  const normalized = normalizedSeparators.replace(/\/+/g, '/');
  return normalized.toLowerCase().endsWith('.md') ? normalized : null;
}

export async function handleOrionRead(service: OrionReadService, vaultRoot: string, input: OrionReadInput): Promise<CallToolResult> {
  const relativePath = normalizeReadPath(input.path ?? '');
  if (!relativePath) {
    return createOrionMcpError('INVALID_INPUT', 'Invalid Orion note path. Use a relative Markdown path inside the configured Vault.');
  }

  try {
    const note = await service.getNote(vaultRoot, relativePath);
    return formatReadResult(note, relativePath);
  } catch {
    return createOrionMcpError('INTERNAL_ERROR', 'Unable to read Orion note.');
  }
}

export function createOrionReadHandler(runtime: OrionReadRuntime): (input: OrionReadInput) => Promise<CallToolResult> {
  return async (input) => {
    try {
      if (input.sourceRef?.trim()) {
        const facade = runtime.knowledge ?? runtime.facade ?? createReadFacade(runtime);
        const location = runtime.sourceRegistry?.resolve(input.sourceRef.trim());
        if (!location) {
          return createOrionMcpError('NOT_FOUND', 'No Orion source was found for the supplied sourceRef.');
        }
        const result = await facade.read({ sourceRef: input.sourceRef.trim() });
        if (!result.vaultAvailable) {
          return createOrionMcpError('VAULT_UNAVAILABLE', 'The Orion Vault for the supplied sourceRef could not be read.');
        }
        return formatReadResult(result.note, location.relativePath);
      }

      const relativePath = normalizeReadPath(input.path ?? '');
      if (!relativePath) {
        return createOrionMcpError('INVALID_INPUT', 'Invalid Orion note path. Use a relative Markdown path inside the configured Vault.');
      }
      const result = await (runtime.knowledge ?? runtime.facade ?? createReadFacade(runtime)).read({ path: relativePath });
      if (!result.vaultAvailable) {
        return createOrionMcpError('VAULT_UNAVAILABLE', 'No configured Orion Vault could be read.');
      }
      return formatReadResult(result.note, relativePath);
    } catch {
      return createOrionMcpError('INTERNAL_ERROR', 'Unable to read Orion note.');
    }
  };
}

function createReadFacade(runtime: OrionReadRuntime): OrionKnowledgeFacade {
  return new OrionKnowledgeFacade({
    service: runtime.service ?? { search: async () => { throw new Error('Search unavailable'); }, loadAgentContext: async () => { throw new Error('Context unavailable'); } },
    noteSource: { getNote: runtime.noteSource.getNote.bind(runtime.noteSource), listNotes: async () => [] },
    vaultRoots: runtime.vaultRoots,
    sourceRegistry: runtime.sourceRegistry ?? new OrionSourceRegistry()
  });
}

function formatReadResult(note: NoteSnapshotDto | null, requestedPath: string): CallToolResult {
  if (!note) {
    return createOrionMcpError('NOT_FOUND', `No Orion note was found at:\n${requestedPath}`);
  }

  const truncated = note.content.length > ORION_READ_MAX_CHARACTERS;
  const content = truncated ? note.content.slice(0, ORION_READ_MAX_CHARACTERS) : note.content;
  const lines = ['Orion note loaded.'];

  if (note.title) lines.push('', `Title: ${note.title}`);
  lines.push(`Path: ${note.relativePath}`);
  if (note.tags.length > 0) lines.push(`Tags: ${note.tags.join(', ')}`);
  lines.push('', 'Content:', '', content);
  if (truncated) lines.push('', 'Content truncated.');

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
