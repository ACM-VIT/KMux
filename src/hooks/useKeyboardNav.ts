import { useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useTerminalPicker } from '../terminal/renderer/context/use-terminal-picker';
import { createBindingTokenFromEvent, normalizeBindingKey } from '../utils/keyboard-bindings';

export const useKeyboardNav = () => {
  const {
    moveTerminal,
    moveWorkspace,
    jumpToWorkspace,
    addTerminal,
    addWorkspace,
    removeTerminal,
    resizeTerminal,
    cycleWidth,
    toggleOverview,
    toggleTerminalFullscreen,
    cycleThemes,
    toggleSearch,
    isControlsOpen,
    controls,
  } = useCanvasStore();
  const { isOpen: isPickerOpen, openPicker } = useTerminalPicker();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPickerOpen || isControlsOpen) {
        return;
      }

      // Intercept Meta (Cmd/Win) or Alt keys
      if (e.metaKey || e.altKey) {
        let handled = false;
        const rawKey = normalizeBindingKey(e);
        const bindingToken = createBindingTokenFromEvent(e);

        if (!bindingToken) {
          return;
        }

        if (controls.terminalPicker === bindingToken) {
          openPicker('terminal');
          handled = true;
        } else if (controls.workspacePicker === bindingToken) {
          openPicker('workspace');
          handled = true;
        } else if (controls.fullscreen === bindingToken) {
          toggleTerminalFullscreen();
          handled = true;
        } else if (/^[0-9]$/.test(rawKey)) {
          jumpToWorkspace(rawKey === '0' ? 9 : parseInt(rawKey, 10) - 1);
          handled = true;
        } else {
          if (controls.moveTerminalLeft === bindingToken || rawKey === 'arrowleft') {
            moveTerminal('left');
            handled = true;
          } else if (controls.moveTerminalRight === bindingToken || rawKey === 'arrowright') {
            moveTerminal('right');
            handled = true;
          } else if (controls.moveWorkspaceUp === bindingToken || rawKey === 'arrowup') {
            moveWorkspace('up');
            handled = true;
          } else if (controls.moveWorkspaceDown === bindingToken || rawKey === 'arrowdown') {
            moveWorkspace('down');
            handled = true;
          } else if (controls.newTerminal === bindingToken) {
            addTerminal();
            handled = true;
          } else if (controls.newWorkspace === bindingToken) {
            addWorkspace();
            handled = true;
          } else if (
            controls.closeTerminal === bindingToken ||
            rawKey === 'w' ||
            rawKey === 'x'
          ) {
            removeTerminal();
            handled = true;
          } else if (controls.overview === bindingToken) {
            toggleOverview();
            handled = true;
          } else if (controls.theme === bindingToken) {
            cycleThemes();
            handled = true;
          } else if (controls.search === bindingToken) {
            toggleSearch();
            handled = true;
          } else if (controls.cycleWidth === bindingToken) {
            cycleWidth();
            handled = true;
          } else if (controls.resizeShrink === bindingToken) {
            resizeTerminal('shrink');
            handled = true;
          } else if (
            controls.resizeExpand === bindingToken ||
            rawKey === '+'
          ) {
            resizeTerminal('expand');
            handled = true;
          }
        }

        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // Use capturing phase to intercept commands reliably
    window.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    moveTerminal,
    moveWorkspace,
    jumpToWorkspace,
    addTerminal,
    addWorkspace,
    removeTerminal,
    resizeTerminal,
    cycleWidth,
    toggleOverview,
    toggleTerminalFullscreen,
    cycleThemes,
    toggleSearch,
    isControlsOpen,
    controls,
    isPickerOpen,
    openPicker,
  ]);
};
