import { describe, expect, it } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/server';
import { createOrionMcpServer, handleOrionPing, ORION_PING_TOOL, type OrionMcpRuntime } from './create-orion-mcp-server';

function registeredToolNames(server: McpServer): string[] {
  return Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools).sort();
}

describe('orion_ping', () => {
  it('returns the Orion MCP online response', async () => {
    await expect(handleOrionPing()).resolves.toEqual({
      content: [{ type: 'text', text: 'Orion MCP online.' }]
    });
    expect(ORION_PING_TOOL.description).toBe('Checks whether the Orion Vault MCP server is running.');
  });
});

describe('createOrionMcpServer', () => {
  it('creates a transport-independent server with every public Orion tool', () => {
    const server = createOrionMcpServer({} as OrionMcpRuntime);

    expect(registeredToolNames(server)).toEqual([
      'orion_context',
      'orion_ping',
      'orion_read',
      'orion_related',
      'orion_remember',
      'orion_search'
    ]);
  });
});
