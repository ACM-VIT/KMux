import React, { useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '../../../store/useCanvasStore';
import type { TerminalProfileId } from '../../shared/terminal-profiles';
import { fallbackTerminalProfiles } from '../utils/terminal-picker-utils';
import {
  TerminalPickerContext,
  type TerminalPickerMode,
  type TerminalPickerContextValue,
} from './terminal-picker-context';

export const TerminalPickerProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const addTerminal = useCanvasStore((state) => state.addTerminal);
  const addWorkspace = useCanvasStore((state) => state.addWorkspace);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<TerminalPickerMode>('terminal');
  const [profiles, setProfiles] = useState(fallbackTerminalProfiles);

  useEffect(() => {
    void window.terminalApi
      .listTerminalProfiles()
      .then((availableProfiles) => {
        setProfiles(availableProfiles);
      })
      .catch((error) => {
        console.error('Failed to list terminal profiles.', error);
        setProfiles(fallbackTerminalProfiles);
      });
  }, []);

  const openPicker = (nextMode: TerminalPickerMode): void => {
    setMode(nextMode);
    setIsOpen(true);
  };

  const closePicker = (): void => {
    setIsOpen(false);
  };

  const confirmSelection = (profileId: TerminalProfileId): void => {
    if (profiles.length === 0) {
      return;
    }
    if (mode === 'workspace') {
      addWorkspace(profileId);
    } else {
      addTerminal(profileId);
    }
    setIsOpen(false);
  };

  const value = useMemo<TerminalPickerContextValue>(() => {
    return {
      isOpen,
      mode,
      profiles,
      openPicker,
      closePicker,
      confirmSelection,
    };
  }, [isOpen, mode, profiles]);

  return (
    <TerminalPickerContext.Provider value={value}>{children}</TerminalPickerContext.Provider>
  );
};
