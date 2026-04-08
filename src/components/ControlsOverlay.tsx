import React, { useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { ControlAction } from '../types/canvas-types';
import { createBindingTokenFromEvent, formatBindingDisplay } from '../utils/keyboard-bindings';

const CONTROL_ITEMS: Array<{
  action: ControlAction;
  label: string;
}> = [
  { action: 'moveTerminalLeft', label: 'Move Terminal Left' },
  { action: 'moveTerminalRight', label: 'Move Terminal Right' },
  { action: 'moveWorkspaceUp', label: 'Move Workspace Up' },
  { action: 'moveWorkspaceDown', label: 'Move Workspace Down' },
  { action: 'newTerminal', label: 'New Terminal' },
  { action: 'newWorkspace', label: 'New Workspace' },
  { action: 'closeTerminal', label: 'Close Terminal' },
  { action: 'overview', label: 'Toggle Overview' },
  { action: 'theme', label: 'Cycle Theme' },
  { action: 'search', label: 'Toggle Search' },
  { action: 'cycleWidth', label: 'Cycle Width Preset' },
  { action: 'resizeShrink', label: 'Resize Shrink' },
  { action: 'resizeExpand', label: 'Resize Expand' },
  { action: 'fullscreen', label: 'Toggle Fullscreen' },
  { action: 'terminalPicker', label: 'Open Terminal Picker' },
  { action: 'workspacePicker', label: 'Open Workspace Picker' },
];

export const ControlsOverlay: React.FC = () => {
  const {
    theme,
    isControlsOpen,
    toggleControls,
    controls,
    setControlBinding,
    resetControls,
  } = useCanvasStore();

  const [listeningAction, setListeningAction] = useState<ControlAction | null>(null);
  const [controlsError, setControlsError] = useState<string | null>(null);

  const actionLabelById = useMemo(() => {
    return Object.fromEntries(CONTROL_ITEMS.map((item) => [item.action, item.label])) as Record<
      ControlAction,
      string
    >;
  }, []);

  const findConflictingAction = (action: ControlAction, key: string): ControlAction | null => {
    const entries = Object.entries(controls) as Array<[ControlAction, string]>;
    for (const [existingAction, existingKey] of entries) {
      if (existingAction !== action && existingKey === key) {
        return existingAction;
      }
    }
    return null;
  };

  const duplicateBindings = useMemo(() => {
    const bucket = new Map<string, ControlAction[]>();
    const entries = Object.entries(controls) as Array<[ControlAction, string]>;
    for (const [action, key] of entries) {
      const existing = bucket.get(key);
      if (existing) {
        existing.push(action);
      } else {
        bucket.set(key, [action]);
      }
    }
    return Array.from(bucket.entries()).filter(([, actions]) => actions.length > 1);
  }, [controls]);

  const duplicateBindingsMessage = useMemo(() => {
    if (duplicateBindings.length === 0) {
      return null;
    }

    const [conflictingKey, actions] = duplicateBindings[0];
    const labels = actions.map((action) => actionLabelById[action] ?? action).join(', ');
    return `${formatBindingDisplay(conflictingKey)} is assigned to ${labels}.`;
  }, [actionLabelById, duplicateBindings]);

  useEffect(() => {
    if (!isControlsOpen) {
      setListeningAction(null);
      setControlsError(null);
    }
  }, [isControlsOpen]);

  useEffect(() => {
    if (!isControlsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!listeningAction) {
        if (event.key === 'Escape') {
          event.preventDefault();
          toggleControls();
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setListeningAction(null);
        setControlsError(null);
        return;
      }

      const nextValue = createBindingTokenFromEvent(event);
      if (!nextValue) {
        setControlsError('Press a non-modifier key or key combination.');
        return;
      }

      const conflictingAction = findConflictingAction(listeningAction, nextValue);
      if (conflictingAction) {
        const conflictingLabel = actionLabelById[conflictingAction] ?? conflictingAction;
        setControlsError(
          `Cannot assign ${formatBindingDisplay(nextValue)} because it is already used by "${conflictingLabel}".`,
        );
        return;
      }

      setControlBinding(listeningAction, nextValue);
      setListeningAction(null);
      setControlsError(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    actionLabelById,
    isControlsOpen,
    listeningAction,
    setControlBinding,
    toggleControls,
    controls,
  ]);

  if (!isControlsOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh] animate-in fade-in duration-200"
      onClick={() => {
        if (listeningAction) {
          return;
        }
        toggleControls();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/10 ring-1 ring-black/50"
        style={{
          background: theme.panelBg,
          backdropFilter: 'blur(40px) saturate(150%)',
          boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px ${theme.border}`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/5 bg-white/5 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold tracking-[0.02em]" style={{ color: theme.text }}>
                Controls
              </div>
              <div className="mt-1 text-[11px]" style={{ color: theme.textDim }}>
                Click Rebind, then press your desired key combination.
              </div>
            </div>
            <button
              type="button"
              className="rounded border px-2 py-1 text-[10px] uppercase"
              style={{ borderColor: theme.border, color: theme.textDim }}
              onClick={toggleControls}
              disabled={listeningAction !== null}
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-4 py-3">
          <div className="mb-3 rounded border px-3 py-2 text-[10px]" style={{ borderColor: theme.border, color: theme.textDim }}>
            Workspace jump remains fixed to Alt/Cmd + 1..0. Other shortcuts are editable.
          </div>

          {duplicateBindingsMessage ? (
            <div className="mb-3 rounded border px-3 py-2 text-[10px]" style={{ borderColor: 'rgba(239,68,68,0.45)', color: '#fca5a5' }}>
              Conflict detected: {duplicateBindingsMessage}
            </div>
          ) : null}

          {controlsError ? (
            <div className="mb-3 rounded border px-3 py-2 text-[10px]" style={{ borderColor: 'rgba(239,68,68,0.45)', color: '#fca5a5' }}>
              {controlsError}
            </div>
          ) : null}

          <div className="space-y-2">
            {CONTROL_ITEMS.map((item) => {
              const currentValue = controls[item.action];
              const isListening = listeningAction === item.action;
              const conflictingAction = findConflictingAction(item.action, currentValue);

              return (
                <div
                  key={item.action}
                  className="rounded border px-3 py-2"
                  style={{
                    borderColor: conflictingAction ? 'rgba(239,68,68,0.45)' : theme.border,
                  }}
                >
                  <div className="mb-1 text-[12px]" style={{ color: theme.text }}>
                    {item.label}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded border px-2 py-1 text-[10px]" style={{ borderColor: theme.border, color: theme.textDim, fontFamily: 'JetBrains Mono, monospace' }}>
                      {`Alt/Cmd + ${formatBindingDisplay(currentValue)}`}
                    </span>
                    <button
                      type="button"
                      className="h-7 min-w-[120px] rounded border px-3 text-[10px] uppercase"
                      style={{
                        borderColor: isListening ? theme.accent : theme.border,
                        color: isListening ? theme.accent : theme.text,
                      }}
                      onClick={() => {
                        setControlsError(null);
                        setListeningAction((current) => (current === item.action ? null : item.action));
                      }}
                    >
                      {isListening ? 'Press Keys...' : 'Rebind'}
                    </button>
                  </div>
                  {conflictingAction ? (
                    <div className="mt-1 text-[10px]" style={{ color: '#fca5a5' }}>
                      Also used by: {actionLabelById[conflictingAction] ?? conflictingAction}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 bg-black/10 px-4 py-2">
          <div className="text-[9px] uppercase tracking-wider" style={{ color: theme.textDim }}>
            Esc closes • Esc cancels rebind
          </div>
          <button
            type="button"
            className="h-7 rounded border px-3 text-[10px] uppercase"
            style={{ borderColor: theme.border, color: theme.textDim }}
            onClick={() => {
              setControlsError(null);
              setListeningAction(null);
              resetControls();
            }}
          >
            Reset To Defaults
          </button>
        </div>
      </div>
    </div>
  );
};
