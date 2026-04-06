import path from 'node:path';

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const OSC_TERMINATOR_PATTERN = `(?:${BEL}|${ESC}\\\\)`;
const ESCAPE_EXCLUSION_PATTERN = `[^${BEL}${ESC}]`;

const OSC_7_CWD_PATTERN = new RegExp(
  `${ESC}\\]7;file://[^/${BEL}${ESC}]*(/${ESCAPE_EXCLUSION_PATTERN}*?)${OSC_TERMINATOR_PATTERN}`,
  'g',
);
const OSC_633_CWD_PATTERN = new RegExp(
  `${ESC}\\]633;P;Cwd=(${ESCAPE_EXCLUSION_PATTERN}*?)${OSC_TERMINATOR_PATTERN}`,
  'g',
);
const ANSI_CSI_SEQUENCE_PATTERN = new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, 'g');
const POWERSHELL_PROMPT_PATTERN = /(?:^|\r?\n)\s*PS\s+([^>\r\n]+)>/gi;
const CMD_PROMPT_PATTERN = /(?:^|\r?\n)\s*([a-z]:\\[^>\r\n]*)>/gi;

const stripWrappingQuotes = (value: string): string => {
  if (value.length >= 2) {
    const firstChar = value[0];
    const lastChar = value[value.length - 1];
    if ((firstChar === '"' && lastChar === '"') || (firstChar === '\'' && lastChar === '\'')) {
      return value.slice(1, -1);
    }
  }
  return value;
};

const getPathApi = (platform: NodeJS.Platform): typeof path.posix | typeof path.win32 => {
  return platform === 'win32' ? path.win32 : path.posix;
};

const normalizePathForPlatform = (candidatePath: string, platform: NodeJS.Platform): string | null => {
  let nextPath = candidatePath.trim();
  if (nextPath.length === 0) {
    return null;
  }

  if (platform === 'win32') {
    if (/^\/[a-z]:\//i.test(nextPath)) {
      nextPath = nextPath.slice(1);
    }
    nextPath = nextPath.replace(/\//g, '\\');
    return path.win32.normalize(nextPath);
  }

  return path.posix.normalize(nextPath);
};

const readLastMatch = (pattern: RegExp, value: string): string | null => {
  pattern.lastIndex = 0;
  let lastMatch: string | null = null;
  let match = pattern.exec(value);
  while (match !== null) {
    lastMatch = match[1] ?? null;
    match = pattern.exec(value);
  }
  return lastMatch;
};

const decodeUriPath = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizePromptPath = (value: string, platform: NodeJS.Platform): string | null => {
  let normalizedPath = value.trim();
  const providerPrefixIndex = normalizedPath.lastIndexOf('::');
  if (providerPrefixIndex >= 0) {
    normalizedPath = normalizedPath.slice(providerPrefixIndex + 2).trim();
  }
  return normalizePathForPlatform(normalizedPath, platform);
};

const extractPromptCwdFromOutput = (
  output: string,
  platform: NodeJS.Platform,
): string | null => {
  const sanitizedOutput = output
    .replace(ANSI_CSI_SEQUENCE_PATTERN, '')
    .replace(OSC_7_CWD_PATTERN, '')
    .replace(OSC_633_CWD_PATTERN, '');

  const powershellPath = readLastMatch(POWERSHELL_PROMPT_PATTERN, sanitizedOutput);
  if (powershellPath) {
    return normalizePromptPath(powershellPath, platform);
  }

  const cmdPath = readLastMatch(CMD_PROMPT_PATTERN, sanitizedOutput);
  if (cmdPath) {
    return normalizePromptPath(cmdPath, platform);
  }

  return null;
};

const resolveCommandTarget = (
  commandLine: string,
): string | null => {
  const firstCommand = commandLine.split(/&&|\|\||;/)[0]?.trim() ?? '';
  if (firstCommand.length === 0) {
    return null;
  }

  const cdLikeMatch = /^(cd|chdir|sl)\b(.*)$/i.exec(firstCommand);
  if (cdLikeMatch) {
    let remainder = cdLikeMatch[2]?.trim() ?? '';
    remainder = remainder.replace(/^\/d(\s+|$)/i, '').trim();
    remainder = remainder.replace(/^--(\s+|$)/, '').trim();
    return remainder;
  }

  const setLocationMatch = /^set-location\b(.*)$/i.exec(firstCommand);
  if (setLocationMatch) {
    let remainder = setLocationMatch[1]?.trim() ?? '';
    remainder = remainder.replace(/^-path\s+/i, '').trim();
    remainder = remainder.replace(/^-literalpath\s+/i, '').trim();
    return remainder;
  }

  return null;
};

const resolveHomePath = (
  targetPath: string,
  homeDirectory: string,
  pathApi: typeof path.posix | typeof path.win32,
): string => {
  if (targetPath === '~') {
    return homeDirectory;
  }

  if (targetPath.startsWith('~/') || targetPath.startsWith('~\\')) {
    return pathApi.join(homeDirectory, targetPath.slice(2));
  }

  return targetPath;
};

const isPrintableCharacter = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return code >= 0x20 && code !== 0x7f;
};

const skipEscapeSequence = (value: string, escapeStartIndex: number): number => {
  const nextChar = value[escapeStartIndex + 1];
  if (nextChar === '[' || nextChar === 'O') {
    let index = escapeStartIndex + 2;
    while (index < value.length) {
      const code = value.charCodeAt(index);
      if (code >= 0x40 && code <= 0x7e) {
        return index + 1;
      }
      index += 1;
    }
    return value.length;
  }

  if (nextChar === ']') {
    let index = escapeStartIndex + 2;
    while (index < value.length) {
      if (value[index] === '\u0007') {
        return index + 1;
      }
      if (value[index] === '\u001b' && value[index + 1] === '\\') {
        return index + 2;
      }
      index += 1;
    }
    return value.length;
  }

  return escapeStartIndex + 1;
};

export const extractTrackedCwdFromOutput = (
  output: string,
  platform: NodeJS.Platform,
): string | null => {
  const osc633Path = readLastMatch(OSC_633_CWD_PATTERN, output);
  if (osc633Path) {
    return normalizePathForPlatform(osc633Path, platform);
  }

  const osc7Path = readLastMatch(OSC_7_CWD_PATTERN, output);
  if (osc7Path) {
    const decodedPath = decodeUriPath(osc7Path);
    return normalizePathForPlatform(decodedPath, platform);
  }

  return extractPromptCwdFromOutput(output, platform);
};

export const resolveNextCwdFromCommand = (
  commandLine: string,
  currentCwd: string,
  homeDirectory: string,
  platform: NodeJS.Platform,
): string | null => {
  const target = resolveCommandTarget(commandLine);
  if (target === null) {
    return null;
  }

  const sanitizedTarget = stripWrappingQuotes(target.trim());
  if (sanitizedTarget === '-') {
    return null;
  }

  const pathApi = getPathApi(platform);
  const targetWithHome = resolveHomePath(
    sanitizedTarget.length > 0 ? sanitizedTarget : '~',
    homeDirectory,
    pathApi,
  );

  const baseDirectory = currentCwd.trim().length > 0 ? currentCwd : homeDirectory;
  const resolvedPath = pathApi.isAbsolute(targetWithHome)
    ? targetWithHome
    : pathApi.resolve(baseDirectory, targetWithHome);

  return pathApi.normalize(resolvedPath);
};

export const consumeTerminalInputData = (
  previousBuffer: string,
  input: string,
  onCommand: (commandLine: string) => void,
): string => {
  let nextBuffer = previousBuffer;
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char === '\u001b') {
      index = skipEscapeSequence(input, index);
      continue;
    }

    if (char === '\u0003') {
      nextBuffer = '';
      index += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      const commandLine = nextBuffer.trim();
      if (commandLine.length > 0) {
        onCommand(commandLine);
      }
      nextBuffer = '';
      index += 1;
      continue;
    }

    if (char === '\u0008' || char === '\u007f') {
      nextBuffer = nextBuffer.slice(0, -1);
      index += 1;
      continue;
    }

    if (isPrintableCharacter(char)) {
      nextBuffer += char;
    }
    index += 1;
  }

  return nextBuffer;
};
