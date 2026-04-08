import type { TerminalGitStatus } from '../../shared/terminal-types';

const BRANCH_PREFIX = '# branch.head ';

export const parseGitStatusOutput = (
  output: string,
  terminalId: string,
): TerminalGitStatus => {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let branchName: string | null = null;
  let isDirty = false;

  for (const line of lines) {
    if (line.startsWith(BRANCH_PREFIX)) {
      const rawBranchName = line.slice(BRANCH_PREFIX.length).trim();
      if (rawBranchName.length > 0 && rawBranchName !== '(detached)') {
        branchName = rawBranchName;
      } else if (rawBranchName === '(detached)') {
        branchName = 'detached';
      }
      continue;
    }

    if (!line.startsWith('#')) {
      isDirty = true;
    }
  }

  return {
    terminalId,
    branchName,
    isDirty,
  };
};
