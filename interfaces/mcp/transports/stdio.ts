import { type McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createOrionMcpServer } from '../create-orion-mcp-server';

type ConnectableMcpServer = Pick<McpServer, 'connect'>;

export async function startOrionMcpStdioServer(
  server: ConnectableMcpServer = createOrionMcpServer(),
  transport: StdioServerTransport = new StdioServerTransport()
): Promise<void> {
  await server.connect(transport);
}
