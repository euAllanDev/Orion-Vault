export type OpenAiTerminal = (cwd: string, vaultRoot: string) => void;

export const linuxTerminalCandidates = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal'] as const;

export function selectLinuxTerminal(
  terminal: string | undefined,
  isExecutable: (command: string) => boolean
): string | null {
  const configured = String(terminal ?? '').trim();
  if (configured && !/\s/.test(configured) && isExecutable(configured)) {
    return configured;
  }

  return linuxTerminalCandidates.find(isExecutable) ?? null;
}

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
