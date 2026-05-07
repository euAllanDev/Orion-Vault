import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { startWebServer } from '../web/server';

const desktopShell = {
  appName: 'Marika',
  title: 'Marika Desktop',
  defaultWindow: {
    width: 1400,
    height: 920,
    minWidth: 1120,
    minHeight: 760
  },
  shellType: 'electron',
  localFirst: true,
  internetRequired: false
} as const;

let mainWindow: BrowserWindow | null = null;
let webServer: Awaited<ReturnType<typeof startWebServer>>['server'] | null = null;
let desktopUrl = 'http://127.0.0.1:4173';

app.commandLine.appendSwitch('disable-http-cache');

function getDesktopSessionPath(): string {
  return path.join(app.getPath('userData'), 'desktop-session.json');
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: desktopShell.defaultWindow.width,
    height: desktopShell.defaultWindow.height,
    minWidth: desktopShell.defaultWindow.minWidth,
    minHeight: desktopShell.defaultWindow.minHeight,
    backgroundColor: '#141518',
    title: desktopShell.title,
    titleBarStyle: 'default',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadURL(desktopUrl).catch((error) => {
    console.error('Failed to load Marika desktop UI', error);
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

async function startDesktop(): Promise<void> {
  const sessionPath = getDesktopSessionPath();
  await session.defaultSession.clearCache();
  const started = await startWebServer(0, { desktopSessionPath: sessionPath });
  webServer = started.server;
  desktopUrl = `http://127.0.0.1:${started.port}`;
  mainWindow = createWindow();
}

app.setName(desktopShell.appName);

app.whenReady().then(() => {
  void startDesktop();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void webServer?.close();
    app.quit();
  }
});

export type DesktopShellConfig = typeof desktopShell;
