import React, { useEffect, useRef, useState } from 'react';
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

const GIT_STATUS_POLL_INTERVAL_MS = 2000;

const getStatusLabel = (
  session: TerminalSessionSnapshot | undefined,
  gitStatus: TerminalGitStatus | null,
): string => {
  if (!session) return 'starting...';
  if (session.status === 'running') {
    if (!gitStatus?.branchName) {
      return session.shell || 'running';
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
  const [isScrolling, setIsScrolling] = useState(false);
  const [gitStatus, setGitStatus] = useState<TerminalGitStatus | null>(null);

  const session = sessions[terminalId];

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
      stopObserving();
      inputDisposable.dispose();
      detachOutput();
      terminal.dispose();
      xtermRef.current = null;
    };
  }, [registerOutputSink, resizeTerminal, terminalId, writeTerminal]);

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
    if (!xtermRef.current || !session) {
      return;
    }
    if (bootstrappedRef.current) {
      return;
    }

    if (session.status === 'running') {
      bootstrappedRef.current = true;
      xtermRef.current.write(`\u001b[2m[${session.shell}] terminal ready\u001b[0m\r\n`);
    }
  }, [session]);

  useEffect(() => {
    if (!session || session.status !== 'running') {
      setGitStatus(null);
      return;
    }

    if (!isActive) {
      return;
    }

    let isDisposed = false;
    let isInFlight = false;
    let timeoutId: number | null = null;

    const pollGitStatus = async (): Promise<void> => {
      if (isDisposed || isInFlight) {
        return;
      }

      isInFlight = true;
      try {
        const nextStatus = await window.terminalApi.getTerminalGitStatus({ terminalId });
        if (!isDisposed) {
          setGitStatus(nextStatus);
        }
      } catch {
        if (!isDisposed) {
          setGitStatus(null);
        }
      } finally {
        isInFlight = false;
        if (!isDisposed) {
          timeoutId = window.setTimeout(() => {
            void pollGitStatus();
          }, GIT_STATUS_POLL_INTERVAL_MS);
        }
      }
    };

    void pollGitStatus();

    return () => {
      isDisposed = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isActive, session?.cwd, session?.status, terminalId]);

  const statusLabel = getStatusLabel(session, gitStatus);

  return (
    <div className={`w-full h-full relative terminal-viewport-shell ${isScrolling ? 'is-scrolling' : ''}`}>
      <div ref={containerRef} className="w-full h-full px-2 py-1.5" />
      {statusLabel.length > 0 ? (
        <div
          className="absolute right-2 bottom-1.5 rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider pointer-events-none"
          style={{
            color: theme.textDim,
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          {statusLabel}
        </div>
      ) : null}
    </div>
  );
};
