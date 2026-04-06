import type { TerminalProfile } from '../../shared/terminal-profiles';

export const fallbackTerminalProfiles: TerminalProfile[] = [];

export const formatProfileTitle = (profile: TerminalProfile): string => {
  return profile.label;
};
