import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import * as pty from 'node-pty';
import { spawn } from 'node:child_process';
import type { IPty } from 'node-pty';
import type { FSWatcher } from 'chokidar';
import type { TerminalProfile } from '../shared/terminal-profiles';
import type {
  CreateTerminalRequest,
  GetTerminalGitStatusRequest,
  KillTerminalRequest,
  ResizeTerminalRequest,
  TerminalErrorEvent,
  TerminalGitStatus,
  TerminalGitStatusChangedEvent,
  TerminalExitEvent,
  TerminalOutputEvent,
  TerminalSessionSnapshot,
  TerminalStateEvent,
  WriteTerminalRequest,
} from '../shared/terminal-types';
import { parseGitStatusOutput } from './git/git-status';
import { createGitStatusWatcher, resolveGitDirectory } from './git/git-status-watcher';
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
  gitStatusChanged: 'git-status-changed',
} as const;

const MIN_DIMENSION = 2;
const GIT_STATUS_CHANGE_DEBOUNCE_MS = 120;

interface TerminalSessionRecord {
  pty: IPty;
  snapshot: TerminalSessionSnapshot;
  inputBuffer: string;
  gitDirectory: string | null;
  gitWatcher: FSWatcher | null;
  gitStatusChangeTimer: ReturnType<typeof setTimeout> | null;
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
    const cwd = request.cwd ?? os.homedir();

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
      gitDirectory: null,
      gitWatcher: null,
      gitStatusChangeTimer: null,
    };

    this.sessions.set(request.terminalId, sessionRecord);
    this.refreshGitWatcherForSession(sessionRecord);

    ptyProcess.onData((data) => {
      const trackedCwd = extractTrackedCwdFromOutput(data, process.platform);
      if (
        trackedCwd &&
        trackedCwd !== sessionRecord.snapshot.cwd &&
        isExistingDirectory(trackedCwd)
      ) {
        this.updateSessionCwd(sessionRecord, trackedCwd);
      }

      this.events.emit(TERMINAL_EVENT_NAMES.output, {
        terminalId: request.terminalId,
        data,
      } satisfies TerminalOutputEvent);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      const latestSnapshot = sessionRecord.snapshot;
      this.disposeGitWatcher(sessionRecord);
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
      this.emitGitStatusChanged(request.terminalId);
    });

    this.emitState(snapshot);
    this.emitGitStatusChanged(request.terminalId);
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

      this.updateSessionCwd(session, nextCwd);
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
    this.disposeGitWatcher(session);
    session.pty.kill();
  }

  public killAll(): void {
    for (const session of this.sessions.values()) {
      this.disposeGitWatcher(session);
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

  public async getTerminalGitStatus(
    request: GetTerminalGitStatusRequest,
  ): Promise<TerminalGitStatus> {
    const session = this.sessions.get(request.terminalId);
    if (!session) {
      return {
        terminalId: request.terminalId,
        branchName: null,
        isDirty: false,
      };
    }

    try {
      const output = await this.runGitStatus(session.snapshot.cwd);
      return parseGitStatusOutput(output, request.terminalId);
    } catch {
      return {
        terminalId: request.terminalId,
        branchName: null,
        isDirty: false,
      };
    }
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

  public onGitStatusChanged(listener: (event: TerminalGitStatusChangedEvent) => void): () => void {
    this.events.on(TERMINAL_EVENT_NAMES.gitStatusChanged, listener);
    return () => this.events.off(TERMINAL_EVENT_NAMES.gitStatusChanged, listener);
  }

  private emitState(snapshot: TerminalSessionSnapshot): void {
    this.events.emit(TERMINAL_EVENT_NAMES.state, {
      terminalId: snapshot.terminalId,
      snapshot: { ...snapshot },
    } satisfies TerminalStateEvent);
  }

  private emitGitStatusChanged(terminalId: string): void {
    this.events.emit(TERMINAL_EVENT_NAMES.gitStatusChanged, {
      terminalId,
    } satisfies TerminalGitStatusChangedEvent);
  }

  private scheduleGitStatusChanged(session: TerminalSessionRecord): void {
    if (session.gitStatusChangeTimer !== null) {
      clearTimeout(session.gitStatusChangeTimer);
    }

    session.gitStatusChangeTimer = setTimeout(() => {
      session.gitStatusChangeTimer = null;
      this.emitGitStatusChanged(session.snapshot.terminalId);
    }, GIT_STATUS_CHANGE_DEBOUNCE_MS);
  }

  private disposeGitWatcher(session: TerminalSessionRecord): void {
    if (session.gitStatusChangeTimer !== null) {
      clearTimeout(session.gitStatusChangeTimer);
      session.gitStatusChangeTimer = null;
    }

    if (session.gitWatcher) {
      void session.gitWatcher.close();
      session.gitWatcher = null;
    }

    session.gitDirectory = null;
  }

  private refreshGitWatcherForSession(session: TerminalSessionRecord): void {
    const nextGitDirectory = resolveGitDirectory(session.snapshot.cwd);
    if (!nextGitDirectory) {
      this.disposeGitWatcher(session);
      return;
    }

    if (session.gitWatcher && session.gitDirectory === nextGitDirectory) {
      return;
    }

    this.disposeGitWatcher(session);
    try {
      session.gitWatcher = createGitStatusWatcher(nextGitDirectory, () => {
        this.scheduleGitStatusChanged(session);
      });
      session.gitDirectory = nextGitDirectory;
    } catch (error) {
      this.disposeGitWatcher(session);
      this.events.emit(TERMINAL_EVENT_NAMES.error, {
        terminalId: session.snapshot.terminalId,
        message: `Failed to watch git directory: ${getErrorMessage(error)}`,
      } satisfies TerminalErrorEvent);
    }
  }

  private updateSessionCwd(session: TerminalSessionRecord, nextCwd: string): void {
    session.snapshot = {
      ...session.snapshot,
      cwd: nextCwd,
    };
    this.emitState(session.snapshot);
    this.refreshGitWatcherForSession(session);
    this.emitGitStatusChanged(session.snapshot.terminalId);
  }

  private runGitStatus(cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', ['status', '--porcelain=2', '--branch'], {
        cwd,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.on('data', (chunk: string) => {
        stderr += chunk;
      });

      child.on('error', reject);
      child.on('close', (exitCode) => {
        if (exitCode === 0) {
          resolve(stdout);
          return;
        }
        reject(new Error(stderr.trim() || stdout.trim() || 'git status failed'));
      });
    });
  }
}
