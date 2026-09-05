import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startOrionMcpHttpServer } from './transports/streamable-http';

export { startOrionMcpHttpServer } from './transports/streamable-http';

const entrypoint = process.argv[1];

if (entrypoint && import.meta.url === pathToFileURL(path.resolve(entrypoint)).href) {
  void startOrionMcpHttpServer().then(({ host, port }) => {
    console.error(`Orion MCP HTTP listening on http://${host}:${port}/mcp`);
  }).catch((error: unknown) => {
    console.error('Failed to start Orion MCP HTTP server:', error);
    process.exitCode = 1;
  });
}
