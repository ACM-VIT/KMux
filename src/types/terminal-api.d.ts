import type { RepoApi } from '../repo/shared/repo-types';
import type { TerminalApi } from '../terminal/shared/terminal-types';

declare global {
  interface Window {
    repoApi: RepoApi;
    terminalApi: TerminalApi;
  }
}

export {};
