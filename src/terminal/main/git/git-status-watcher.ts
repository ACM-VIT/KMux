import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { watch, type FSWatcher } from 'chokidar';

const GIT_LOGS_PATH_PATTERN = /[\\/]logs(?:[\\/]|$)/;
const GIT_ORIG_HEAD_PATH_PATTERN = /[\\/]ORIG_HEAD$/;

const resolveGitDirectoryRaw = (cwd: string, args: string[]): string | null => {
  const result = spawnSync('git', args, {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 1200,
  });

  if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
    return null;
  }

  const value = result.stdout.trim();
  return value.length > 0 ? value : null;
};

export const resolveGitDirectory = (cwd: string): string | null => {
  const trimmedCwd = cwd.trim();
  if (trimmedCwd.length === 0) {
    return null;
  }

  const rawGitDirectory =
    resolveGitDirectoryRaw(trimmedCwd, ['-C', trimmedCwd, 'rev-parse', '--path-format=absolute', '--git-dir']) ??
    resolveGitDirectoryRaw(trimmedCwd, ['-C', trimmedCwd, 'rev-parse', '--git-dir']);

  if (!rawGitDirectory) {
    return null;
  }

  const absoluteGitDirectory = path.isAbsolute(rawGitDirectory)
    ? rawGitDirectory
    : path.resolve(trimmedCwd, rawGitDirectory);

  const stats = fs.statSync(absoluteGitDirectory, { throwIfNoEntry: false });
  if (!stats?.isDirectory()) {
    return null;
  }

  return absoluteGitDirectory;
};

export const createGitStatusWatcher = (
  gitDirectory: string,
  onChange: () => void,
): FSWatcher => {
  const watcher = watch(gitDirectory, {
    ignoreInitial: true,
    depth: 4,
    ignored: (watchPath) =>
      GIT_LOGS_PATH_PATTERN.test(watchPath) || GIT_ORIG_HEAD_PATH_PATTERN.test(watchPath),
    awaitWriteFinish: {
      stabilityThreshold: 120,
      pollInterval: 50,
    },
  });

  watcher.on('add', onChange);
  watcher.on('change', onChange);
  watcher.on('unlink', onChange);
  watcher.on('addDir', onChange);
  watcher.on('unlinkDir', onChange);

  return watcher;
};
