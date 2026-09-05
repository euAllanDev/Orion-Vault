import type { CallToolResult } from '@modelcontextprotocol/server';
import type { AiBridgeResponseDto } from '../../application/dto/ai-bridge.dto';

export type OrionMcpErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'VAULT_UNAVAILABLE' | 'INTERNAL_ERROR';

export function createOrionMcpError(code: OrionMcpErrorCode, message: string): CallToolResult {
  return { content: [{ type: 'text', text: `${code}: ${message}` }], isError: true };
}

export function classifyOrionMcpFailure(response: AiBridgeResponseDto<unknown>): OrionMcpErrorCode {
  return response.issues.some((issue) => ['ORION_VAULT_UNAVAILABLE', 'VAULT_UNAVAILABLE', 'VAULT_ERROR'].includes(issue.code))
    ? 'VAULT_UNAVAILABLE'
    : 'INTERNAL_ERROR';
}
