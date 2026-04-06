import { useContext } from 'react';
import {
  TerminalPickerContext,
  type TerminalPickerContextValue,
} from './terminal-picker-context';

export const useTerminalPicker = (): TerminalPickerContextValue => {
  const context = useContext(TerminalPickerContext);
  if (!context) {
    throw new Error('useTerminalPicker must be used inside a TerminalPickerProvider.');
  }
  return context;
};
