import { useContext } from 'react';
import {
  TerminalRuntimeContext,
  type TerminalRuntimeContextValue,
} from './TerminalRuntimeProvider';

export const useTerminalRuntime = (): TerminalRuntimeContextValue => {
  const context = useContext(TerminalRuntimeContext);
  if (!context) {
    throw new Error('useTerminalRuntime must be used inside a TerminalRuntimeProvider.');
  }
  return context;
};
