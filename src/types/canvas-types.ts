import type { TerminalProfileId } from '../terminal/shared/terminal-profiles';

/**
 * Spatial Alignment Constants (vw)
 */
export type WidthFraction = '1/3' | '1/2' | '2/3' | '1';

/**
 * Unified Terminal Interface
 */
export interface Terminal {
  id: string;
  title: string;
  profileId?: TerminalProfileId;
  widthFraction: WidthFraction;
}

/**
 * Unified Workspace Interface
 */
export interface Workspace {
  id: string;
  title: string;
  terminals: Terminal[];
  activeTerminalIndex: number;
}

/**
 * Standard KMux Theme Definition
 */
export interface Theme {
  name: string;
  bg: string;
  panelBg: string;
  accent: string;
  text: string;
  textDim: string;
  border: string;
}

export type ControlAction =
  | 'moveTerminalLeft'
  | 'moveTerminalRight'
  | 'moveWorkspaceUp'
  | 'moveWorkspaceDown'
  | 'newTerminal'
  | 'newWorkspace'
  | 'closeTerminal'
  | 'overview'
  | 'theme'
  | 'search'
  | 'cycleWidth'
  | 'resizeShrink'
  | 'resizeExpand'
  | 'fullscreen'
  | 'terminalPicker'
  | 'workspacePicker';

export type AppControlBindings = Record<ControlAction, string>;

/**
 * Global Canvas State Machine
 */
export interface CanvasState {
  workspaces: Workspace[];
  activeWorkspaceIndex: number;
  isOverview: boolean;
  isSearchOpen: boolean;
  isControlsOpen: boolean;
  isTerminalFullscreen: boolean;
  theme: Theme;
  controls: AppControlBindings;

  setTheme: (themeName: string) => void;
  cycleThemes: () => void;
  toggleSearch: () => void;
  toggleControls: () => void;
  setControlsOpen: (isOpen: boolean) => void;
  setControlBinding: (action: ControlAction, key: string) => void;
  resetControls: () => void;
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
