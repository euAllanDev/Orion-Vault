import { app, BrowserWindow, ipcMain, session } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const preloadPath = fileURLToPath(new URL('./preload.cjs', import.meta.url));

let mainWindow: BrowserWindow | null = null;
let webServer: Awaited<ReturnType<typeof startWebServer>>['server'] | null = null;
let desktopUrl = 'http://127.0.0.1:4173';
const appRoot = path.resolve(process.cwd());

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
      nodeIntegration: false,
      preload: preloadPath
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

function openPowerShellInDirectory(cwd: string, vaultRoot: string): void {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  const powerShellPath = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const startupScript = path.join(appRoot, 'scripts', 'start-ai-terminal.ps1');
  const wtCommand = ['new-tab', '--title', 'Marika AI', '--startingDirectory', appRoot, 'powershell.exe', '-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', startupScript, '-AppRoot', appRoot, '-VaultRoot', vaultRoot];
  const env = { ...process.env, MARIKA_VAULT_ROOT: vaultRoot };

  const tryWindowsTerminal = (): boolean => {
    try {
      const wt = spawn('wt.exe', wtCommand, {
        cwd,
        env,
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });

      wt.on('error', (error) => {
        console.error('Failed to open AI terminal with wt.exe', error);
      });

      wt.unref();
      return true;
    } catch (error) {
      console.error('Failed to spawn wt.exe', error);
      return false;
    }
  };

  const tryPowerShell = (): boolean => {
    try {
      const child = spawn(powerShellPath, ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', startupScript, '-AppRoot', appRoot, '-VaultRoot', vaultRoot], {
        cwd,
        env,
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });

      child.on('error', (error) => {
        console.error('Failed to open AI terminal', error);
      });

      child.unref();
      return true;
    } catch (error) {
      console.error('Failed to spawn PowerShell', error);
      return false;
    }
  };

  if (!tryWindowsTerminal()) {
    void tryPowerShell();
  }
}

ipcMain.handle('ai-terminal:open', (_event, requestedVaultRoot?: string) => {
  const vaultRoot = requestedVaultRoot && requestedVaultRoot.trim() ? path.resolve(requestedVaultRoot) : appRoot;
  openPowerShellInDirectory(appRoot, vaultRoot);
  return { cwd: appRoot, vaultRoot };
});

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
