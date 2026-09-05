import { fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import { OrionKnowledgeFacade } from '../../../application/services/orion-knowledge-facade';
import { createOrionMcpError } from '../tool-error';

export const ORION_RELATED_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    sourceRef: { type: 'string', minLength: 1, pattern: '\\S' }
  },
  required: ['sourceRef'],
  additionalProperties: false
} as const;

export const ORION_RELATED_TOOL = {
  description: 'Finds notes related to one Orion sourceRef within its originating Vault.',
  inputSchema: fromJsonSchema<OrionRelatedInput>(ORION_RELATED_INPUT_SCHEMA)
};

export interface OrionRelatedInput {
  readonly sourceRef: string;
}

export interface OrionRelatedRuntime {
  readonly knowledge: OrionKnowledgeFacade;
}

export function createOrionRelatedHandler(runtime: OrionRelatedRuntime): (input: OrionRelatedInput) => Promise<CallToolResult> {
  return async (input) => {
    if (typeof input.sourceRef !== 'string' || !input.sourceRef.trim()) {
      return createOrionMcpError('INVALID_INPUT', 'Related input requires a non-whitespace Orion sourceRef.');
    }

    try {
      const result = await runtime.knowledge.related(input.sourceRef.trim());
      if (result.status === 'not-found') {
        return createOrionMcpError('NOT_FOUND', 'No Orion source was found for the supplied sourceRef.');
      }
      if (result.status === 'vault-unavailable') {
        return createOrionMcpError('VAULT_UNAVAILABLE', 'The Orion Vault for the supplied sourceRef could not be read.');
      }
      return { content: [{ type: 'text', text: formatRelatedNotes(result.results) }] };
    } catch {
      return createOrionMcpError('INTERNAL_ERROR', 'Unable to find related Orion notes.');
    }
  };
}

function formatRelatedNotes(results: Awaited<ReturnType<OrionKnowledgeFacade['related']>>['results']): string {
  if (results.length === 0) return 'No related Orion notes were found.';

  const lines = [`Found ${results.length} related Orion note(s).`];
  for (const [index, note] of results.entries()) {
    lines.push('', `${index + 1}. ${note.title}`, `Path: ${note.path}`, `Source ref: ${note.sourceRef}`, `Relationship: ${note.kind}`, `Score: ${note.score}`);
  }
  return lines.join('\n');
}
