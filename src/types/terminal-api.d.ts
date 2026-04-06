import type { TerminalApi } from '../terminal/shared/terminal-types';

declare global {
  interface Window {
    terminalApi: TerminalApi;
  }
}

export {};
