import type { IpcMain } from 'electron';
import {
  REPO_IPC_CHANNELS,
  assertGetRepoSnapshotRequest,
  assertRunRepoActionRequest,
} from '../shared/repo-ipc';
import { RepoManager } from './RepoManager';

interface RegisterRepoIpcOptions {
  ipcMain: IpcMain;
  repoManager: RepoManager;
}

export const registerRepoIpc = ({
  ipcMain,
  repoManager,
}: RegisterRepoIpcOptions): (() => void) => {
  ipcMain.handle(REPO_IPC_CHANNELS.snapshot, (_event, payload: unknown) => {
    assertGetRepoSnapshotRequest(payload);
    return repoManager.getSnapshot(payload?.cwd);
  });

  ipcMain.handle(REPO_IPC_CHANNELS.action, (_event, payload: unknown) => {
    assertRunRepoActionRequest(payload);
    return repoManager.runAction(payload);
  });

  return () => {
    ipcMain.removeHandler(REPO_IPC_CHANNELS.action);
    ipcMain.removeHandler(REPO_IPC_CHANNELS.snapshot);
  };
};
