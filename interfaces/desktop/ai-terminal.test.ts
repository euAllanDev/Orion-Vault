import { describe, expect, it, vi } from 'vitest';
import { createAiTerminalOpenHandler } from './ai-terminal';

describe('ai-terminal:open', () => {
  it('opens the requested vault root and returns it as cwd', () => {
    const openAiTerminal = vi.fn();
    const handler = createAiTerminalOpenHandler({
      appRoot: 'C:\\orion',
      getActiveDesktopVaultRoot: () => 'C:\\vault-active',
      openAiTerminal
    });

    const result = handler({}, 'C:\\vault-requested');

    expect(openAiTerminal).toHaveBeenCalledWith('C:\\vault-requested', 'C:\\vault-requested');
    expect(result).toEqual({
      cwd: 'C:\\vault-requested',
      vaultRoot: 'C:\\vault-requested'
    });
  });

  it('falls back to the active vault when no vault is requested', () => {
    const openAiTerminal = vi.fn();
    const handler = createAiTerminalOpenHandler({
      appRoot: 'C:\\orion',
      getActiveDesktopVaultRoot: () => 'C:\\vault-active',
      openAiTerminal
    });

    const result = handler({}, '   ');

    expect(openAiTerminal).toHaveBeenCalledWith('C:\\vault-active', 'C:\\vault-active');
    expect(result).toEqual({
      cwd: 'C:\\vault-active',
      vaultRoot: 'C:\\vault-active'
    });
  });

  it('rejects opening when there is no active vault', () => {
    const openAiTerminal = vi.fn();
    const handler = createAiTerminalOpenHandler({
      appRoot: 'C:\\orion',
      getActiveDesktopVaultRoot: () => '',
      openAiTerminal
    });

    expect(() => handler({}, undefined)).toThrowError('O fluxo padrao da IA exige um vault ativo antes de abrir o terminal.');
    expect(openAiTerminal).not.toHaveBeenCalled();
  });
});
