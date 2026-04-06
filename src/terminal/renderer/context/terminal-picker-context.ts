import { createContext } from 'react';
import type { TerminalProfile, TerminalProfileId } from '../../shared/terminal-profiles';

export type TerminalPickerMode = 'terminal' | 'workspace';

export interface TerminalPickerContextValue {
  isOpen: boolean;
  mode: TerminalPickerMode;
  profiles: TerminalProfile[];
  openPicker: (mode: TerminalPickerMode) => void;
  closePicker: () => void;
  confirmSelection: (profileId: TerminalProfileId) => void;
}

export const TerminalPickerContext = createContext<TerminalPickerContextValue | null>(null);
