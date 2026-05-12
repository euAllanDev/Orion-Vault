import { contextBridge, ipcRenderer } from 'electron';

function playAgendaReminderSound(soundUrl: string) {
  const source = soundUrl.trim();
  if (!source) return;

  const audio = new Audio(source);
  audio.volume = 1;
  void audio.play().catch(() => {
    // Autoplay is allowed by the Electron policy, but we keep a safe fallback.
  });
}

ipcRenderer.on('agenda:notify-sound', (_event: Electron.IpcRendererEvent, payload: { src: string }) => {
  playAgendaReminderSound(payload.src);
});

contextBridge.exposeInMainWorld('marikaDesktop', {
  openAiTerminal: (cwd?: string) => ipcRenderer.invoke('ai-terminal:open', cwd),
  startupView: 'workspace',
  startVaultSetup: () => ipcRenderer.invoke('desktop:setup:start'),
  setActiveVaultRoot: (vaultRoot: string) => ipcRenderer.invoke('vault:activate', vaultRoot),
  playAgendaReminderSound: () => ipcRenderer.invoke('agenda:play-sound'),
  notifyAgendaReminder: (payload: { title: string; body: string }) => ipcRenderer.invoke('agenda:notify', payload),
  createAgendaNote: (payload: { vaultRoot: string; path: string; content: string }) => ipcRenderer.invoke('agenda:create', payload),
  markDesktopReady: () => ipcRenderer.send('desktop:ready'),
  onAgendaSaved: (callback: (payload: { vaultRoot: string; path: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { vaultRoot: string; path: string }) => callback(payload);
    ipcRenderer.on('agenda:saved', listener);
    return () => ipcRenderer.removeListener('agenda:saved', listener);
  },
  onVaultChanged: (callback: (payload: { vaultRoot: string; path?: string; kind?: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { vaultRoot: string; path?: string; kind?: string }) => callback(payload);
    ipcRenderer.on('vault:changed', listener);
    return () => ipcRenderer.removeListener('vault:changed', listener);
  }
});
