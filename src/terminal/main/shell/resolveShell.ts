import type { TerminalProfile, TerminalProfileId } from '../../shared/terminal-profiles';
import { listDarwinTerminalProfiles, resolveDarwinShell } from './darwin';
import { listLinuxTerminalProfiles, resolveLinuxShell } from './linux';
import { listWindowsTerminalProfiles, resolveWindowsShell } from './windows';

export interface ResolvedShell {
  command: string;
  args: string[];
  label: string;
}

export const resolveShell = (
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  profileId?: TerminalProfileId,
): ResolvedShell => {
  switch (platform) {
    case 'win32':
      return resolveWindowsShell(env, profileId);
    case 'darwin':
      return resolveDarwinShell(env, profileId);
    default:
      return resolveLinuxShell(env, profileId);
  }
};

export const listTerminalProfiles = (platform: NodeJS.Platform): TerminalProfile[] => {
  switch (platform) {
    case 'win32':
      return listWindowsTerminalProfiles(process.env);
    case 'darwin':
      return listDarwinTerminalProfiles(process.env);
    default:
      return listLinuxTerminalProfiles(process.env);
  }
};
