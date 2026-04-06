import path from 'node:path';
import type { ResolvedShell } from './resolveShell';

const KMUX_OSC_PREFIX = '\u001b]633;P;Cwd=';
const KMUX_OSC_SUFFIX = '\u001b\\';
const MAX_BUFFER_LENGTH = 4096;

export interface PreparedShellLaunch {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

const escapeForPowerShellSingleQuotedString = (value: string): string => {
  return value.replace(/'/g, "''");
};

const toShellName = (shell: ResolvedShell): string => {
  return path.basename(shell.command).toLowerCase();
};

export const prepareShellLaunch = (
  shell: ResolvedShell,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): PreparedShellLaunch => {
  const shellName = toShellName(shell);
  const nextEnv = { ...env };

  if (platform === 'win32') {
    if (shellName === 'cmd.exe') {
      const existingPrompt = nextEnv.PROMPT && nextEnv.PROMPT.trim().length > 0
        ? nextEnv.PROMPT
        : '$P$G';
      nextEnv.PROMPT = `$E]633;P;Cwd=$P$E\\\\${existingPrompt}`;
      return {
        command: shell.command,
        args: [...shell.args],
        env: nextEnv,
      };
    }

    if ((shellName === 'powershell.exe' || shellName === 'pwsh.exe') && !shell.args.includes('-File')) {
      const baseArgs = shell.args.filter((arg) => arg !== '-NoLogo');
      const script =
        "& {" +
        "$__kmuxPrompt = $function:prompt; " +
        "function global:prompt { " +
        "$e = [char]27; " +
        "$cwd = (Get-Location).Path; " +
        `Write-Host -NoNewline ('${escapeForPowerShellSingleQuotedString(KMUX_OSC_PREFIX)}' + $cwd + '${escapeForPowerShellSingleQuotedString(KMUX_OSC_SUFFIX)}'); ` +
        "if ($__kmuxPrompt) { $__kmuxPrompt.Invoke() } else { 'PS ' + $cwd + '> ' }" +
        " }" +
        "}";

      return {
        command: shell.command,
        args: ['-NoLogo', ...baseArgs, '-NoExit', '-Command', script],
        env: nextEnv,
      };
    }
  }

  if (shellName === 'bash' || shellName === 'sh') {
    const existingPromptCommand = nextEnv.PROMPT_COMMAND?.trim();
    const kmuxPromptCommand =
      `printf '${KMUX_OSC_PREFIX}%s${KMUX_OSC_SUFFIX}' "$PWD"`;
    nextEnv.PROMPT_COMMAND = existingPromptCommand
      ? `${kmuxPromptCommand};${existingPromptCommand}`
      : kmuxPromptCommand;
  }

  return {
    command: shell.command,
    args: [...shell.args],
    env: nextEnv,
  };
};

export const extractCwdFromTerminalOutput = (
  previousBuffer: string,
  nextChunk: string,
): { cwd: string | null; buffer: string } => {
  const combined = `${previousBuffer}${nextChunk}`;
  let searchIndex = 0;
  let latestCwd: string | null = null;

  while (searchIndex < combined.length) {
    const prefixIndex = combined.indexOf(KMUX_OSC_PREFIX, searchIndex);
    if (prefixIndex === -1) {
      break;
    }

    const valueStart = prefixIndex + KMUX_OSC_PREFIX.length;
    const stIndex = combined.indexOf(KMUX_OSC_SUFFIX, valueStart);
    const belIndex = combined.indexOf('\u0007', valueStart);
    const terminatorIndexCandidates = [stIndex, belIndex].filter((value) => value !== -1);

    if (terminatorIndexCandidates.length === 0) {
      break;
    }

    const terminatorIndex = Math.min(...terminatorIndexCandidates);
    latestCwd = combined.slice(valueStart, terminatorIndex).trim();
    searchIndex = terminatorIndex + 1;
  }

  const nextBuffer = combined.slice(-MAX_BUFFER_LENGTH);
  return {
    cwd: latestCwd && latestCwd.length > 0 ? latestCwd : null,
    buffer: nextBuffer,
  };
};
