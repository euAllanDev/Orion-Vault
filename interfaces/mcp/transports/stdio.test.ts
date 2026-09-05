import { type StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { describe, expect, it, vi } from 'vitest';
import { startOrionMcpStdioServer } from './stdio';

describe('stdio MCP bootstrap', () => {
  it('connects the supplied server and writes no bootstrap output to stdout', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const stdoutWrite = vi.spyOn(process.stdout, 'write');

    await startOrionMcpStdioServer({ connect }, {} as StdioServerTransport);

    expect(connect).toHaveBeenCalledWith(expect.any(Object));
    expect(stdoutWrite).not.toHaveBeenCalled();
    stdoutWrite.mockRestore();
  });
});
