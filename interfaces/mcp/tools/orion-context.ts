import { fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import type {
  AiBridgeAgentContextDataDto,
  AiBridgeAgentContextRequestDto,
  AiBridgeResponseDto
} from '../../../application/dto/ai-bridge.dto';
import { contextAcrossVaults } from '../orion-multi-vault';
import { createAiBridgeRuntime } from '../../runtime/ai-bridge-runtime';

export const ORION_CONTEXT_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    query: { type: 'string' },
    focusPath: { type: 'string' },
    scopePath: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } }
  },
  additionalProperties: false
} as const;

export const ORION_CONTEXT_TOOL = {
  description: 'Loads focused, relevant context from the configured Orion Vault for an agent task.',
  inputSchema: fromJsonSchema<OrionContextInput>(ORION_CONTEXT_INPUT_SCHEMA)
};

export interface OrionContextInput {
  readonly query?: string;
  readonly focusPath?: string;
  readonly scopePath?: string;
  readonly tags?: readonly string[];
}

export interface OrionContextService {
  loadAgentContext(request: AiBridgeAgentContextRequestDto): Promise<AiBridgeResponseDto<AiBridgeAgentContextDataDto>>;
}

export async function handleOrionContext(service: OrionContextService, vaultRoot: string, input: OrionContextInput): Promise<CallToolResult> {
  try {
    const response = await service.loadAgentContext({
      vaultRoot,
      query: input.query,
      focusPath: input.focusPath,
      scopePath: input.scopePath,
      tags: input.tags
    });

    if (response.status === 'error' || response.status === 'conflict') {
      return {
        content: [{ type: 'text', text: formatContextError(response) }],
        isError: true
      };
    }

    return {
      content: [{ type: 'text', text: formatAgentContext(response.data) }]
    };
  } catch {
    return {
      content: [{ type: 'text', text: 'Unable to load Orion Vault context.' }],
      isError: true
    };
  }
}

export async function executeOrionContext(input: OrionContextInput): Promise<CallToolResult> {
  try {
    const runtime = createAiBridgeRuntime();
    const response = await contextAcrossVaults(runtime.service, runtime.vaultRoots, input);
    return response.status === 'error' || response.status === 'conflict'
      ? { content: [{ type: 'text', text: formatContextError(response) }], isError: true }
      : { content: [{ type: 'text', text: formatAgentContext(response.data) }] };
  } catch {
    return {
      content: [{ type: 'text', text: 'Unable to load Orion Vault context.' }],
      isError: true
    };
  }
}

function formatAgentContext(data: AiBridgeAgentContextDataDto): string {
  const lines = [data.summaryText];

  if (data.focusPath) {
    lines.push('', `Focus: ${data.focusPath}`);
  }
  if (data.focusNote) {
    lines.push(`Focus title: ${data.focusNote.title ?? data.focusNote.path}`);
    if (data.focusNote.tags.length > 0) {
      lines.push(`Focus tags: ${data.focusNote.tags.join(', ')}`);
    }
  }
  if (data.relatedNotes.length > 0) {
    lines.push('', 'Related notes:');
    for (const note of data.relatedNotes) {
      lines.push(`- ${note.title} (${note.path}, ${note.intensity}, score ${note.score})`);
    }
  }
  if (data.relevantPaths.length > 0) {
    lines.push('', 'Relevant paths:', ...data.relevantPaths.map((item) => `- ${item}`));
  }
  if (data.supportingChunks.length > 0) {
    lines.push('', 'Supporting chunks:');
    for (const chunk of data.supportingChunks) {
      lines.push(`- ${chunk.path}${chunk.heading ? ` -> ${chunk.heading}` : ''}`);
      lines.push(`  ${chunk.snippet}`);
    }
  }

  lines.push('', `Retrieval mode: ${data.retrievalMode}`);
  if (data.budget) {
    lines.push(`Budget: ${data.budget.deliveredChunks}/${data.budget.maxChunks} chunks, ${data.budget.maxCharacters} characters`);
  }

  return lines.join('\n');
}

function formatContextError(response: AiBridgeResponseDto<AiBridgeAgentContextDataDto>): string {
  const issueLines = response.issues.map((issue) => `- ${issue.code}: ${issue.message}`);
  return [response.summary, ...issueLines].join('\n');
}
