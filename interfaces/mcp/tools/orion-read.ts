import { fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import type { NoteSnapshotDto } from '../../../application/dto/note-snapshot.dto';
import { readAcrossVaults } from '../orion-multi-vault';

export const ORION_READ_MAX_CHARACTERS = 12_000;

export const ORION_READ_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string', minLength: 1, pattern: '\\S' }
  },
  required: ['path'],
  additionalProperties: false
} as const;

export const ORION_READ_TOOL = {
  description: 'Reads one Markdown note from the configured Orion Vault.',
  inputSchema: fromJsonSchema<OrionReadInput>(ORION_READ_INPUT_SCHEMA)
};

export interface OrionReadInput {
  readonly path: string;
}

export interface OrionReadService {
  getNote(vaultRoot: string, relativePath: string): Promise<NoteSnapshotDto | null>;
}

export interface OrionReadRuntime {
  readonly noteSource: OrionReadService;
  readonly vaultRoots: readonly string[];
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
  const relativePath = normalizeReadPath(input.path);
  if (!relativePath) {
    return {
      content: [{ type: 'text', text: 'Invalid Orion note path. Use a relative Markdown path inside the configured Vault.' }],
      isError: true
    };
  }

  try {
    const note = await service.getNote(vaultRoot, relativePath);
    return formatReadResult(note, relativePath);
  } catch {
    return {
      content: [{ type: 'text', text: 'Unable to read Orion note.' }],
      isError: true
    };
  }
}

export function createOrionReadHandler(runtime: OrionReadRuntime): (input: OrionReadInput) => Promise<CallToolResult> {
  return async (input) => {
    const relativePath = normalizeReadPath(input.path);
    if (!relativePath) {
      return {
        content: [{ type: 'text', text: 'Invalid Orion note path. Use a relative Markdown path inside the configured Vault.' }],
        isError: true
      };
    }

    try {
      const note = await readAcrossVaults(runtime.noteSource, runtime.vaultRoots, relativePath);
      return formatReadResult(note, relativePath);
    } catch {
      return {
        content: [{ type: 'text', text: 'Unable to read Orion note.' }],
        isError: true
      };
    }
  };
}

function formatReadResult(note: NoteSnapshotDto | null, requestedPath: string): CallToolResult {
  if (!note) {
    return { content: [{ type: 'text', text: `No Orion note was found at:\n${requestedPath}` }] };
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
