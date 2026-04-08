import type {
  CreateTerminalRequest,
  GetTerminalGitStatusRequest,
  KillTerminalRequest,
  ResizeTerminalRequest,
  WriteTerminalRequest,
} from './terminal-types';
import { isTerminalProfileId } from './terminal-profiles';

const MIN_TERMINAL_DIMENSION = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${fieldName}: expected a non-empty string.`);
  }
}

function assertString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: expected a string.`);
  }
}

function assertDimension(value: unknown, fieldName: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < MIN_TERMINAL_DIMENSION) {
    throw new Error(
      `Invalid ${fieldName}: expected an integer >= ${MIN_TERMINAL_DIMENSION}.`,
    );
  }
}

export const TERMINAL_IPC_CHANNELS = {
  create: 'terminal:create',
  write: 'terminal:write',
  resize: 'terminal:resize',
  kill: 'terminal:kill',
  list: 'terminal:list',
  listProfiles: 'terminal:list-profiles',
  gitStatus: 'terminal:git-status',
  gitStatusChanged: 'terminal:git-status-changed',
  output: 'terminal:output',
  exit: 'terminal:exit',
  state: 'terminal:state',
  error: 'terminal:error',
} as const;

export function assertCreateTerminalRequest(
  payload: unknown,
): asserts payload is CreateTerminalRequest {
  if (!isRecord(payload)) {
    throw new Error('Invalid create-terminal payload.');
  }
  assertNonEmptyString(payload.terminalId, 'terminalId');
  assertDimension(payload.cols, 'cols');
  assertDimension(payload.rows, 'rows');
  if (payload.cwd !== undefined) {
    assertNonEmptyString(payload.cwd, 'cwd');
  }
  if (payload.profileId !== undefined && !isTerminalProfileId(payload.profileId)) {
    throw new Error('Invalid profileId.');
  }
}

export function assertWriteTerminalRequest(
  payload: unknown,
): asserts payload is WriteTerminalRequest {
  if (!isRecord(payload)) {
    throw new Error('Invalid write-terminal payload.');
  }
  assertNonEmptyString(payload.terminalId, 'terminalId');
  assertString(payload.data, 'data');
}

export function assertResizeTerminalRequest(
  payload: unknown,
): asserts payload is ResizeTerminalRequest {
  if (!isRecord(payload)) {
    throw new Error('Invalid resize-terminal payload.');
  }
  assertNonEmptyString(payload.terminalId, 'terminalId');
  assertDimension(payload.cols, 'cols');
  assertDimension(payload.rows, 'rows');
}

export function assertKillTerminalRequest(
  payload: unknown,
): asserts payload is KillTerminalRequest {
  if (!isRecord(payload)) {
    throw new Error('Invalid kill-terminal payload.');
  }
  assertNonEmptyString(payload.terminalId, 'terminalId');
}

export function assertGetTerminalGitStatusRequest(
  payload: unknown,
): asserts payload is GetTerminalGitStatusRequest {
  if (!isRecord(payload)) {
    throw new Error('Invalid git-status payload.');
  }
  assertNonEmptyString(payload.terminalId, 'terminalId');
}
