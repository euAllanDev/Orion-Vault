import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('marikaDesktop', {
  openAiTerminal: (cwd?: string) => ipcRenderer.invoke('ai-terminal:open', cwd)
});
