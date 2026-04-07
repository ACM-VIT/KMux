import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeTerminalProfileId,
  type TerminalProfile,
  type TerminalProfileId,
} from '../../shared/terminal-profiles.ts';
import type { ResolvedShell } from './resolveShell';

const vsEditions = ['Enterprise', 'Professional', 'Community', 'BuildTools'] as const;
const vsVersions = ['2022', '2019', '2017'] as const;

interface WindowsProfileEntry {
  profile: TerminalProfile;
  shell: ResolvedShell;
  aliases: string[];
}

export interface WindowsProfileRuntime {
  pathExists: (candidatePath: string) => boolean;
  runCommand: (command: string, args: string[]) => { status: number | null; stdout: string };
}

const decodeCommandOutput = (stdout: Buffer | string | null | undefined): string => {
  if (stdout === null || stdout === undefined) {
    return '';
  }
  if (typeof stdout === 'string') {
    return stdout;
  }

  if (stdout.length >= 2 && stdout[0] === 0xff && stdout[1] === 0xfe) {
    return stdout.toString('utf16le');
  }

  if (stdout.includes(0)) {
    return stdout.toString('utf16le');
  }

  return stdout.toString('utf8');
};

const createRuntime = (): WindowsProfileRuntime => {
  return {
    pathExists: (candidatePath) => fs.existsSync(candidatePath),
    runCommand: (command, args) => {
      const result = spawnSync(command, args, {
        windowsHide: true,
      });
      return {
        status: result.status,
        stdout: decodeCommandOutput(result.stdout),
      };
    },
  };
};

const findFirstExistingPath = (
  paths: string[],
  runtime: WindowsProfileRuntime,
): string | null => {
  for (const candidatePath of paths) {
    if (runtime.pathExists(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
};

const findExecutableInPath = (
  env: NodeJS.ProcessEnv,
  executableNames: string[],
  runtime: WindowsProfileRuntime,
): string | null => {
  const pathEnv = env.PATH ?? env.Path ?? '';
  const segments = pathEnv.split(';').filter((segment) => segment.trim().length > 0);
  for (const segment of segments) {
    for (const executableName of executableNames) {
      const candidatePath = path.win32.join(segment, executableName);
      if (runtime.pathExists(candidatePath)) {
        return candidatePath;
      }
    }
  }
  return null;
};

const listVsInstallationRoots = (
  env: NodeJS.ProcessEnv,
  runtime: WindowsProfileRuntime,
): string[] => {
  const roots: string[] = [];
  const seen = new Set<string>();

  const pushRoot = (candidatePath: string | null | undefined): void => {
    if (!candidatePath || seen.has(candidatePath) || !runtime.pathExists(candidatePath)) {
      return;
    }
    seen.add(candidatePath);
    roots.push(candidatePath);
  };

  const programData = env.ProgramData ?? 'C:\\ProgramData';
  const vsWherePath = findFirstExistingPath(
    [
      path.win32.join(
        programData,
        'Microsoft',
        'VisualStudio',
        'Packages',
        '_Instances',
        'vswhere.exe',
      ),
      path.win32.join(
        env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
        'Microsoft Visual Studio',
        'Installer',
        'vswhere.exe',
      ),
      path.win32.join(
        env.ProgramFiles ?? 'C:\\Program Files',
        'Microsoft Visual Studio',
        'Installer',
        'vswhere.exe',
      ),
      findExecutableInPath(env, ['vswhere.exe'], runtime),
    ].filter((value): value is string => Boolean(value)),
    runtime,
  );

  if (vsWherePath) {
    const result = runtime.runCommand(vsWherePath, [
      '-products',
      '*',
      '-requires',
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property',
      'installationPath',
    ]);

    if (result.status === 0) {
      result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .forEach((line) => pushRoot(line));
    }
  }

  const programRoots = [
    env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    env.ProgramFiles ?? 'C:\\Program Files',
  ];

  for (const rootPath of programRoots) {
    for (const version of vsVersions) {
      for (const edition of vsEditions) {
        pushRoot(path.win32.join(rootPath, 'Microsoft Visual Studio', version, edition));
      }
    }
  }

  return roots;
};

const resolveCmd = (env: NodeJS.ProcessEnv): ResolvedShell => {
  if (typeof env.ComSpec === 'string' && env.ComSpec.trim().length > 0) {
    return {
      command: env.ComSpec,
      args: [],
      label: 'Command Prompt',
    };
  }
  return {
    command: 'cmd.exe',
    args: [],
    label: 'Command Prompt',
  };
};

const resolveWindowsPowerShell = (
  env: NodeJS.ProcessEnv,
  runtime: WindowsProfileRuntime,
): ResolvedShell | null => {
  const systemRoot = env.SystemRoot ?? 'C:\\Windows';
  const powershellPath = findFirstExistingPath(
    [path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')],
    runtime,
  );
  if (!powershellPath) {
    return null;
  }
  return {
    command: powershellPath,
    args: ['-NoLogo'],
    label: 'Windows PowerShell',
  };
};

const resolvePwsh = (
  env: NodeJS.ProcessEnv,
  runtime: WindowsProfileRuntime,
): ResolvedShell | null => {
  const programFiles = env.ProgramW6432 ?? env.ProgramFiles ?? 'C:\\Program Files';
  const programFilesX86 = env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const pwshFromPath = findExecutableInPath(env, ['pwsh.exe'], runtime);
  const pwshPath = findFirstExistingPath(
    [
      path.win32.join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
      path.win32.join(programFilesX86, 'PowerShell', '7', 'pwsh.exe'),
      ...(pwshFromPath ? [pwshFromPath] : []),
    ],
    runtime,
  );

  if (!pwshPath) {
    return null;
  }
  return {
    command: pwshPath,
    args: ['-NoLogo'],
    label: 'PowerShell',
  };
};

const findVsToolPath = (
  env: NodeJS.ProcessEnv,
  toolFileName: string,
  runtime: WindowsProfileRuntime,
): string | null => {
  const candidates: string[] = [];
  for (const installationRoot of listVsInstallationRoots(env, runtime)) {
    candidates.push(path.win32.join(installationRoot, 'Common7', 'Tools', toolFileName));
  }

  return findFirstExistingPath(candidates, runtime);
};

const createProfileEntry = (
  label: string,
  shell: ResolvedShell,
  aliases: string[] = [],
  description = '',
): WindowsProfileEntry => {
  const normalizedId = normalizeTerminalProfileId(label);
  const safeProfileId = normalizedId.length > 0 ? normalizedId : 'profile-unknown';
  return {
    profile: {
      id: safeProfileId,
      label,
      description,
    },
    shell: {
      command: shell.command,
      args: [...shell.args],
      label: shell.label,
    },
    aliases: aliases.map((alias) => normalizeTerminalProfileId(alias)),
  };
};

const listWslDistributions = (
  env: NodeJS.ProcessEnv,
  runtime: WindowsProfileRuntime,
): { wslPath: string | null; distributions: string[] } => {
  const systemRoot = env.SystemRoot ?? 'C:\\Windows';
  const wslPath =
    findFirstExistingPath(
      [
        path.win32.join(systemRoot, 'System32', 'wsl.exe'),
        path.win32.join(systemRoot, 'Sysnative', 'wsl.exe'),
      ],
      runtime,
    ) ?? findExecutableInPath(env, ['wsl.exe'], runtime);

  if (!wslPath) {
    return { wslPath: null, distributions: [] };
  }

  const result = runtime.runCommand(wslPath, ['-l', '-q']);
  if (result.status !== 0) {
    return { wslPath, distributions: [] };
  }

  const distributions = result.stdout
    .split(/\r?\n/)
    .map((line) =>
      line.split('\u0000').join('').replace(/^\uFEFF/, '').replace(/^\*/, '').trim(),
    )
    .filter((line) => line.length > 0)
    .filter((line) => normalizeTerminalProfileId(line).length > 0);

  return { wslPath, distributions };
};

const findAzureCloudShellExecutable = (
  env: NodeJS.ProcessEnv,
  runtime: WindowsProfileRuntime,
): string | null => {
  const localAppData = env.LOCALAPPDATA ?? '';
  const windowsAppsPath = localAppData.length > 0
    ? path.win32.join(localAppData, 'Microsoft', 'WindowsApps', 'azshell.exe')
    : null;

  const fromPath = findExecutableInPath(env, ['azshell.exe'], runtime);
  const candidates = [windowsAppsPath, fromPath].filter(
    (candidatePath): candidatePath is string => Boolean(candidatePath),
  );
  return findFirstExistingPath(candidates, runtime);
};

export const buildWindowsProfileEntries = (
  env: NodeJS.ProcessEnv,
  runtime: WindowsProfileRuntime = createRuntime(),
): WindowsProfileEntry[] => {
  const entries: WindowsProfileEntry[] = [];
  const commandPrompt = resolveCmd(env);
  const windowsPowerShell = resolveWindowsPowerShell(env, runtime);
  const powerShell = resolvePwsh(env, runtime);

  if (windowsPowerShell) {
    entries.push(createProfileEntry('Windows PowerShell', windowsPowerShell, ['windows-powershell']));
  }

  entries.push(createProfileEntry('Command Prompt', commandPrompt, ['command-prompt', 'cmd']));

  const azureShellExecutable = findAzureCloudShellExecutable(env, runtime);
  if (azureShellExecutable) {
    entries.push(
      createProfileEntry(
        'Azure Cloud Shell',
        {
          command: azureShellExecutable,
          args: [],
          label: 'Azure Cloud Shell',
        },
        ['azure-cloud-shell'],
      ),
    );
  }

  const { wslPath, distributions } = listWslDistributions(env, runtime);
  if (wslPath) {
    for (const distribution of distributions) {
      const aliases: string[] = [];
      if (normalizeTerminalProfileId(distribution) === 'ubuntu') {
        aliases.push('ubuntu');
      }
      entries.push(
        createProfileEntry(
          distribution,
          {
            command: wslPath,
            args: ['-d', distribution],
            label: distribution,
          },
          aliases,
        ),
      );
    }
  }

  const vsDevCmdPath = findVsToolPath(env, 'VsDevCmd.bat', runtime);
  if (vsDevCmdPath) {
    entries.push(
        createProfileEntry(
          'Developer Command Prompt for Visual Studio',
          {
            command: commandPrompt.command,
            args: ['/k', `"${vsDevCmdPath}" -arch=x64 -host_arch=x64`],
            label: 'Developer Command Prompt for Visual Studio',
          },
          ['developer-command-prompt', 'developer-command-prompt-vs'],
        ),
      );
    }

  const launchVsDevShellPath = findVsToolPath(env, 'Launch-VsDevShell.ps1', runtime);
  if (launchVsDevShellPath && (windowsPowerShell || powerShell)) {
    const shellBase = windowsPowerShell ?? powerShell;
    if (shellBase) {
      entries.push(
        createProfileEntry(
          'Developer PowerShell for Visual Studio',
          {
            command: shellBase.command,
            args: ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', launchVsDevShellPath],
            label: 'Developer PowerShell for Visual Studio',
          },
          ['developer-powershell', 'developer-powershell-vs'],
        ),
      );
    }
  }

  if (powerShell) {
    entries.push(createProfileEntry('PowerShell', powerShell, ['powershell', 'pwsh']));
  }

  const uniqueEntries: WindowsProfileEntry[] = [];
  const seenIds = new Set<string>();
  for (const entry of entries) {
    if (seenIds.has(entry.profile.id)) {
      continue;
    }
    seenIds.add(entry.profile.id);
    uniqueEntries.push(entry);
  }

  if (uniqueEntries.length === 0) {
    uniqueEntries.push(createProfileEntry('Command Prompt', commandPrompt, ['command-prompt', 'cmd']));
  }

  return uniqueEntries;
};

export const listWindowsTerminalProfiles = (
  env: NodeJS.ProcessEnv,
  runtime: WindowsProfileRuntime = createRuntime(),
): TerminalProfile[] => {
  return buildWindowsProfileEntries(env, runtime).map((entry) => entry.profile);
};

const resolveDefaultWindowsShell = (env: NodeJS.ProcessEnv, runtime: WindowsProfileRuntime): ResolvedShell => {
  const entries = buildWindowsProfileEntries(env, runtime);
  return entries[0]?.shell ?? resolveCmd(env);
};

export const resolveWindowsShell = (
  env: NodeJS.ProcessEnv,
  profileId: TerminalProfileId = 'default',
  runtime: WindowsProfileRuntime = createRuntime(),
): ResolvedShell => {
  const normalizedProfileId = normalizeTerminalProfileId(profileId);
  if (normalizedProfileId === 'default' || normalizedProfileId.length === 0) {
    return resolveDefaultWindowsShell(env, runtime);
  }

  const entries = buildWindowsProfileEntries(env, runtime);
  const selectedEntry = entries.find((entry) => {
    return (
      entry.profile.id === normalizedProfileId ||
      entry.aliases.includes(normalizedProfileId)
    );
  });

  if (selectedEntry) {
    return selectedEntry.shell;
  }

  return resolveDefaultWindowsShell(env, runtime);
};
