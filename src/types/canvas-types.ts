import type { TerminalProfileId } from '../terminal/shared/terminal-profiles';

export type WidthFraction = '1/3' | '1/2' | '2/3' | '1';

export interface Terminal {
  id: string;
  title: string;
  widthFraction?: WidthFraction;
  profileId?: TerminalProfileId;
}

export interface Workspace {
  id: string;
  title: string;
  terminals: Terminal[];
  activeTerminalIndex: number;
}

export interface Theme {
  name: string;
  bg: string;
  panelBg: string;
  accent: string;
  text: string;
  textDim: string;
  border: string;
}

export interface CanvasState {
  workspaces: Workspace[];
  activeWorkspaceIndex: number;
  isOverview: boolean;
  isSearchOpen: boolean;
  isTerminalFullscreen: boolean;
  theme: Theme;

  setTheme: (themeName: string) => void;
  cycleThemes: () => void;
  toggleSearch: () => void;
  jumpToGlobalTerminal: (terminalId: string) => void;
  jumpToWorkspace: (index: number) => void;
  moveWorkspace: (direction: 'up' | 'down') => void;
  moveTerminal: (direction: 'left' | 'right') => void;
  jumpToTerminal: (index: number) => void;
  addTerminal: (profileId?: TerminalProfileId) => void;
  addWorkspace: (profileId?: TerminalProfileId) => void;
  removeTerminal: () => void;
  resizeTerminal: (direction: 'shrink' | 'expand') => void;
  cycleWidth: () => void;
  toggleOverview: () => void;
  toggleTerminalFullscreen: () => void;
}
