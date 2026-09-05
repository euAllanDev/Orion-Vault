import { fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import type {
  AiBridgeResponseDto,
  AiBridgeSearchDataDto,
  AiBridgeSearchRequestDto
} from '../../../application/dto/ai-bridge.dto';
import { OrionKnowledgeFacade } from '../../../application/services/orion-knowledge-facade';
import { OrionSourceRegistry } from '../../../application/services/orion-source-registry';
import type { OrionMultiVaultService } from '../orion-multi-vault';
import { classifyOrionMcpFailure, createOrionMcpError } from '../tool-error';
import type { MultiVaultSearchData } from '../orion-multi-vault';

export const ORION_SEARCH_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    query: { type: 'string', minLength: 1, pattern: '\\S' },
    scopePath: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } }
  },
  required: ['query'],
  additionalProperties: false
} as const;

export const ORION_SEARCH_TOOL = {
  description: 'Searches notes in an Orion Vault.',
  inputSchema: fromJsonSchema<OrionSearchInput>(ORION_SEARCH_INPUT_SCHEMA)
};

export interface OrionSearchInput {
  readonly query: string;
  readonly scopePath?: string;
  readonly tags?: readonly string[];
}

export interface OrionSearchService {
  search(request: AiBridgeSearchRequestDto): Promise<AiBridgeResponseDto<AiBridgeSearchDataDto>>;
}

export interface OrionSearchRuntime {
  readonly service: OrionMultiVaultService;
  readonly vaultRoots: readonly string[];
  readonly sourceRegistry?: OrionSourceRegistry;
  readonly facade?: OrionKnowledgeFacade;
  readonly knowledge?: OrionKnowledgeFacade;
  readonly noteSource?: import('../../../application/ports/note-source.port').NoteSourcePort;
}

export async function handleOrionSearch(service: OrionSearchService, vaultRoot: string, input: OrionSearchInput): Promise<CallToolResult> {
  const query = normalizeQuery(input);
  if (!query) {
    return createOrionMcpError('INVALID_INPUT', 'Search query must contain non-whitespace text.');
  }

  try {
    const response = await service.search({
      vaultRoot,
      query,
      tags: input.tags,
      scopePath: input.scopePath
    });

    if (response.status === 'error' || response.status === 'conflict') {
      return createOrionMcpError(classifyOrionMcpFailure(response), 'Unable to search Orion Vault.');
    }

    return {
      content: [{ type: 'text', text: formatSearchMatches(response.data) }]
    };
  } catch {
    return createOrionMcpError('INTERNAL_ERROR', 'Unable to search Orion Vault.');
  }
}

export function createOrionSearchHandler(runtime: OrionSearchRuntime): (input: OrionSearchInput) => Promise<CallToolResult> {
  return async (input) => {
    const query = normalizeQuery(input);
    if (!query) {
      return createOrionMcpError('INVALID_INPUT', 'Search query must contain non-whitespace text.');
    }

    try {
      const facade = runtime.knowledge ?? runtime.facade ?? new OrionKnowledgeFacade({
        service: runtime.service,
        noteSource: runtime.noteSource ?? { getNote: async () => null, listNotes: async () => [] },
        vaultRoots: runtime.vaultRoots,
        sourceRegistry: runtime.sourceRegistry ?? new OrionSourceRegistry()
      });
      const response = await facade.search({
        query,
        tags: input.tags,
        scopePath: input.scopePath
      });
      return response.status === 'error' || response.status === 'conflict'
        ? createOrionMcpError(classifyOrionMcpFailure(response), 'Unable to search Orion Vault.')
        : { content: [{ type: 'text', text: formatSearchMatches(response.data) }] };
    } catch {
      return createOrionMcpError('INTERNAL_ERROR', 'Unable to search Orion Vault.');
    }
  };
}

function formatSearchMatches(data: AiBridgeSearchDataDto | MultiVaultSearchData): string {
  if (data.matches.length === 0) {
    return 'No Orion Vault notes matched the search.';
  }

  const lines = [`Found ${data.matches.length} matching note(s).`];

  for (const [index, match] of data.matches.entries()) {
    lines.push('');
    lines.push(`${index + 1}. ${match.title ?? match.path}`);
    lines.push(`Path: ${match.path}`);
    if ('sourceRef' in match && match.sourceRef) lines.push(`Source ref: ${match.sourceRef}`);
    lines.push(`Score: ${match.score}`);
    if (match.tags.length > 0) {
      lines.push(`Tags: ${match.tags.join(', ')}`);
    }
    if (match.matchedFields.length > 0) {
      lines.push(`Matched fields: ${match.matchedFields.join(', ')}`);
    }

    const snippets = new Set<string>();
    if (match.snippet) {
      lines.push(`Snippet: ${match.snippet}`);
      snippets.add(normalizeSnippet(match.snippet));
    }

    const chunk = data.chunks.find((candidate) => candidate.path === match.path && !snippets.has(normalizeSnippet(candidate.snippet)));
    if (chunk) {
      if (chunk.heading) {
        lines.push(`Relevant section: ${chunk.heading}`);
      }
      lines.push(`Snippet: ${chunk.snippet}`);
    }
  }

  return lines.join('\n');
}

function normalizeSnippet(snippet: string): string {
  return snippet.replace(/\s+/g, ' ').trim();
}

function normalizeQuery(input: OrionSearchInput): string | null {
  return typeof input.query === 'string' && input.query.trim() ? input.query.trim() : null;
}
