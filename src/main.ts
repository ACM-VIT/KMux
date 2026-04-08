import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { mainWindowConfig, shouldOpenDevTools } from './config/window';
import { RepoManager } from './repo/main/RepoManager';
import { registerRepoIpc } from './repo/main/registerRepoIpc';
import { TerminalManager } from './terminal/main/TerminalManager';
import { registerTerminalIpc } from './terminal/main/registerTerminalIpc';

if (started) {
  app.quit();
}

const terminalManager = new TerminalManager();
const repoManager = new RepoManager();
const unregisterTerminalIpc = registerTerminalIpc({
  ipcMain,
  getWindows: () => BrowserWindow.getAllWindows(),
  terminalManager,
});
const unregisterRepoIpc = registerRepoIpc({
  ipcMain,
  repoManager,
});

const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    ...mainWindowConfig,
    webPreferences: {
      ...mainWindowConfig.webPreferences,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.setMenu(null);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (shouldOpenDevTools(MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return mainWindow;
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    terminalManager.killAll();
    app.quit();
  }
});

app.on('before-quit', () => {
  unregisterRepoIpc();
  unregisterTerminalIpc();
  terminalManager.killAll();
});
