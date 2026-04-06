/**
 * App.tsx — Root entry point
 *
 * Mounts the keyboard nav hook (Sujal) and renders CanvasContainer (Prradyun).
 * The dev harness has been promoted into the real app now that components are merged.
 */

import React from 'react';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { CanvasContainer } from './components/CanvasContainer';
import { TerminalPickerModal } from './terminal/renderer/components/TerminalPickerModal';
import { TerminalPickerProvider } from './terminal/renderer/context/TerminalPickerProvider';
import { TerminalRuntimeProvider } from './terminal/renderer/context/TerminalRuntimeProvider';

const AppContent: React.FC = () => {
  useKeyboardNav();
  return (
    <>
      <CanvasContainer />
      <TerminalPickerModal />
    </>
  );
};

export default function App(): React.JSX.Element {
  return (
    <TerminalRuntimeProvider>
      <TerminalPickerProvider>
        <AppContent />
      </TerminalPickerProvider>
    </TerminalRuntimeProvider>
  );
}
