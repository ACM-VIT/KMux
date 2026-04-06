import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useCanvasStore } from '../../../store/useCanvasStore';
import type { TerminalProfileId } from '../../shared/terminal-profiles';
import type { TerminalSessionSnapshot } from '../../shared/terminal-types';

type TerminalOutputSink = (data: string) => void;
type TerminalSessionMap = Record<string, TerminalSessionSnapshot>;

export interface TerminalRuntimeContextValue {
  sessions: TerminalSessionMap;
  registerOutputSink: (terminalId: string, sink: TerminalOutputSink) => () => void;
  writeTerminal: (terminalId: string, data: string) => Promise<void>;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<void>;
}

export const TerminalRuntimeContext = createContext<TerminalRuntimeContextValue | null>(null);

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 30;
const CREATE_RETRY_DELAY_MS = 120;
const MAX_CREATE_RETRIES = 20;

const indexByTerminalId = (sessions: TerminalSessionSnapshot[]): TerminalSessionMap => {
  const result: TerminalSessionMap = {};
  for (const session of sessions) {
    result[session.terminalId] = session;
  }
  return result;
};

const toStartingSnapshot = (terminalId: string): TerminalSessionSnapshot => ({
  terminalId,
  pid: null,
  shell: '',
  cwd: '',
  cols: DEFAULT_COLS,
  rows: DEFAULT_ROWS,
  status: 'starting',
});

const toErrorSnapshot = (terminalId: string, message: string): TerminalSessionSnapshot => ({
  terminalId,
  pid: null,
  shell: '',
  cwd: '',
  cols: DEFAULT_COLS,
  rows: DEFAULT_ROWS,
  status: 'error',
  errorMessage: message,
});

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const TerminalRuntimeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const workspaces = useCanvasStore((state) => state.workspaces);
  const terminalIds = useMemo(
    () => workspaces.flatMap((workspace) => workspace.terminals.map((terminal) => terminal.id)),
    [workspaces],
  );
  const terminalProfileById = useMemo<Record<string, TerminalProfileId | undefined>>(() => {
    const profileMap: Record<string, TerminalProfileId | undefined> = {};
    for (const workspace of workspaces) {
      for (const terminal of workspace.terminals) {
        profileMap[terminal.id] = terminal.profileId;
      }
    }
    return profileMap;
  }, [workspaces]);

  const [sessions, setSessions] = useState<TerminalSessionMap>({});
  const previousIdsRef = useRef<Set<string>>(new Set());
  const outputSinksRef = useRef<Map<string, Set<TerminalOutputSink>>>(new Map());
  const createRetryTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    void window.terminalApi
      .listTerminals()
      .then((activeSessions) => {
        setSessions(indexByTerminalId(activeSessions));
      })
      .catch((error) => {
        console.error('Failed to list active terminal sessions.', error);
      });
  }, []);

  useEffect(() => {
    return () => {
      for (const timeoutId of createRetryTimersRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      createRetryTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const detachOutput = window.terminalApi.onTerminalOutput((event) => {
      const sinks = outputSinksRef.current.get(event.terminalId);
      if (!sinks) {
        return;
      }
      for (const sink of sinks) {
        sink(event.data);
      }
    });

    const detachState = window.terminalApi.onTerminalState((event) => {
      setSessions((current) => ({
        ...current,
        [event.terminalId]: event.snapshot,
      }));
    });

    const detachExit = window.terminalApi.onTerminalExit((event) => {
      setSessions((current) => {
        const existing = current[event.terminalId];
        if (!existing) {
          return current;
        }

        return {
          ...current,
          [event.terminalId]: {
            ...existing,
            status: 'exited',
            exitCode: event.exitCode,
            signal: event.signal,
          },
        };
      });
    });

    const detachError = window.terminalApi.onTerminalError((event) => {
      setSessions((current) => {
        const existing = current[event.terminalId];
        const fallback = toErrorSnapshot(event.terminalId, event.message);
        return {
          ...current,
          [event.terminalId]: existing
            ? {
                ...existing,
                status: 'error',
                errorMessage: event.message,
              }
            : fallback,
        };
      });
    });

    return () => {
      detachOutput();
      detachState();
      detachExit();
      detachError();
    };
  }, []);

  useEffect(() => {
    const nextIds = new Set(terminalIds);
    const previousIds = previousIdsRef.current;
    const addedIds = terminalIds.filter((terminalId) => !previousIds.has(terminalId));
    const removedIds = [...previousIds].filter((terminalId) => !nextIds.has(terminalId));
    previousIdsRef.current = nextIds;

    for (const terminalId of addedIds) {
      setSessions((current) => ({
        ...current,
        [terminalId]: current[terminalId] ?? toStartingSnapshot(terminalId),
      }));

      const attemptCreate = (attempt: number): void => {
        if (!previousIdsRef.current.has(terminalId)) {
          return;
        }

        void window.terminalApi
          .createTerminal({
            terminalId,
            cols: DEFAULT_COLS,
            rows: DEFAULT_ROWS,
            profileId: terminalProfileById[terminalId],
          })
          .then((snapshot) => {
            const retryId = createRetryTimersRef.current.get(terminalId);
            if (retryId !== undefined) {
              window.clearTimeout(retryId);
              createRetryTimersRef.current.delete(terminalId);
            }

            setSessions((current) => ({
              ...current,
              [terminalId]: snapshot,
            }));
          })
          .catch((error) => {
            const message = toErrorMessage(error);
            const shouldRetry =
              /no handler registered/i.test(message) && attempt < MAX_CREATE_RETRIES;

            if (shouldRetry) {
              const retryId = window.setTimeout(() => {
                createRetryTimersRef.current.delete(terminalId);
                attemptCreate(attempt + 1);
              }, CREATE_RETRY_DELAY_MS);
              createRetryTimersRef.current.set(terminalId, retryId);
              return;
            }

            console.error(`Failed to create terminal session "${terminalId}".`, error);
            setSessions((current) => ({
              ...current,
              [terminalId]: toErrorSnapshot(terminalId, message),
            }));
          });
      };

      attemptCreate(0);
    }

    for (const terminalId of removedIds) {
      outputSinksRef.current.delete(terminalId);
      const retryId = createRetryTimersRef.current.get(terminalId);
      if (retryId !== undefined) {
        window.clearTimeout(retryId);
        createRetryTimersRef.current.delete(terminalId);
      }

      void window.terminalApi.killTerminal({ terminalId }).catch((error) => {
        console.error(`Failed to terminate terminal session "${terminalId}".`, error);
      });
    }

    if (removedIds.length > 0) {
      setSessions((current) => {
        const next = { ...current };
        for (const terminalId of removedIds) {
          delete next[terminalId];
        }
        return next;
      });
    }
  }, [terminalIds, terminalProfileById]);

  const registerOutputSink = useCallback(
    (terminalId: string, sink: TerminalOutputSink): (() => void) => {
      const existingSinks = outputSinksRef.current.get(terminalId);
      if (existingSinks) {
        existingSinks.add(sink);
      } else {
        outputSinksRef.current.set(terminalId, new Set([sink]));
      }

      return () => {
        const sinks = outputSinksRef.current.get(terminalId);
        if (!sinks) {
          return;
        }
        sinks.delete(sink);
        if (sinks.size === 0) {
          outputSinksRef.current.delete(terminalId);
        }
      };
    },
    [],
  );

  const writeTerminal = useCallback(async (terminalId: string, data: string): Promise<void> => {
    await window.terminalApi.writeTerminal({ terminalId, data });
  }, []);

  const resizeTerminal = useCallback(
    async (terminalId: string, cols: number, rows: number): Promise<void> => {
      await window.terminalApi.resizeTerminal({
        terminalId,
        cols: Math.max(2, Math.floor(cols)),
        rows: Math.max(2, Math.floor(rows)),
      });
    },
    [],
  );

  const value = useMemo<TerminalRuntimeContextValue>(() => {
    return {
      sessions,
      registerOutputSink,
      writeTerminal,
      resizeTerminal,
    };
  }, [registerOutputSink, resizeTerminal, sessions, writeTerminal]);

  return (
    <TerminalRuntimeContext.Provider value={value}>{children}</TerminalRuntimeContext.Provider>
  );
};
