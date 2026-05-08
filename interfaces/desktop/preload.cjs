const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marikaDesktop', {
  openAiTerminal: (cwd) => ipcRenderer.invoke('ai-terminal:open', cwd)
});
