export type OpenAiTerminal = (cwd: string, vaultRoot: string) => void;

export function createAiTerminalOpenHandler(options: {
  getActiveDesktopVaultRoot: () => string;
  openAiTerminal: OpenAiTerminal;
}): (_event: unknown, requestedVaultRoot?: string) => { cwd: string; vaultRoot: string } {
  const { getActiveDesktopVaultRoot, openAiTerminal } = options;

  return (_event: unknown, _requestedVaultRoot?: string) => {
    const vaultRoot = getActiveDesktopVaultRoot();
    if (!vaultRoot) {
      throw new Error('O fluxo padrao da IA exige um vault ativo antes de abrir o terminal.');
    }

    const cwd = vaultRoot;
    openAiTerminal(cwd, vaultRoot);
    return { cwd, vaultRoot };
  };
}
