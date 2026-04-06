import React, { useEffect, useState } from 'react';
import { useCanvasStore } from '../../../store/useCanvasStore';
import { formatProfileTitle } from '../utils/terminal-picker-utils';
import { useTerminalPicker } from '../context/use-terminal-picker';

export const TerminalPickerModal: React.FC = () => {
  const theme = useCanvasStore((state) => state.theme);
  const { isOpen, profiles, closePicker, confirmSelection } = useTerminalPicker();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSelectedIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (profiles.length === 0) {
        if (event.key === 'Escape') {
          closePicker();
          event.preventDefault();
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((current) => Math.min(current + 1, profiles.length - 1));
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowUp') {
        setSelectedIndex((current) => Math.max(current - 1, 0));
        event.preventDefault();
        return;
      }

      if (event.key === 'Enter') {
        const selectedProfile = profiles[selectedIndex];
        if (selectedProfile) {
          confirmSelection(selectedProfile.id);
        }
        event.preventDefault();
        return;
      }

      if (event.key === 'Escape') {
        closePicker();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [closePicker, confirmSelection, isOpen, profiles, selectedIndex]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center pt-[18vh] px-4"
      onClick={closePicker}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[560px] rounded-xl border overflow-hidden"
        style={{
          borderColor: theme.border,
          background: theme.panelBg,
          boxShadow: `0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px ${theme.border}`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="max-h-[300px] overflow-y-auto py-2 terminal-picker-scroll">
          {profiles.length > 0 ? (
            profiles.map((profile, index) => (
              <button
                key={profile.id}
                type="button"
                className="w-full text-left px-4 py-3 transition-colors"
                style={{
                  background: index === selectedIndex ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => confirmSelection(profile.id)}
              >
                <div className="text-sm font-medium" style={{ color: theme.text }}>
                  {formatProfileTitle(profile)}
                </div>
                {profile.description.length > 0 && (
                  <div
                    className="text-[11px] mt-1 uppercase tracking-wider"
                    style={{ color: theme.textDim }}
                  >
                    {profile.description}
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-sm" style={{ color: theme.textDim }}>
              no terminal profiles detected
            </div>
          )}
        </div>
        <div
          className="px-4 py-2 text-[10px] uppercase tracking-wide border-t"
          style={{ borderColor: theme.border, color: theme.textDim, background: 'rgba(255,255,255,0.03)' }}
        >
          use (down arrow) and (up arrow) to navigate, then press enter to select
        </div>
      </div>
    </div>
  );
};
