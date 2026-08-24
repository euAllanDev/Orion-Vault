import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { executeOrionContext, ORION_CONTEXT_TOOL } from './tools/orion-context';
import { executeOrionSearch, ORION_SEARCH_TOOL } from './tools/orion-search';

export const ORION_PING_TOOL = {
  description: 'Checks whether the Orion Vault MCP server is running.'
};

export async function handleOrionPing(): Promise<CallToolResult> {
  return {
    content: [{ type: 'text', text: 'Orion MCP online.' }]
  };
}

export function createOrionMcpServer(): McpServer {
  const server = new McpServer({ name: 'orion-vault', version: '0.1.1' });

  server.registerTool('orion_ping', ORION_PING_TOOL, handleOrionPing);
  server.registerTool('orion_search', ORION_SEARCH_TOOL, executeOrionSearch);
  server.registerTool('orion_context', ORION_CONTEXT_TOOL, executeOrionContext);

  return server;
}

export async function startOrionMcpServer(): Promise<void> {
  const server = createOrionMcpServer();
  await server.connect(new StdioServerTransport());
}

const entrypoint = process.argv[1];

if (entrypoint && import.meta.url === pathToFileURL(path.resolve(entrypoint)).href) {
  void startOrionMcpServer().catch((error: unknown) => {
    console.error('Failed to start Orion MCP server:', error);
    process.exitCode = 1;
  });
}
