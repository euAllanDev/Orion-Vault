import { randomUUID, timingSafeEqual } from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { WebStandardStreamableHTTPServerTransport, type McpServer } from '@modelcontextprotocol/server';
import { createOrionMcpServer } from '../create-orion-mcp-server';

export const ORION_MCP_HTTP_DEFAULT_HOST = '127.0.0.1';
export const ORION_MCP_HTTP_DEFAULT_PORT = 7331;
export const ORION_MCP_HTTP_PATH = '/mcp';

export interface OrionMcpHttpOptions {
  readonly host?: string;
  readonly port?: number;
  readonly token?: string;
  readonly createServer?: () => McpServer;
}

export interface OrionMcpHttpServer {
  readonly server: http.Server;
  readonly host: string;
  readonly port: number;
  close(): Promise<void>;
}

interface OrionMcpHttpSession {
  readonly server: McpServer;
  readonly transport: WebStandardStreamableHTTPServerTransport;
}

function resolveHost(value: string | undefined): string {
  return value?.trim() || ORION_MCP_HTTP_DEFAULT_HOST;
}

function resolveToken(value: string | undefined): string | undefined {
  const token = value?.trim();
  return token || undefined;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '::1' || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

function tokensMatch(expected: string, authorization: string | undefined): boolean {
  if (!authorization?.startsWith('Bearer ')) return false;

  const received = Buffer.from(authorization.slice('Bearer '.length), 'utf8');
  const configured = Buffer.from(expected, 'utf8');
  return received.length === configured.length && timingSafeEqual(received, configured);
}

function resolvePort(value: string | undefined): number {
  if (!value?.trim()) return ORION_MCP_HTTP_DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('ORION_MCP_HTTP_PORT must be an integer between 1 and 65535.');
  }
  return port;
}

export function resolveOrionMcpHttpOptions(env: NodeJS.ProcessEnv = process.env): Required<Pick<OrionMcpHttpOptions, 'host' | 'port'>> & Pick<OrionMcpHttpOptions, 'token'> {
  return {
    host: resolveHost(env.ORION_MCP_HTTP_HOST),
    port: resolvePort(env.ORION_MCP_HTTP_PORT),
    token: resolveToken(env.ORION_MCP_HTTP_TOKEN)
  };
}

function toWebRequest(request: IncomingMessage, host: string, port: number): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }

  const method = request.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  return new Request(`http://${host}:${port}${request.url ?? '/'}`, {
    method,
    headers,
    body: hasBody ? Readable.toWeb(request) as ReadableStream : undefined,
    duplex: hasBody ? 'half' : undefined
  } as RequestInit);
}

async function writeWebResponse(response: ServerResponse, webResponse: Response): Promise<void> {
  response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
  if (!webResponse.body) {
    response.end();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const body = Readable.fromWeb(webResponse.body as ReadableStream);
    body.once('error', reject);
    response.once('error', reject);
    response.once('finish', resolve);
    body.pipe(response);
  });
}

function writeJsonRpcError(response: ServerResponse, status: number, code: number, message: string): void {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}

export async function startOrionMcpHttpServer(options: OrionMcpHttpOptions = {}): Promise<OrionMcpHttpServer> {
  const configured = resolveOrionMcpHttpOptions();
  const host = resolveHost(options.host ?? configured.host);
  const requestedPort = options.port ?? configured.port;
  const token = resolveToken(options.token ?? configured.token);
  if (!isLoopbackHost(host) && !token) {
    throw new Error('ORION_MCP_HTTP_TOKEN is required when binding MCP HTTP to a non-loopback host.');
  }
  const sessions = new Map<string, OrionMcpHttpSession>();
  const createServer = options.createServer ?? createOrionMcpServer;
  let boundPort = requestedPort;

  const closeSession = async (sessionId: string): Promise<void> => {
    const session = sessions.get(sessionId);
    if (!session) return;
    sessions.delete(sessionId);
    await session.server.close();
  };

  const httpServer = http.createServer(async (request, response) => {
    try {
      if (new URL(request.url ?? '/', `http://${host}:${boundPort}`).pathname !== ORION_MCP_HTTP_PATH) {
        response.writeHead(404);
        response.end();
        return;
      }

      if (token && !tokensMatch(token, request.headers.authorization)) {
        writeJsonRpcError(response, 401, -32000, 'Unauthorized.');
        return;
      }

      const sessionId = request.headers['mcp-session-id'];
      if (Array.isArray(sessionId)) {
        writeJsonRpcError(response, 400, -32600, 'Invalid MCP session ID.');
        return;
      }

      let session = sessionId ? sessions.get(sessionId) : undefined;
      if (sessionId && !session) {
        writeJsonRpcError(response, 404, -32001, 'MCP session not found.');
        return;
      }

      if (!session) {
        const server = createServer();
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          enableJsonResponse: true,
          allowedHosts: [`${host}:${boundPort}`],
          allowedOrigins: [`http://${host}:${boundPort}`],
          enableDnsRebindingProtection: true,
          onsessioninitialized: (id) => {
            sessions.set(id, { server, transport });
          },
          onsessionclosed: closeSession
        });
        transport.onerror = (error) => console.error('Orion MCP HTTP transport error:', error.message);
        await server.connect(transport);
        session = { server, transport };
      }

      const webResponse = await session.transport.handleRequest(toWebRequest(request, host, boundPort));
      await writeWebResponse(response, webResponse);

      if (!session.transport.sessionId) {
        await session.server.close();
        await session.transport.close();
      }
    } catch (error) {
      console.error('Orion MCP HTTP request failed:', error instanceof Error ? error.message : 'Unknown error');
      if (!response.headersSent) writeJsonRpcError(response, 500, -32603, 'Internal server error.');
      else response.destroy();
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(requestedPort, host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const address = httpServer.address();
  boundPort = typeof address === 'object' && address ? address.port : requestedPort;

  return {
    server: httpServer,
    host,
    port: boundPort,
    async close(): Promise<void> {
      await Promise.all([...sessions.keys()].map(closeSession));
      await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    }
  };
}
