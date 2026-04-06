import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import type { TerminalProfile } from '../shared/terminal-profiles';
import type {
  CreateTerminalRequest,
  GetTerminalGitStatusRequest,
  KillTerminalRequest,
  ResizeTerminalRequest,
  TerminalErrorEvent,
  TerminalExitEvent,
  TerminalGitStatus,
  TerminalOutputEvent,
  TerminalSessionSnapshot,
  TerminalStateEvent,
  WriteTerminalRequest,
} from '../shared/terminal-types';
import { parseGitStatusOutput } from './git/git-status';
import { listTerminalProfiles, resolveShell } from './shell/resolveShell';
import {
  consumeTerminalInputData,
  extractTrackedCwdFromOutput,
  resolveNextCwdFromCommand,
} from './utils/cwd-tracking';
import { buildPtyEnv } from './utils/env';

const TERMINAL_EVENT_NAMES = {
  output: 'output',
  exit: 'exit',
  state: 'state',
  error: 'error',
} as const;

const MIN_DIMENSION = 2;

interface TerminalSessionRecord {
  pty: IPty;
  snapshot: TerminalSessionSnapshot;
  inputBuffer: string;
}

const normalizeDimension = (value: number): number => {
  return Math.max(MIN_DIMENSION, Math.floor(value));
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const isExistingDirectory = (candidatePath: string): boolean => {
  const stats = fs.statSync(candidatePath, { throwIfNoEntry: false });
  return Boolean(stats?.isDirectory());
};

export class TerminalManager {
  private readonly sessions = new Map<string, TerminalSessionRecord>();
  private readonly events = new EventEmitter();

  public createTerminal(request: CreateTerminalRequest): TerminalSessionSnapshot {
    const existing = this.sessions.get(request.terminalId);
    if (existing) {
      return { ...existing.snapshot };
    }

    const shell = resolveShell(process.platform, process.env, request.profileId);
    const cols = normalizeDimension(request.cols);
    const rows = normalizeDimension(request.rows);
    const processCwd = process.cwd().trim();
    const cwd = request.cwd ?? (processCwd.length > 0 ? processCwd : os.homedir());

    let ptyProcess: IPty;
    try {
      ptyProcess = pty.spawn(shell.command, shell.args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: buildPtyEnv(process.env),
        useConpty: process.platform === 'win32',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.events.emit(TERMINAL_EVENT_NAMES.error, {
        terminalId: request.terminalId,
        message,
      } satisfies TerminalErrorEvent);
      throw new Error(`Failed to spawn terminal "${request.terminalId}": ${message}`);
    }

    const snapshot: TerminalSessionSnapshot = {
      terminalId: request.terminalId,
      pid: ptyProcess.pid,
      profileId: request.profileId,
      shell: shell.label,
      cwd,
      cols,
      rows,
      status: 'running',
    };

    const sessionRecord: TerminalSessionRecord = {
      pty: ptyProcess,
      snapshot,
      inputBuffer: '',
    };

    this.sessions.set(request.terminalId, sessionRecord);

    ptyProcess.onData((data) => {
      const trackedCwd = extractTrackedCwdFromOutput(data, process.platform);
      if (
        trackedCwd &&
        trackedCwd !== sessionRecord.snapshot.cwd &&
        isExistingDirectory(trackedCwd)
      ) {
        sessionRecord.snapshot = {
          ...sessionRecord.snapshot,
          cwd: trackedCwd,
        };
        this.emitState(sessionRecord.snapshot);
      }

      this.events.emit(TERMINAL_EVENT_NAMES.output, {
        terminalId: request.terminalId,
        data,
      } satisfies TerminalOutputEvent);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      const latestSnapshot = sessionRecord.snapshot;
      this.sessions.delete(request.terminalId);

      this.events.emit(TERMINAL_EVENT_NAMES.exit, {
        terminalId: request.terminalId,
        exitCode,
        signal,
      } satisfies TerminalExitEvent);

      this.emitState({
        ...latestSnapshot,
        status: 'exited',
        exitCode,
        signal,
      });
    });

    this.emitState(snapshot);
    return { ...snapshot };
  }

  public writeTerminal(request: WriteTerminalRequest): void {
    const session = this.sessions.get(request.terminalId);
    if (!session) {
      throw new Error(`Terminal "${request.terminalId}" is not running.`);
    }

    session.inputBuffer = consumeTerminalInputData(session.inputBuffer, request.data, (commandLine) => {
      const nextCwd = resolveNextCwdFromCommand(
        commandLine,
        session.snapshot.cwd,
        os.homedir(),
        process.platform,
      );
      if (!nextCwd || nextCwd === session.snapshot.cwd || !isExistingDirectory(nextCwd)) {
        return;
      }

      session.snapshot = {
        ...session.snapshot,
        cwd: nextCwd,
      };
      this.emitState(session.snapshot);
    });

    session.pty.write(request.data);
  }

  public resizeTerminal(request: ResizeTerminalRequest): void {
    const session = this.sessions.get(request.terminalId);
    if (!session) {
      throw new Error(`Terminal "${request.terminalId}" is not running.`);
    }

    const cols = normalizeDimension(request.cols);
    const rows = normalizeDimension(request.rows);
    session.pty.resize(cols, rows);

    session.snapshot = {
      ...session.snapshot,
      cols,
      rows,
    };
    this.emitState(session.snapshot);
  }

  public killTerminal(request: KillTerminalRequest): void {
    const session = this.sessions.get(request.terminalId);
    if (!session) {
      return;
    }
    session.pty.kill();
  }

  public killAll(): void {
    for (const session of this.sessions.values()) {
      session.pty.kill();
    }
    this.sessions.clear();
  }

  public listTerminals(): TerminalSessionSnapshot[] {
    return [...this.sessions.values()].map((session) => ({ ...session.snapshot }));
  }

  public listProfiles(): TerminalProfile[] {
    return listTerminalProfiles(process.platform);
  }

  public getTerminalGitStatus(request: GetTerminalGitStatusRequest): TerminalGitStatus {
    const fallbackStatus: TerminalGitStatus = {
      terminalId: request.terminalId,
      branchName: null,
      isDirty: false,
    };

    const session = this.sessions.get(request.terminalId);
    if (!session) {
      return fallbackStatus;
    }

    const sessionCwd = session.snapshot.cwd.trim();
    if (sessionCwd.length === 0) {
      return fallbackStatus;
    }

    const result = spawnSync(
      'git',
      ['-C', sessionCwd, 'status', '--porcelain=2', '--branch'],
      {
        windowsHide: true,
        encoding: 'utf8',
        timeout: 2000,
      },
    );

    if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
      return fallbackStatus;
    }

    return parseGitStatusOutput(result.stdout, request.terminalId);
  }

  public onOutput(listener: (event: TerminalOutputEvent) => void): () => void {
    this.events.on(TERMINAL_EVENT_NAMES.output, listener);
    return () => this.events.off(TERMINAL_EVENT_NAMES.output, listener);
  }

  public onExit(listener: (event: TerminalExitEvent) => void): () => void {
    this.events.on(TERMINAL_EVENT_NAMES.exit, listener);
    return () => this.events.off(TERMINAL_EVENT_NAMES.exit, listener);
  }

  public onState(listener: (event: TerminalStateEvent) => void): () => void {
    this.events.on(TERMINAL_EVENT_NAMES.state, listener);
    return () => this.events.off(TERMINAL_EVENT_NAMES.state, listener);
  }

  public onError(listener: (event: TerminalErrorEvent) => void): () => void {
    this.events.on(TERMINAL_EVENT_NAMES.error, listener);
    return () => this.events.off(TERMINAL_EVENT_NAMES.error, listener);
  }

  private emitState(snapshot: TerminalSessionSnapshot): void {
    this.events.emit(TERMINAL_EVENT_NAMES.state, {
      terminalId: snapshot.terminalId,
      snapshot: { ...snapshot },
    } satisfies TerminalStateEvent);
  }
}
