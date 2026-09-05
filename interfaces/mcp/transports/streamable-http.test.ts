import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import {
  ORION_MCP_HTTP_DEFAULT_HOST,
  ORION_MCP_HTTP_DEFAULT_PORT,
  ORION_MCP_HTTP_PATH,
  resolveOrionMcpHttpOptions,
  startOrionMcpHttpServer,
  type OrionMcpHttpServer
} from './streamable-http';

const acceptHeaders = {
  accept: 'application/json, text/event-stream',
  'content-type': 'application/json'
};

let running: OrionMcpHttpServer | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

async function startServer(): Promise<string> {
  running = await startOrionMcpHttpServer({ port: 0 });
  return `http://${running.host}:${running.port}${ORION_MCP_HTTP_PATH}`;
}

async function startTokenServer(): Promise<{ url: string; token: string }> {
  const token = 'test-mcp-http-token';
  running = await startOrionMcpHttpServer({ port: 0, token });
  return { url: `http://${running.host}:${running.port}${ORION_MCP_HTTP_PATH}`, token };
}

async function initialize(url: string): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: acceptHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'orion-http-test', version: '1.0.0' }
      }
    })
  });

  expect(response.status).toBe(200);
  expect((await response.json()).result.serverInfo.name).toBe('orion-vault');
  const sessionId = response.headers.get('mcp-session-id');
  expect(sessionId).toBeTruthy();
  return sessionId!;
}

async function initializeWithToken(url: string, token: string): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...acceptHeaders, authorization: `Bearer ${token}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'orion-http-test', version: '1.0.0' }
      }
    })
  });

  expect(response.status).toBe(200);
  const sessionId = response.headers.get('mcp-session-id');
  expect(sessionId).toBeTruthy();
  return sessionId!;
}

async function post(url: string, sessionId: string, body: object): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { ...acceptHeaders, 'mcp-session-id': sessionId, 'mcp-protocol-version': '2025-11-25' },
    body: JSON.stringify(body)
  });
}

async function postWithToken(url: string, sessionId: string, token: string, body: object): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      ...acceptHeaders,
      authorization: `Bearer ${token}`,
      'mcp-session-id': sessionId,
      'mcp-protocol-version': '2025-11-25'
    },
    body: JSON.stringify(body)
  });
}

async function connectOfficialClient(url: string, sessionId?: string): Promise<{
  client: Client;
  transport: StreamableHTTPClientTransport;
}> {
  const transport = new StreamableHTTPClientTransport(new URL(url), { sessionId });
  const client = new Client({ name: 'orion-http-e2e', version: '1.0.0' });
  await client.connect(transport);
  return { client, transport };
}

async function closeOfficialClient(client: Client, transport: StreamableHTTPClientTransport): Promise<void> {
  await transport.terminateSession();
  await client.close();
}

describe('Streamable HTTP MCP transport', () => {
  it('defaults to loopback and the documented port', () => {
    expect(resolveOrionMcpHttpOptions({})).toEqual({
      host: ORION_MCP_HTTP_DEFAULT_HOST,
      port: ORION_MCP_HTTP_DEFAULT_PORT,
      token: undefined
    });
  });

  it('requires a token for a non-loopback bind', async () => {
    running = await startOrionMcpHttpServer({ host: 'localhost', port: 0 });
    expect(running.host).toBe('localhost');
    await running.close();
    running = undefined;

    await expect(startOrionMcpHttpServer({ host: '0.0.0.0', port: 0 })).rejects.toThrow(
      'ORION_MCP_HTTP_TOKEN is required when binding MCP HTTP to a non-loopback host.'
    );
    running = await startOrionMcpHttpServer({ host: '0.0.0.0', port: 0, token: 'test-mcp-http-token' });
    expect(running.host).toBe('0.0.0.0');
  });

  it('requires a valid bearer token before looking up a session', async () => {
    const { url, token } = await startTokenServer();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const missing = await fetch(url, { method: 'POST', headers: acceptHeaders, body: '{}' });
    expect(missing.status).toBe(401);

    const invalid = await fetch(url, {
      method: 'POST',
      headers: { ...acceptHeaders, authorization: 'Bearer incorrect-token', 'mcp-session-id': 'invalid-session' },
      body: '{}'
    });
    expect(invalid.status).toBe(401);

    const sessionId = await initializeWithToken(url, token);
    const accepted = await postWithToken(url, sessionId, token, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(accepted.status).toBe(200);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('serves the MCP handshake, tool list, and ping through one session', async () => {
    const url = await startServer();
    const sessionId = await initialize(url);

    const initialized = await post(url, sessionId, { jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(initialized.status).toBe(202);

    const tools = await post(url, sessionId, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(tools.status).toBe(200);
    expect((await tools.json()).result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      'orion_context',
      'orion_ping',
      'orion_read',
      'orion_related',
      'orion_remember',
      'orion_search'
    ]);

    const ping = await post(url, sessionId, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'orion_ping', arguments: {} }
    });
    expect(ping.status).toBe(200);
    expect((await ping.json()).result.content).toEqual([{ type: 'text', text: 'Orion MCP online.' }]);
  });

  it('works end-to-end with the official Streamable HTTP client and isolates sessions', async () => {
    const url = await startServer();
    const first = await connectOfficialClient(url);
    const firstSessionId = first.transport.sessionId;

    expect(first.client.getNegotiatedProtocolVersion()).toBeTruthy();
    expect(firstSessionId).toBeTruthy();
    expect((await first.client.listTools()).tools.map((tool) => tool.name).sort()).toEqual([
      'orion_context',
      'orion_ping',
      'orion_read',
      'orion_related',
      'orion_remember',
      'orion_search'
    ]);
    expect(await first.client.callTool({ name: 'orion_ping', arguments: {} })).toMatchObject({
      content: [{ type: 'text', text: 'Orion MCP online.' }]
    });
    expect(await first.client.callTool({ name: 'orion_search', arguments: { query: 'orion-mcp-e2e' } })).toMatchObject({
      content: [{ type: 'text' }]
    });

    await closeOfficialClient(first.client, first.transport);
    const closedSession = await post(url, firstSessionId!, { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} });
    expect(closedSession.status).toBe(404);
    expect((await closedSession.json()).error.message).toBe('MCP session not found.');

    const second = await connectOfficialClient(url);
    try {
      expect(second.transport.sessionId).toBeTruthy();
      expect(second.transport.sessionId).not.toBe(firstSessionId);
    } finally {
      await closeOfficialClient(second.client, second.transport);
    }
  });

  it('rejects malformed MCP input and leaves unrelated endpoints unavailable', async () => {
    const url = await startServer();

    const invalid = await fetch(url, {
      method: 'POST',
      headers: acceptHeaders,
      body: 'not JSON'
    });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe(-32700);

    const missing = await fetch(url.replace(ORION_MCP_HTTP_PATH, '/search'));
    expect(missing.status).toBe(404);
    expect(missing.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('closes a session on DELETE and rejects later requests for its identifier', async () => {
    const url = await startServer();
    const sessionId = await initialize(url);

    const closed = await fetch(url, {
      method: 'DELETE',
      headers: { 'mcp-session-id': sessionId, 'mcp-protocol-version': '2025-11-25' }
    });
    expect(closed.status).toBe(200);

    const reused = await post(url, sessionId, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(reused.status).toBe(404);
    expect((await reused.json()).error.message).toBe('MCP session not found.');
  });

  it('rejects an invalid session identifier', async () => {
    const url = await startServer();
    const invalid = await post(url, 'invalid-session', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

    expect(invalid.status).toBe(404);
    expect((await invalid.json()).error.message).toBe('MCP session not found.');
  });
});
