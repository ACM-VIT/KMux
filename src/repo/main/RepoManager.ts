import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type {
  RepoActionResult,
  RepoChangedFile,
  RepoSnapshot,
  RepoStatusCounts,
  RepoTreeNode,
  RunRepoActionRequest,
} from '../shared/repo-types';

const MAX_TREE_DEPTH = 3;
const MAX_TREE_ENTRIES = 250;
const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  'node_modules',
  '.vite',
  'dist',
  'out',
  'release',
]);

const EMPTY_STATUS: RepoStatusCounts = {
  modified: 0,
  added: 0,
  deleted: 0,
  untracked: 0,
  conflicts: 0,
  ahead: 0,
  behind: 0,
};

const toEmptySnapshot = (errorMessage?: string): RepoSnapshot => ({
  isRepo: false,
  repoRoot: null,
  repoName: null,
  branch: null,
  branches: [],
  headSha: null,
  remotes: [],
  status: { ...EMPTY_STATUS },
  changedFiles: [],
  tree: [],
  scannedAt: new Date().toISOString(),
  errorMessage,
});

interface GitCommandResult {
  stdout: string;
  stderr: string;
  success: boolean;
  exitCode: number | null;
}

export class RepoManager {
  public async getSnapshot(cwd?: string): Promise<RepoSnapshot> {
    const repoRoot = await this.resolveRepoRoot(cwd);
    if (!repoRoot) {
      return toEmptySnapshot('No Git repository detected from the current app workspace.');
    }

    try {
      const [branchResult, branches, headResult, remotes, { status, changedFiles }] = await Promise.all([
        this.runGit(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']),
        this.readBranches(repoRoot),
        this.runGit(repoRoot, ['rev-parse', '--short', 'HEAD']),
        this.readRemotes(repoRoot),
        this.readStatus(repoRoot),
      ]);
      const tree = this.buildTree(repoRoot);

      return {
        isRepo: true,
        repoRoot,
        repoName: path.basename(repoRoot),
        branch: branchResult.stdout || 'HEAD',
        branches,
        headSha: headResult.stdout || null,
        remotes,
        status,
        changedFiles,
        tree,
        scannedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toEmptySnapshot(message);
    }
  }

  public async runAction(request: RunRepoActionRequest): Promise<RepoActionResult> {
    const repoRoot = await this.resolveRepoRoot(request.cwd);
    if (!repoRoot) {
      const snapshot = toEmptySnapshot('No Git repository detected from the current app workspace.');
      return {
        ok: false,
        action: request.action,
        message: snapshot.errorMessage ?? 'No Git repository detected.',
        output: '',
        snapshot,
      };
    }

    const result = await this.executeRepoAction(repoRoot, request);
    const snapshot = await this.getSnapshot(repoRoot);
    const combinedOutput = [result.stdout, result.stderr].filter((part) => part.length > 0).join('\n');

    return {
      ok: result.success,
      action: request.action,
      message: result.success
        ? this.getSuccessMessage(request)
        : combinedOutput || `Git ${request.action} failed.`,
      output: combinedOutput,
      snapshot,
    };
  }

  private async resolveRepoRoot(cwd?: string): Promise<string | null> {
    const currentDir = cwd && cwd.trim().length > 0 ? cwd : process.cwd();
    const result = await this.runGit(currentDir, ['rev-parse', '--show-toplevel'], false);
    if (!result.success || result.stdout.length === 0) {
      return null;
    }
    return result.stdout;
  }

  private async readRemotes(repoRoot: string): Promise<string[]> {
    const result = await this.runGit(repoRoot, ['remote'], false);
    if (!result.success || result.stdout.length === 0) {
      return [];
    }
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private async readBranches(repoRoot: string): Promise<string[]> {
    const result = await this.runGit(repoRoot, ['branch', '--format=%(refname:short)'], false);
    if (!result.success || result.stdout.length === 0) {
      return [];
    }

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private async readStatus(repoRoot: string): Promise<{
    status: RepoStatusCounts;
    changedFiles: RepoChangedFile[];
  }> {
    const result = await this.runGit(repoRoot, ['status', '--short', '--branch'], false);
    if (!result.success) {
      return {
        status: { ...EMPTY_STATUS },
        changedFiles: [],
      };
    }

    const lines = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);

    const status: RepoStatusCounts = { ...EMPTY_STATUS };
    const changedFiles: RepoChangedFile[] = [];

    for (const line of lines) {
      if (line.startsWith('##')) {
        const aheadMatch = line.match(/ahead (\d+)/);
        const behindMatch = line.match(/behind (\d+)/);
        status.ahead = aheadMatch ? Number.parseInt(aheadMatch[1], 10) : 0;
        status.behind = behindMatch ? Number.parseInt(behindMatch[1], 10) : 0;
        continue;
      }

      const code = line.slice(0, 2);
      const filePath = line.slice(3).trim();
      if (filePath.length === 0) {
        continue;
      }

      changedFiles.push({
        path: filePath,
        status: code.trim() || '??',
      });

      const [indexCode, workTreeCode] = code.split('');
      const symbols = [indexCode, workTreeCode];

      if (symbols.includes('?')) {
        status.untracked += 1;
      }
      if (symbols.includes('U')) {
        status.conflicts += 1;
      }
      if (symbols.includes('A')) {
        status.added += 1;
      }
      if (symbols.includes('M')) {
        status.modified += 1;
      }
      if (symbols.includes('D')) {
        status.deleted += 1;
      }
    }

    return { status, changedFiles };
  }

  private buildTree(repoRoot: string): RepoTreeNode[] {
    let visitedEntries = 0;

    const walk = (currentPath: string, depth: number): RepoTreeNode[] => {
      if (depth > MAX_TREE_DEPTH || visitedEntries >= MAX_TREE_ENTRIES) {
        return [];
      }

      let entries: fs.Dirent[];
      try {
        entries = fs
          .readdirSync(currentPath, { withFileTypes: true })
          .filter((entry) => !IGNORED_DIRECTORY_NAMES.has(entry.name))
          .sort((left, right) => {
            if (left.isDirectory() !== right.isDirectory()) {
              return left.isDirectory() ? -1 : 1;
            }
            return left.name.localeCompare(right.name);
          });
      } catch {
        return [];
      }

      const nodes: RepoTreeNode[] = [];
      for (const entry of entries) {
        if (visitedEntries >= MAX_TREE_ENTRIES) {
          break;
        }

        const absolutePath = path.join(currentPath, entry.name);
        const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
        visitedEntries += 1;

        if (entry.isDirectory()) {
          nodes.push({
            name: entry.name,
            path: relativePath,
            kind: 'directory',
            children: walk(absolutePath, depth + 1),
          });
          continue;
        }

        nodes.push({
          name: entry.name,
          path: relativePath,
          kind: 'file',
        });
      }

      return nodes;
    };

    return walk(repoRoot, 1);
  }

  private async executeRepoAction(
    repoRoot: string,
    request: RunRepoActionRequest,
  ): Promise<GitCommandResult> {
    switch (request.action) {
      case 'fetch':
        return this.runGit(repoRoot, ['fetch', '--all', '--prune'], false);
      case 'pull':
        return this.runGit(repoRoot, ['pull'], false);
      case 'push':
        return this.runGit(repoRoot, ['push'], false);
      case 'stage-all':
        return this.runGit(repoRoot, ['add', '--all'], false);
      case 'unstage-all':
        return this.runGit(repoRoot, ['reset', 'HEAD', '--', '.'], false);
      case 'stage-file':
        return request.filePath
          ? this.runGit(repoRoot, ['add', '--', request.filePath], false)
          : this.invalidAction('Missing file path for stage-file.');
      case 'unstage-file':
        return request.filePath
          ? this.runGit(repoRoot, ['reset', 'HEAD', '--', request.filePath], false)
          : this.invalidAction('Missing file path for unstage-file.');
      case 'discard-file':
        return request.filePath
          ? this.runGit(repoRoot, ['checkout', '--', request.filePath], false)
          : this.invalidAction('Missing file path for discard-file.');
      case 'commit':
        return request.message && request.message.trim().length > 0
          ? this.runGit(repoRoot, ['commit', '-m', request.message.trim()], false)
          : this.invalidAction('Commit message is required.');
      case 'checkout-branch':
        return request.branch && request.branch.trim().length > 0
          ? this.runGit(repoRoot, ['checkout', request.branch.trim()], false)
          : this.invalidAction('Branch name is required.');
      default:
        return this.invalidAction(`Unsupported action: ${request.action}.`);
    }
  }

  private getSuccessMessage(request: RunRepoActionRequest): string {
    switch (request.action) {
      case 'fetch':
        return 'Fetched latest refs.';
      case 'pull':
        return 'Pulled latest changes.';
      case 'push':
        return 'Pushed local changes.';
      case 'stage-all':
        return 'Staged all changes.';
      case 'unstage-all':
        return 'Unstaged all changes.';
      case 'stage-file':
        return `Staged ${request.filePath}.`;
      case 'unstage-file':
        return `Unstaged ${request.filePath}.`;
      case 'discard-file':
        return `Discarded changes in ${request.filePath}.`;
      case 'commit':
        return 'Created commit.';
      case 'checkout-branch':
        return `Checked out ${request.branch}.`;
      default:
        return 'Git action completed.';
    }
  }

  private invalidAction(message: string): GitCommandResult {
    return {
      stdout: '',
      stderr: message,
      success: false,
      exitCode: 1,
      };
  }

  private runGit(repoRoot: string, args: string[], throwOnError = true): Promise<GitCommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', args, {
        cwd: repoRoot,
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

      child.on('error', (error) => {
        if (throwOnError) {
          reject(error);
          return;
        }
        resolve({
          stdout: stdout.trim(),
          stderr: (stderr || error.message).trim(),
          success: false,
          exitCode: 1,
        });
      });

      child.on('close', (exitCode) => {
        const result = {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: exitCode === 0,
          exitCode,
        };

        if (!result.success && throwOnError) {
          reject(new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`));
          return;
        }

        resolve(result);
      });
    });
  }
}
