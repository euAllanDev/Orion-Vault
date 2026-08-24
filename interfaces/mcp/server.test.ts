import { describe, expect, it } from 'vitest';
import { handleOrionPing, ORION_PING_TOOL } from './server';

describe('orion_ping', () => {
  it('returns the Orion MCP online response', async () => {
    await expect(handleOrionPing()).resolves.toEqual({
      content: [{ type: 'text', text: 'Orion MCP online.' }]
    });
    expect(ORION_PING_TOOL.description).toBe('Checks whether the Orion Vault MCP server is running.');
  });
});
