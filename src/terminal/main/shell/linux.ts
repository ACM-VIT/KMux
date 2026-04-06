import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeTerminalProfileId,
  type TerminalProfile,
  type TerminalProfileId,
} from '../../shared/terminal-profiles.ts';
import type { ResolvedShell } from './resolveShell';

interface LinuxProfileEntry {
  profile: TerminalProfile;
  shell: ResolvedShell;
}

export interface LinuxRuntime {
  pathExists: (candidatePath: string) => boolean;
  readFile: (candidatePath: string) => string;
}

const createRuntime = (): LinuxRuntime => {
  return {
    pathExists: (candidatePath) => fs.existsSync(candidatePath),
    readFile: (candidatePath) => fs.readFileSync(candidatePath, 'utf8'),
  };
};

const parseShellList = (content: string): string[] => {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('#'));
};

const listCandidateShellPaths = (env: NodeJS.ProcessEnv, runtime: LinuxRuntime): string[] => {
  const candidateShells: string[] = [];

  if (typeof env.SHELL === 'string' && env.SHELL.trim().length > 0) {
    candidateShells.push(env.SHELL.trim());
  }

  const etcShellsPath = '/etc/shells';
  if (runtime.pathExists(etcShellsPath)) {
    try {
      const shellList = parseShellList(runtime.readFile(etcShellsPath));
      candidateShells.push(...shellList);
    } catch {
      // ignore unreadable shell list and continue with detected paths
    }
  }

  const uniqueShells: string[] = [];
  const seen = new Set<string>();
  for (const shellPath of candidateShells) {
    if (!runtime.pathExists(shellPath)) {
      continue;
    }
    if (seen.has(shellPath)) {
      continue;
    }
    seen.add(shellPath);
    uniqueShells.push(shellPath);
  }

  return uniqueShells;
};

const buildLinuxProfileEntries = (
  env: NodeJS.ProcessEnv,
  runtime: LinuxRuntime = createRuntime(),
): LinuxProfileEntry[] => {
  const shellPaths = listCandidateShellPaths(env, runtime);
  const entries: LinuxProfileEntry[] = [];
  const seenIds = new Set<string>();

  for (const shellPath of shellPaths) {
    const label = path.basename(shellPath);
    const baseId = normalizeTerminalProfileId(label);
    const idSource = baseId.length > 0 ? baseId : normalizeTerminalProfileId(shellPath);
    const profileIdBase = idSource.length > 0 ? idSource : 'shell';

    let profileId = profileIdBase;
    let index = 2;
    while (seenIds.has(profileId)) {
      profileId = `${profileIdBase}-${index}`;
      index += 1;
    }
    seenIds.add(profileId);

    entries.push({
      profile: {
        id: profileId,
        label,
        description: shellPath,
      },
      shell: {
        command: shellPath,
        args: ['-l'],
        label,
      },
    });
  }

  return entries;
};

const resolveFallbackShell = (
  env: NodeJS.ProcessEnv,
  runtime: LinuxRuntime,
): ResolvedShell => {
  const entries = buildLinuxProfileEntries(env, runtime);
  if (entries.length > 0) {
    return entries[0].shell;
  }

  const fallbackPath = ['/bin/sh', '/usr/bin/sh'].find((candidatePath) =>
    runtime.pathExists(candidatePath),
  );
  if (fallbackPath) {
    return {
      command: fallbackPath,
      args: ['-l'],
      label: path.basename(fallbackPath),
    };
  }

  return {
    command: 'sh',
    args: ['-l'],
    label: 'sh',
  };
};

export const listLinuxTerminalProfiles = (
  env: NodeJS.ProcessEnv,
  runtime: LinuxRuntime = createRuntime(),
): TerminalProfile[] => {
  return buildLinuxProfileEntries(env, runtime).map((entry) => entry.profile);
};

export const resolveLinuxShell = (
  env: NodeJS.ProcessEnv,
  profileId: TerminalProfileId = 'default',
  runtime: LinuxRuntime = createRuntime(),
): ResolvedShell => {
  const normalizedProfileId = normalizeTerminalProfileId(profileId);
  const entries = buildLinuxProfileEntries(env, runtime);
  if (entries.length === 0) {
    return resolveFallbackShell(env, runtime);
  }

  if (normalizedProfileId === '' || normalizedProfileId === 'default') {
    const preferredShellPath = typeof env.SHELL === 'string' ? env.SHELL.trim() : '';
    const preferredEntry = entries.find((entry) => entry.shell.command === preferredShellPath);
    return preferredEntry?.shell ?? entries[0].shell;
  }

  const matchedEntry = entries.find((entry) => {
    const labelId = normalizeTerminalProfileId(entry.profile.label);
    return entry.profile.id === normalizedProfileId || labelId === normalizedProfileId;
  });

  return matchedEntry?.shell ?? entries[0].shell;
};
