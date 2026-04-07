import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Terminal as XtermTerminal } from '@xterm/xterm';
import { useCanvasStore } from '../../../store/useCanvasStore';
import type { TerminalGitStatus, TerminalSessionSnapshot } from '../../shared/terminal-types';
import { useTerminalRuntime } from '../context/useTerminalRuntime';
import { observeTerminalSize } from '../utils/terminalSizing';
import { createXterm } from '../xterm/createXterm';
import { toXtermTheme } from '../xterm/terminalTheme';

interface Props {
  terminalId: string;
  isActive: boolean;
}

const GIT_STATUS_TRIGGER_DELAY_MS = 250;
const shouldTriggerGitStatusRefresh = (chunk: string): boolean => {
  if (chunk.includes('\n') || chunk.includes('\r')) {
    return true;
  }

  const trimmedChunk = chunk.trimEnd();
  return (
    trimmedChunk.endsWith('>') ||
    trimmedChunk.endsWith('$') ||
    trimmedChunk.endsWith('#') ||
    trimmedChunk.endsWith('%')
  );
};

const getStatusLabel = (
  session: TerminalSessionSnapshot | undefined,
  gitStatus: TerminalGitStatus | null,
): string => {
  if (!session) return 'starting...';
  if (session.status === 'running') {
    if (!gitStatus?.branchName) {
      return '';
    }
    return `${gitStatus.branchName}${gitStatus.isDirty ? '*' : ''}`;
  }
  if (session.status === 'exited') return `exited (${session.exitCode ?? 0})`;
  if (session.status === 'error') return session.errorMessage ?? 'failed to start';
  return 'starting...';
};

export const TerminalViewport: React.FC<Props> = ({ terminalId, isActive }) => {
  const theme = useCanvasStore((state) => state.theme);
  const { sessions, registerOutputSink, writeTerminal, resizeTerminal } = useTerminalRuntime();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XtermTerminal | null>(null);
  const bootstrappedRef = useRef(false);
  const hideScrollbarTimerRef = useRef<number | null>(null);
  const gitStatusRefreshTimerRef = useRef<number | null>(null);
  const gitStatusRequestIdRef = useRef(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [gitStatus, setGitStatus] = useState<TerminalGitStatus | null>(null);

  const session = sessions[terminalId];
  const latestSessionRef = useRef<TerminalSessionSnapshot | undefined>(session);

  useEffect(() => {
    latestSessionRef.current = session;
  }, [session]);

  useEffect(() => {
    return () => {
      if (gitStatusRefreshTimerRef.current !== null) {
        window.clearTimeout(gitStatusRefreshTimerRef.current);
        gitStatusRefreshTimerRef.current = null;
      }
      gitStatusRequestIdRef.current += 1;
    };
  }, []);

  const refreshGitStatus = useCallback(async (): Promise<void> => {
    const currentRequestId = ++gitStatusRequestIdRef.current;
    const activeSession = latestSessionRef.current;
    if (!activeSession || activeSession.status !== 'running') {
      if (currentRequestId === gitStatusRequestIdRef.current) {
        setGitStatus(null);
      }
      return;
    }

    try {
      const status = await window.terminalApi.getTerminalGitStatus({ terminalId });
      if (currentRequestId === gitStatusRequestIdRef.current) {
        setGitStatus(status);
      }
    } catch (error) {
      if (currentRequestId === gitStatusRequestIdRef.current) {
        setGitStatus(null);
      }
      console.error(`Failed to read git status for terminal "${terminalId}".`, error);
    }
  }, [terminalId]);

  const scheduleGitStatusRefresh = useCallback((): void => {
    if (gitStatusRefreshTimerRef.current !== null) {
      window.clearTimeout(gitStatusRefreshTimerRef.current);
    }

    gitStatusRefreshTimerRef.current = window.setTimeout(() => {
      gitStatusRefreshTimerRef.current = null;
      void refreshGitStatus();
    }, GIT_STATUS_TRIGGER_DELAY_MS);
  }, [refreshGitStatus]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const { terminal, fitAddon } = createXterm(toXtermTheme(theme));
    xtermRef.current = terminal;
    terminal.open(container);
    const viewport = container.querySelector('.xterm-viewport');

    const detachOutput = registerOutputSink(terminalId, (chunk) => {
      terminal.write(chunk);
      if (shouldTriggerGitStatusRefresh(chunk)) {
        scheduleGitStatusRefresh();
      }
    });

    const inputDisposable = terminal.onData((input) => {
      void writeTerminal(terminalId, input).catch((error) => {
        console.error(`Failed to write input for terminal "${terminalId}".`, error);
      });
    });

    const stopObserving = observeTerminalSize(container, terminal, fitAddon, ({ cols, rows }) => {
      void resizeTerminal(terminalId, cols, rows).catch((error) => {
        console.error(`Failed to resize terminal "${terminalId}".`, error);
      });
    });

    const onViewportActivity = (): void => {
      setIsScrolling(true);
      if (hideScrollbarTimerRef.current !== null) {
        window.clearTimeout(hideScrollbarTimerRef.current);
      }
      hideScrollbarTimerRef.current = window.setTimeout(() => {
        setIsScrolling(false);
        hideScrollbarTimerRef.current = null;
      }, 700);
    };

    if (viewport instanceof HTMLElement) {
      viewport.addEventListener('wheel', onViewportActivity, { passive: true });
      viewport.addEventListener('scroll', onViewportActivity, { passive: true });
    }

    return () => {
      if (viewport instanceof HTMLElement) {
        viewport.removeEventListener('wheel', onViewportActivity);
        viewport.removeEventListener('scroll', onViewportActivity);
      }
      if (hideScrollbarTimerRef.current !== null) {
        window.clearTimeout(hideScrollbarTimerRef.current);
        hideScrollbarTimerRef.current = null;
      }
      if (gitStatusRefreshTimerRef.current !== null) {
        window.clearTimeout(gitStatusRefreshTimerRef.current);
        gitStatusRefreshTimerRef.current = null;
      }
      stopObserving();
      inputDisposable.dispose();
      detachOutput();
      terminal.dispose();
      xtermRef.current = null;
    };
  }, [registerOutputSink, resizeTerminal, scheduleGitStatusRefresh, terminalId, writeTerminal]);

  useEffect(() => {
    if (!xtermRef.current) {
      return;
    }
    xtermRef.current.options.theme = toXtermTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (isActive) {
      xtermRef.current?.focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (!session || session.status !== 'running') {
      bootstrappedRef.current = false;
      return;
    }
    if (!xtermRef.current) {
      return;
    }

    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      xtermRef.current.write(`\u001b[2m[${session.shell}] terminal ready\u001b[0m\r\n`);
    }
  }, [session]);

  useEffect(() => {
    if (!session || session.status !== 'running') {
      setGitStatus(null);
      return;
    }
    scheduleGitStatusRefresh();
  }, [scheduleGitStatusRefresh, session?.status, session?.cwd]);

  const statusLabel = getStatusLabel(session, gitStatus);

  return (
    <div className={`w-full h-full relative terminal-viewport-shell ${isScrolling ? 'is-scrolling' : ''}`}>
      <div ref={containerRef} className="w-full h-full px-3 py-2" />
      {statusLabel.length > 0 && (
        <div
          className="absolute right-3 bottom-2 rounded px-2 py-0.5 text-[10px] font-mono tracking-wider pointer-events-none"
          style={{
            color: theme.textDim,
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          {statusLabel}
        </div>
      )}
    </div>
  );
};
