import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startOrionMcpStdioServer } from './transports/stdio';

export { createOrionMcpServer, handleOrionPing, ORION_PING_TOOL } from './create-orion-mcp-server';
export { startOrionMcpStdioServer as startOrionMcpServer } from './transports/stdio';

const entrypoint = process.argv[1];

if (entrypoint && import.meta.url === pathToFileURL(path.resolve(entrypoint)).href) {
  void startOrionMcpStdioServer().catch((error: unknown) => {
    console.error('Failed to start Orion MCP server:', error);
    process.exitCode = 1;
  });
}
