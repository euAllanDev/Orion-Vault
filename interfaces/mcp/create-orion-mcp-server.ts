import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { createAiBridgeRuntime } from '../runtime/ai-bridge-runtime';
import { createOrionContextHandler, ORION_CONTEXT_TOOL } from './tools/orion-context';
import { createOrionSearchHandler, ORION_SEARCH_TOOL } from './tools/orion-search';
import { createOrionReadHandler, ORION_READ_TOOL } from './tools/orion-read';
import { createOrionRememberHandler, ORION_REMEMBER_TOOL } from './tools/orion-remember';

export const ORION_PING_TOOL = {
  description: 'Checks whether the Orion Vault MCP server is running.'
};

export type OrionMcpRuntime = ReturnType<typeof createAiBridgeRuntime>;

export async function handleOrionPing(): Promise<CallToolResult> {
  return {
    content: [{ type: 'text', text: 'Orion MCP online.' }]
  };
}

export function createOrionMcpServer(runtime: OrionMcpRuntime = createAiBridgeRuntime()): McpServer {
  const server = new McpServer({ name: 'orion-vault', version: '0.1.1' });

  server.registerTool('orion_ping', ORION_PING_TOOL, handleOrionPing);
  server.registerTool('orion_search', ORION_SEARCH_TOOL, createOrionSearchHandler(runtime));
  server.registerTool('orion_context', ORION_CONTEXT_TOOL, createOrionContextHandler(runtime));
  server.registerTool('orion_read', ORION_READ_TOOL, createOrionReadHandler(runtime));
  server.registerTool('orion_remember', ORION_REMEMBER_TOOL, createOrionRememberHandler(runtime));

  return server;
}
