import { fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import type { RememberKnowledgeInputDto, RememberKnowledgeResultDto } from '../../../application/dto/remember-knowledge.dto';
import { RememberKnowledgeError } from '../../../application/use-cases/remember-knowledge/remember-knowledge.use-case';
import { createAiBridgeRuntime } from '../../runtime/ai-bridge-runtime';

export const ORION_REMEMBER_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    content: { type: 'string', minLength: 1, pattern: '\\S' },
    subject: { type: 'string' },
    project: { type: 'string' },
    kind: { type: 'string' }
  },
  required: ['content'],
  additionalProperties: false
} as const;

export const ORION_REMEMBER_TOOL = {
  description: 'Saves explicitly provided knowledge in the configured Orion write target.',
  inputSchema: fromJsonSchema<OrionRememberInput>(ORION_REMEMBER_INPUT_SCHEMA)
};

export interface OrionRememberInput extends RememberKnowledgeInputDto {}

export interface OrionRememberService {
  execute(input: RememberKnowledgeInputDto): Promise<RememberKnowledgeResultDto>;
}

export async function handleOrionRemember(service: OrionRememberService, input: OrionRememberInput): Promise<CallToolResult> {
  try {
    return formatRememberResult(await service.execute(input));
  } catch (error: unknown) {
    if (error instanceof RememberKnowledgeError) {
      return formatRememberError(error);
    }
    return {
      content: [{ type: 'text', text: 'Unable to save knowledge in Orion.' }],
      isError: true
    };
  }
}

export async function executeOrionRemember(input: OrionRememberInput): Promise<CallToolResult> {
  const runtime = createAiBridgeRuntime();
  return handleOrionRemember(runtime.rememberService, input);
}

function formatRememberResult(result: RememberKnowledgeResultDto): CallToolResult {
  if (result.action === 'noop') {
    return {
      content: [{ type: 'text', text: [
        'Orion already contains equivalent knowledge.',
        '',
        'Action: noop',
        `Reason: ${result.reason}`,
        `Note: ${result.note}`,
        `Summary: ${result.summary}`
      ].join('\n') }]
    };
  }

  if (result.action === 'created' || result.action === 'appended') {
    return {
      content: [{ type: 'text', text: [
        'Saved to Orion.',
        '',
        `Action: ${result.action}`,
        `Note: ${result.note}`,
        `Summary: ${result.summary}`,
        `Source: ${result.source}`
      ].join('\n') }]
    };
  }

  if (result.action === 'conflict') {
    const lines = [
      'Orion could not safely save this yet.',
      '',
      'Action: conflict',
      `Reason: ${result.reason}`
    ];
    if (result.candidates?.length) {
      lines.push('Candidates:', ...result.candidates.map((candidate) => `- ${candidate}`));
    }
    lines.push(`Next step: ${result.nextStep}`);
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  throw new Error('Unsupported remember result.');
}

function formatRememberError(error: RememberKnowledgeError): CallToolResult {
  const text = error.code === 'WRITE_TARGET_NOT_CONFIGURED'
    ? 'Orion write target is not configured.'
    : error.code === 'WRITE_TARGET_NOT_READ_SOURCE'
      ? 'Orion write target configuration is invalid.'
      : 'Remember content must not be empty.';
  return { content: [{ type: 'text', text }], isError: true };
}
