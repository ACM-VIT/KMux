import type { BrowserWindow, IpcMain } from 'electron';
import {
  TERMINAL_IPC_CHANNELS,
  assertCreateTerminalRequest,
  assertGetTerminalGitStatusRequest,
  assertKillTerminalRequest,
  assertResizeTerminalRequest,
  assertWriteTerminalRequest,
} from '../shared/terminal-ipc';
import type {
  TerminalErrorEvent,
  TerminalExitEvent,
  TerminalOutputEvent,
  TerminalStateEvent,
} from '../shared/terminal-types';
import { TerminalManager } from './TerminalManager';

interface RegisterTerminalIpcOptions {
  ipcMain: IpcMain;
  getWindows: () => BrowserWindow[];
  terminalManager: TerminalManager;
}

const broadcastToWindows = <T>(
  windows: BrowserWindow[],
  channel: string,
  payload: T,
): void => {
  for (const window of windows) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      continue;
    }
    window.webContents.send(channel, payload);
  }
};

export const registerTerminalIpc = ({
  ipcMain,
  getWindows,
  terminalManager,
}: RegisterTerminalIpcOptions): (() => void) => {
  ipcMain.handle(TERMINAL_IPC_CHANNELS.create, (_event, payload: unknown) => {
    assertCreateTerminalRequest(payload);
    return terminalManager.createTerminal(payload);
  });

  ipcMain.handle(TERMINAL_IPC_CHANNELS.write, (_event, payload: unknown) => {
    assertWriteTerminalRequest(payload);
    terminalManager.writeTerminal(payload);
  });

  ipcMain.handle(TERMINAL_IPC_CHANNELS.resize, (_event, payload: unknown) => {
    assertResizeTerminalRequest(payload);
    terminalManager.resizeTerminal(payload);
  });

  ipcMain.handle(TERMINAL_IPC_CHANNELS.kill, (_event, payload: unknown) => {
    assertKillTerminalRequest(payload);
    terminalManager.killTerminal(payload);
  });

  ipcMain.handle(TERMINAL_IPC_CHANNELS.list, () => {
    return terminalManager.listTerminals();
  });

  ipcMain.handle(TERMINAL_IPC_CHANNELS.listProfiles, () => {
    return terminalManager.listProfiles();
  });

  ipcMain.handle(TERMINAL_IPC_CHANNELS.gitStatus, (_event, payload: unknown) => {
    assertGetTerminalGitStatusRequest(payload);
    return terminalManager.getTerminalGitStatus(payload);
  });

  const detachOutput = terminalManager.onOutput((event: TerminalOutputEvent) => {
    broadcastToWindows(getWindows(), TERMINAL_IPC_CHANNELS.output, event);
  });
  const detachExit = terminalManager.onExit((event: TerminalExitEvent) => {
    broadcastToWindows(getWindows(), TERMINAL_IPC_CHANNELS.exit, event);
  });
  const detachState = terminalManager.onState((event: TerminalStateEvent) => {
    broadcastToWindows(getWindows(), TERMINAL_IPC_CHANNELS.state, event);
  });
  const detachError = terminalManager.onError((event: TerminalErrorEvent) => {
    broadcastToWindows(getWindows(), TERMINAL_IPC_CHANNELS.error, event);
  });

  return () => {
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.create);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.write);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.resize);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.kill);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.list);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.listProfiles);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.gitStatus);

    detachOutput();
    detachExit();
    detachState();
    detachError();
  };
};
