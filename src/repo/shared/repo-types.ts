export interface RepoStatusCounts {
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
  conflicts: number;
  ahead: number;
  behind: number;
}

export interface RepoChangedFile {
  path: string;
  status: string;
}

export interface RepoTreeNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  children?: RepoTreeNode[];
}

export interface RepoSnapshot {
  isRepo: boolean;
  repoRoot: string | null;
  repoName: string | null;
  branch: string | null;
  branches: string[];
  headSha: string | null;
  remotes: string[];
  status: RepoStatusCounts;
  changedFiles: RepoChangedFile[];
  tree: RepoTreeNode[];
  scannedAt: string;
  errorMessage?: string;
}

export interface GetRepoSnapshotRequest {
  cwd?: string;
}

export type RepoAction =
  | 'fetch'
  | 'pull'
  | 'push'
  | 'stage-all'
  | 'unstage-all'
  | 'stage-file'
  | 'unstage-file'
  | 'discard-file'
  | 'commit'
  | 'checkout-branch';

export interface RunRepoActionRequest {
  cwd?: string;
  action: RepoAction;
  filePath?: string;
  message?: string;
  branch?: string;
}

export interface RepoActionResult {
  ok: boolean;
  action: RepoAction;
  message: string;
  output: string;
  snapshot: RepoSnapshot;
}

export interface RepoApi {
  getRepoSnapshot: (request?: GetRepoSnapshotRequest) => Promise<RepoSnapshot>;
  runAction: (request: RunRepoActionRequest) => Promise<RepoActionResult>;
}
