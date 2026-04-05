import { create } from 'zustand';

export interface Terminal {
  id: string;
  title: string;
  widthFraction?: '1/3' | '1/2' | '2/3' | '1';
}

export interface Workspace {
  id: string;
  terminals: Terminal[];
  activeTerminalIndex: number;
}

export interface CanvasState {
  workspaces: Workspace[];
  activeWorkspaceIndex: number;
  isOverview: boolean;

  moveWorkspace: (direction: 'up' | 'down') => void;
  moveTerminal: (direction: 'left' | 'right') => void;
  addTerminal: () => void;
  removeTerminal: () => void;
  resizeTerminal: (direction: 'shrink' | 'expand') => void;
  toggleOverview: () => void;
}

const createWorkspace = (empty: boolean = false): Workspace => ({
  id: `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  terminals: empty ? [] : [{ id: `term-${Date.now()}`, title: 'Terminal', widthFraction: '1' }],
  activeTerminalIndex: 0,
});

export const useCanvasStore = create<CanvasState>((set, get) => ({
  workspaces: [
    createWorkspace(false), // initial populated workspace
    createWorkspace(true),  // bottom empty workspace (Niri rule)
  ],
  activeWorkspaceIndex: 0,
  isOverview: false,

  toggleOverview: () => set((state) => ({ isOverview: !state.isOverview })),

  moveWorkspace: (direction) =>
    set((state) => {
      const { workspaces, activeWorkspaceIndex } = state;
      if (direction === 'up' && activeWorkspaceIndex > 0) {
        return { activeWorkspaceIndex: activeWorkspaceIndex - 1 };
      }
      if (direction === 'down' && activeWorkspaceIndex < workspaces.length - 1) {
        return { activeWorkspaceIndex: activeWorkspaceIndex + 1 };
      }
      return state;
    }),

  moveTerminal: (direction) =>
    set((state) => {
      const { workspaces, activeWorkspaceIndex } = state;
      const ws = workspaces[activeWorkspaceIndex];
      if (ws.terminals.length === 0) return state;

      let newIndex = ws.activeTerminalIndex;
      if (direction === 'left' && newIndex > 0) newIndex--;
      else if (direction === 'right' && newIndex < ws.terminals.length - 1) newIndex++;

      if (newIndex === ws.activeTerminalIndex) return state;

      const newWorkspaces = [...workspaces];
      newWorkspaces[activeWorkspaceIndex] = { ...ws, activeTerminalIndex: newIndex };
      return { workspaces: newWorkspaces };
    }),

  addTerminal: () =>
    set((state) => {
      const { workspaces, activeWorkspaceIndex } = state;
      const ws = workspaces[activeWorkspaceIndex];
      const newTerminal: Terminal = {
        id: `term-${Date.now()}`,
        title: `Terminal ${ws.terminals.length + 1}`,
        widthFraction: '1',
      };

      let newWorkspaces = [...workspaces];
      newWorkspaces[activeWorkspaceIndex] = {
        ...ws,
        terminals: [...ws.terminals, newTerminal],
        activeTerminalIndex: ws.terminals.length,
      };

      // Niri rule: if we activated the last (empty) workspace, append a new empty one
      if (activeWorkspaceIndex === workspaces.length - 1) {
        newWorkspaces.push(createWorkspace(true));
      }

      return { workspaces: newWorkspaces };
    }),

  removeTerminal: () =>
    set((state) => {
      const { workspaces, activeWorkspaceIndex } = state;
      const ws = workspaces[activeWorkspaceIndex];
      if (ws.terminals.length === 0) return state;

      let newWorkspaces = [...workspaces];
      let newActiveIdx = activeWorkspaceIndex;
      const newTerminals = ws.terminals.filter((_, i) => i !== ws.activeTerminalIndex);

      if (newTerminals.length > 0) {
        newWorkspaces[activeWorkspaceIndex] = {
          ...ws,
          terminals: newTerminals,
          activeTerminalIndex: Math.max(0, ws.activeTerminalIndex - 1),
        };
      } else {
        // Workspace is now empty — remove it unless it's the last one
        if (activeWorkspaceIndex < workspaces.length - 1) {
          newWorkspaces = workspaces.filter((_, i) => i !== activeWorkspaceIndex);
          newActiveIdx = Math.min(activeWorkspaceIndex, newWorkspaces.length - 1);
        } else {
          newWorkspaces[activeWorkspaceIndex] = { ...ws, terminals: [], activeTerminalIndex: 0 };
        }
      }

      // Final pass: keep exactly one empty workspace at the bottom
      newWorkspaces = newWorkspaces.filter(
        (w, i) => w.terminals.length > 0 || i === newWorkspaces.length - 1,
      );
      if (newWorkspaces[newWorkspaces.length - 1].terminals.length > 0) {
        newWorkspaces.push(createWorkspace(true));
      }
      newActiveIdx = Math.min(newActiveIdx, newWorkspaces.length - 1);

      return { workspaces: newWorkspaces, activeWorkspaceIndex: newActiveIdx };
    }),

  resizeTerminal: (direction) =>
    set((state) => {
      const { workspaces, activeWorkspaceIndex } = state;
      const ws = workspaces[activeWorkspaceIndex];
      if (ws.terminals.length === 0) return state;

      const active = ws.terminals[ws.activeTerminalIndex];
      const steps = ['1/3', '1/2', '2/3', '1'] as const;
      const idx = steps.indexOf(active.widthFraction || '1');
      let newIdx = idx;
      if (direction === 'shrink' && idx > 0) newIdx--;
      else if (direction === 'expand' && idx < steps.length - 1) newIdx++;
      if (newIdx === idx) return state;

      const newTerminals = [...ws.terminals];
      newTerminals[ws.activeTerminalIndex] = { ...active, widthFraction: steps[newIdx] };
      const newWorkspaces = [...workspaces];
      newWorkspaces[activeWorkspaceIndex] = { ...ws, terminals: newTerminals };
      return { workspaces: newWorkspaces };
    }),
}));
