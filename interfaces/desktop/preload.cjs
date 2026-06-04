const { contextBridge, ipcRenderer } = require('electron');

function playAgendaReminderSound(soundUrl) {
  const source = String(soundUrl || '').trim();
  if (!source) return;

  const audio = new Audio(source);
  audio.volume = 1;
  void audio.play().catch(() => {
    // Autoplay is allowed by the Electron policy, but we keep a safe fallback.
  });
}

ipcRenderer.on('agenda:notify-sound', (_event, payload) => {
  playAgendaReminderSound(payload.src);
});

contextBridge.exposeInMainWorld('orionDesktop', {
  openAiTerminal: (cwd) => ipcRenderer.invoke('ai-terminal:open', cwd),
  startupView: 'workspace',
  startVaultSetup: () => ipcRenderer.invoke('desktop:setup:start'),
  setActiveVaultRoot: (vaultRoot) => ipcRenderer.invoke('vault:activate', vaultRoot),
  playAgendaReminderSound: () => ipcRenderer.invoke('agenda:play-sound'),
  notifyAgendaReminder: (payload) => ipcRenderer.invoke('agenda:notify', payload),
  createAgendaNote: (payload) => ipcRenderer.invoke('agenda:create', payload),
  markDesktopReady: () => ipcRenderer.send('desktop:ready'),
  onAgendaSaved: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('agenda:saved', listener);
    return () => ipcRenderer.removeListener('agenda:saved', listener);
  },
  onVaultChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('vault:changed', listener);
    return () => ipcRenderer.removeListener('vault:changed', listener);
  },
  onOpenAgendaFromNotification: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('agenda:open-from-notification', listener);
    return () => ipcRenderer.removeListener('agenda:open-from-notification', listener);
  },
  onAgendaNotification: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('agenda:notify-ui', listener);
    return () => ipcRenderer.removeListener('agenda:notify-ui', listener);
  }
});
