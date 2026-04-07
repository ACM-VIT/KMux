import { useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '../../../store/useCanvasStore';
import { useTerminalRuntime } from '../../../terminal/renderer/context/useTerminalRuntime';
import type { RepoAction, RepoActionResult, RepoChangedFile, RepoSnapshot } from '../../shared/repo-types';

const REFRESH_INTERVAL_MS = 10000;

const createFallbackSnapshot = (message: string): RepoSnapshot => ({
  isRepo: false,
  repoRoot: null,
  repoName: null,
  branch: null,
  branches: [],
  headSha: null,
  remotes: [],
  status: {
    modified: 0,
    added: 0,
    deleted: 0,
    untracked: 0,
    conflicts: 0,
    ahead: 0,
    behind: 0,
  },
  changedFiles: [],
  tree: [],
  scannedAt: new Date().toISOString(),
  errorMessage: message,
});

const getStatusCode = (file: RepoChangedFile): string => {
  return file.status.padEnd(2, ' ');
};

const isConflictFile = (file: RepoChangedFile): boolean => {
  return getStatusCode(file).includes('U');
};

const isUntrackedFile = (file: RepoChangedFile): boolean => {
  return getStatusCode(file).includes('?');
};

export const inferFileActionState = (file: RepoChangedFile): {
  canStage: boolean;
  canUnstage: boolean;
  canDiscard: boolean;
} => {
  const code = getStatusCode(file);
  const indexCode = code[0];
  const workTreeCode = code[1];

  return {
    canStage: indexCode === '?' || workTreeCode === 'M' || workTreeCode === 'D' || workTreeCode === '?',
    canUnstage: indexCode === 'A' || indexCode === 'M' || indexCode === 'D',
    canDiscard: workTreeCode === 'M' || workTreeCode === 'D',
  };
};

export interface RepoFileGroups {
  tracked: RepoChangedFile[];
  untracked: RepoChangedFile[];
  conflicts: RepoChangedFile[];
}

export interface RepoDockState {
  activeCwd: string | undefined;
  snapshot: RepoSnapshot | null;
  isLoading: boolean;
  isRunningAction: boolean;
  actionFeedback: RepoActionResult | null;
  refreshSnapshot: () => Promise<void>;
  runAction: (
    action: RepoAction,
    options?: { filePath?: string; message?: string; branch?: string },
  ) => Promise<RepoActionResult | null>;
  fileGroups: RepoFileGroups;
}

export const useRepoDockState = (): RepoDockState => {
  const workspaces = useCanvasStore((state) => state.workspaces);
  const activeWorkspaceIndex = useCanvasStore((state) => state.activeWorkspaceIndex);
  const { sessions } = useTerminalRuntime();
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<RepoActionResult | null>(null);

  const activeWorkspace = workspaces[activeWorkspaceIndex];
  const activeTerminal = activeWorkspace?.terminals[activeWorkspace.activeTerminalIndex];
  const activeCwd = activeTerminal ? sessions[activeTerminal.id]?.cwd : undefined;

  const refreshSnapshot = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const nextSnapshot = await window.repoApi.getRepoSnapshot({ cwd: activeCwd });
      setSnapshot(nextSnapshot);
    } catch (error) {
      setSnapshot(createFallbackSnapshot(error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const guardedRefresh = async (): Promise<void> => {
      try {
        const nextSnapshot = await window.repoApi.getRepoSnapshot({ cwd: activeCwd });
        if (isMounted) {
          setSnapshot(nextSnapshot);
        }
      } catch (error) {
        if (isMounted) {
          setSnapshot(createFallbackSnapshot(error instanceof Error ? error.message : String(error)));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    setIsLoading(true);
    void guardedRefresh();
    const intervalId = window.setInterval(() => {
      void guardedRefresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [activeCwd]);

  const runAction = async (
    action: RepoAction,
    options?: { filePath?: string; message?: string; branch?: string },
  ): Promise<RepoActionResult | null> => {
    if (isRunningAction) {
      return null;
    }

    if (!activeCwd) {
      const missingSessionMessage = 'An active terminal session is required to run Git actions.';
      const fallbackResult = {
        ok: false,
        action,
        message: missingSessionMessage,
        output: '',
        snapshot: snapshot ?? createFallbackSnapshot(missingSessionMessage),
      } satisfies RepoActionResult;
      setActionFeedback(fallbackResult);
      return fallbackResult;
    }

    setIsRunningAction(true);
    try {
      const result = await window.repoApi.runAction({
        cwd: activeCwd,
        action,
        ...options,
      });
      setActionFeedback(result);
      setSnapshot(result.snapshot);
      return result;
    } catch (error) {
      const fallbackResult = {
        ok: false,
        action,
        message: error instanceof Error ? error.message : String(error),
        output: '',
        snapshot: snapshot ?? createFallbackSnapshot('Action failed'),
      } satisfies RepoActionResult;
      setActionFeedback(fallbackResult);
      return fallbackResult;
    } finally {
      setIsRunningAction(false);
    }
  };

  const fileGroups = useMemo<RepoFileGroups>(() => {
    const changedFiles = snapshot?.changedFiles ?? [];
    return {
      tracked: changedFiles.filter((file) => !isConflictFile(file) && !isUntrackedFile(file)),
      untracked: changedFiles.filter(isUntrackedFile),
      conflicts: changedFiles.filter(isConflictFile),
    };
  }, [snapshot?.changedFiles]);

  return {
    activeCwd,
    snapshot,
    isLoading,
    isRunningAction,
    actionFeedback,
    refreshSnapshot,
    runAction,
    fileGroups,
  };
};
