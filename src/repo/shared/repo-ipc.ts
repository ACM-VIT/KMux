import type { GetRepoSnapshotRequest, RepoSnapshot, RunRepoActionRequest } from './repo-types';

export const REPO_IPC_CHANNELS = {
  snapshot: 'repo:snapshot',
  action: 'repo:action',
} as const;

export function assertRepoSnapshotResponse(value: unknown): asserts value is RepoSnapshot {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid repo snapshot response.');
  }
}

export function assertGetRepoSnapshotRequest(
  value: unknown,
): asserts value is GetRepoSnapshotRequest | undefined {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid repo snapshot request.');
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.cwd !== undefined && typeof candidate.cwd !== 'string') {
    throw new Error('Invalid repo snapshot cwd.');
  }
}

export function assertRunRepoActionRequest(value: unknown): asserts value is RunRepoActionRequest {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid repo action request.');
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.action !== 'string' || candidate.action.trim().length === 0) {
    throw new Error('Invalid repo action.');
  }
  if (candidate.cwd !== undefined && typeof candidate.cwd !== 'string') {
    throw new Error('Invalid repo action cwd.');
  }
  if (candidate.filePath !== undefined && typeof candidate.filePath !== 'string') {
    throw new Error('Invalid repo action filePath.');
  }
  if (candidate.message !== undefined && typeof candidate.message !== 'string') {
    throw new Error('Invalid repo action message.');
  }
  if (candidate.branch !== undefined && typeof candidate.branch !== 'string') {
    throw new Error('Invalid repo action branch.');
  }
}
