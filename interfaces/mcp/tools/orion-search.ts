import { fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import type {
  AiBridgeResponseDto,
  AiBridgeSearchDataDto,
  AiBridgeSearchRequestDto
} from '../../../application/dto/ai-bridge.dto';
import { searchAcrossVaults } from '../orion-multi-vault';
import { createAiBridgeRuntime } from '../../runtime/ai-bridge-runtime';

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

export async function handleOrionSearch(service: OrionSearchService, vaultRoot: string, input: OrionSearchInput): Promise<CallToolResult> {
  try {
    const response = await service.search({
      vaultRoot,
      query: input.query.trim(),
      tags: input.tags,
      scopePath: input.scopePath
    });

    if (response.status === 'error' || response.status === 'conflict') {
      return {
        content: [{ type: 'text', text: formatSearchError(response) }],
        isError: true
      };
    }

    return {
      content: [{ type: 'text', text: formatSearchMatches(response.data) }]
    };
  } catch {
    return {
      content: [{ type: 'text', text: 'Unable to search Orion Vault.' }],
      isError: true
    };
  }
}

export async function executeOrionSearch(input: OrionSearchInput): Promise<CallToolResult> {
  try {
    const runtime = createAiBridgeRuntime();
    const response = await searchAcrossVaults(runtime.service, runtime.vaultRoots, {
      query: input.query.trim(),
      tags: input.tags,
      scopePath: input.scopePath
    });
    return response.status === 'error' || response.status === 'conflict'
      ? { content: [{ type: 'text', text: formatSearchError(response) }], isError: true }
      : { content: [{ type: 'text', text: formatSearchMatches(response.data) }] };
  } catch {
    return {
      content: [{ type: 'text', text: 'Unable to search Orion Vault.' }],
      isError: true
    };
  }
}

function formatSearchMatches(data: AiBridgeSearchDataDto): string {
  if (data.matches.length === 0) {
    return 'No Orion Vault notes matched the search.';
  }

  const lines = [`Found ${data.matches.length} matching note(s).`];

  for (const [index, match] of data.matches.entries()) {
    lines.push('');
    lines.push(`${index + 1}. ${match.title ?? match.path}`);
    lines.push(`Path: ${match.path}`);
    lines.push(`Score: ${match.score}`);
    if (match.tags.length > 0) {
      lines.push(`Tags: ${match.tags.join(', ')}`);
    }
    if (match.matchedFields.length > 0) {
      lines.push(`Matched fields: ${match.matchedFields.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function formatSearchError(response: AiBridgeResponseDto<AiBridgeSearchDataDto>): string {
  const issueLines = response.issues.map((issue) => `- ${issue.code}: ${issue.message}`);
  return [response.summary, ...issueLines].join('\n');
}
