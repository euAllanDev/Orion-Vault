import { fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import type {
  AiBridgeAgentContextDataDto,
  AiBridgeAgentContextRequestDto,
  AiBridgeResponseDto
} from '../../../application/dto/ai-bridge.dto';
import { OrionKnowledgeFacade } from '../../../application/services/orion-knowledge-facade';
import { OrionSourceRegistry } from '../../../application/services/orion-source-registry';
import type { OrionMultiVaultService } from '../orion-multi-vault';
import { classifyOrionMcpFailure, createOrionMcpError } from '../tool-error';
import type { MultiVaultContextData } from '../orion-multi-vault';

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

export interface OrionContextRuntime {
  readonly service: OrionMultiVaultService;
  readonly vaultRoots: readonly string[];
  readonly sourceRegistry?: OrionSourceRegistry;
  readonly facade?: OrionKnowledgeFacade;
  readonly knowledge?: OrionKnowledgeFacade;
  readonly noteSource?: import('../../../application/ports/note-source.port').NoteSourcePort;
}

export async function handleOrionContext(service: OrionContextService, vaultRoot: string, input: OrionContextInput): Promise<CallToolResult> {
  if (!hasValidContextInput(input)) {
    return createOrionMcpError('INVALID_INPUT', 'Context input must contain only strings and string tags.');
  }

  try {
    const response = await service.loadAgentContext({
      vaultRoot,
      query: input.query,
      focusPath: input.focusPath,
      scopePath: input.scopePath,
      tags: input.tags
    });

    if (response.status === 'error' || response.status === 'conflict') {
      return createOrionMcpError(classifyOrionMcpFailure(response), 'Unable to load Orion Vault context.');
    }

    return {
      content: [{ type: 'text', text: formatAgentContext(response.data) }]
    };
  } catch {
    return createOrionMcpError('INTERNAL_ERROR', 'Unable to load Orion Vault context.');
  }
}

export function createOrionContextHandler(runtime: OrionContextRuntime): (input: OrionContextInput) => Promise<CallToolResult> {
  return async (input) => {
    if (!hasValidContextInput(input)) {
      return createOrionMcpError('INVALID_INPUT', 'Context input must contain only strings and string tags.');
    }

    try {
      const facade = runtime.knowledge ?? runtime.facade ?? new OrionKnowledgeFacade({
        service: runtime.service,
        noteSource: runtime.noteSource ?? { getNote: async () => null, listNotes: async () => [] },
        vaultRoots: runtime.vaultRoots,
        sourceRegistry: runtime.sourceRegistry ?? new OrionSourceRegistry()
      });
      const response = await facade.context(input);
      return response.status === 'error' || response.status === 'conflict'
        ? createOrionMcpError(classifyOrionMcpFailure(response), 'Unable to load Orion Vault context.')
        : { content: [{ type: 'text', text: formatAgentContext(response.data) }] };
    } catch {
      return createOrionMcpError('INTERNAL_ERROR', 'Unable to load Orion Vault context.');
    }
  };
}

function formatAgentContext(data: AiBridgeAgentContextDataDto | MultiVaultContextData): string {
  const lines = [data.summaryText];

  if (data.focusPath) {
    lines.push('', `Focus: ${data.focusPath}`);
    if ('focusSourceRef' in data && data.focusSourceRef) lines.push(`Focus source ref: ${data.focusSourceRef}`);
  }
  if (data.focusNote) {
    lines.push(`Focus title: ${data.focusNote.title ?? data.focusNote.path}`);
    if (data.focusNote.tags.length > 0) {
      lines.push(`Focus tags: ${data.focusNote.tags.join(', ')}`);
    }
  }
  if (data.relatedNotes.length > 0) {
    lines.push('', 'Related notes:');
    for (const [index, note] of data.relatedNotes.entries()) {
      lines.push(`- ${note.title} (${note.path}, ${note.intensity}, score ${note.score})`);
      if ('relatedNoteSourceRefs' in data && data.relatedNoteSourceRefs[index]) lines.push(`  Source ref: ${data.relatedNoteSourceRefs[index]}`);
    }
  }
  if (data.relevantPaths.length > 0) {
    lines.push('', 'Relevant paths:', ...data.relevantPaths.map((item) => `- ${item}`));
  }
  if (data.supportingChunks.length > 0) {
    lines.push('', 'Supporting chunks:');
    for (const chunk of data.supportingChunks) {
      lines.push(`- ${chunk.path}${chunk.heading ? ` -> ${chunk.heading}` : ''}`);
      if ('sourceRef' in chunk && chunk.sourceRef) lines.push(`  Source ref: ${chunk.sourceRef}`);
      lines.push(`  ${chunk.snippet}`);
    }
  }

  lines.push('', `Retrieval mode: ${data.retrievalMode}`);
  if (data.budget) {
    lines.push(`Budget: ${data.budget.deliveredChunks}/${data.budget.maxChunks} chunks, ${data.budget.maxCharacters} characters`);
  }

  return lines.join('\n');
}

function hasValidContextInput(input: OrionContextInput): boolean {
  const values = [input.query, input.focusPath, input.scopePath];
  return values.every((value) => value === undefined || typeof value === 'string') &&
    (input.tags === undefined || (Array.isArray(input.tags) && input.tags.every((tag) => typeof tag === 'string')));
}
