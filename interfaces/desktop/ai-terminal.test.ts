import { describe, expect, it, vi } from 'vitest';
import { createAiTerminalOpenHandler, selectLinuxTerminal } from './ai-terminal';

describe('ai-terminal:open', () => {
  it('always opens active vault instead of accepting a renderer path', () => {
    const openAiTerminal = vi.fn();
    const handler = createAiTerminalOpenHandler({
      getActiveDesktopVaultRoot: () => 'C:\\vault-active',
      openAiTerminal
    });

    const result = handler({}, 'C:\\vault-requested');

    expect(openAiTerminal).toHaveBeenCalledWith('C:\\vault-active', 'C:\\vault-active');
    expect(result).toEqual({
      cwd: 'C:\\vault-active',
      vaultRoot: 'C:\\vault-active'
    });
  });

  it('falls back to the active vault when no vault is requested', () => {
    const openAiTerminal = vi.fn();
    const handler = createAiTerminalOpenHandler({
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
      getActiveDesktopVaultRoot: () => '',
      openAiTerminal
    });

    expect(() => handler({}, undefined)).toThrowError('O fluxo padrao da IA exige um vault ativo antes de abrir o terminal.');
    expect(openAiTerminal).not.toHaveBeenCalled();
  });
});

describe('Linux terminal selection', () => {
  it('prefers an executable configured in TERMINAL', () => {
    expect(selectLinuxTerminal('/usr/bin/custom-terminal', (command) => command === '/usr/bin/custom-terminal')).toBe('/usr/bin/custom-terminal');
  });

  it('uses the documented fallback order', () => {
    expect(selectLinuxTerminal(undefined, (command) => command === 'konsole')).toBe('konsole');
  });

  it('returns no terminal when none are available', () => {
    expect(selectLinuxTerminal(undefined, () => false)).toBeNull();
  });
});
