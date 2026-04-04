import React, { useState, useEffect } from 'react';
import type { Workspace } from '../store/useCanvasStore';
import { TerminalPanel } from './TerminalPanel';

interface Props {
  workspace: Workspace;
  isActiveWorkspace: boolean;
}

const getWidthVW = (fraction: string | undefined): number => {
  switch (fraction) {
    case '1/3': return 30;
    case '1/2': return 48;
    case '2/3': return 66;
    case '1':   return 80;
    default:    return 80;
  }
};

export const WorkspaceRow: React.FC<Props> = ({ workspace, isActiveWorkspace }) => {
  const [viewOffset, setViewOffset] = useState(0);

  // Compute horizontal pan so the active terminal is always in view
  useEffect(() => {
    if (workspace.terminals.length === 0) return;

    const { activeTerminalIndex, terminals } = workspace;

    // Accumulate left position of the active terminal (in vw)
    let activeLeft = 0;
    for (let i = 0; i < activeTerminalIndex; i++) {
      activeLeft += getWidthVW(terminals[i].widthFraction) + 4; // 4vw = 2*mx-[1.5vw]
    }
    const activeWidth = getWidthVW(terminals[activeTerminalIndex].widthFraction) + 4;
    const activeRight = activeLeft + activeWidth;

    const padding = 4; // vw padding from viewport edge
    const viewportLeft = viewOffset;
    const viewportRight = viewOffset + 100;

    let next = viewOffset;
    if (activeLeft < viewportLeft + padding) {
      next = activeLeft - padding;
    } else if (activeRight > viewportRight - padding) {
      next = activeRight - 100 + padding;
    }
    next = Math.max(0, next);

    if (next !== viewOffset) setViewOffset(next);
  }, [workspace.activeTerminalIndex, workspace.terminals]);

  return (
    <div
      className={`w-screen h-screen flex-shrink-0 flex items-center transition-opacity duration-500 ${
        isActiveWorkspace ? 'opacity-100' : 'opacity-40'
      }`}
    >
      {workspace.terminals.length === 0 ? (
        /* Empty workspace hint */
        <div className="w-full text-center select-none">
          {isActiveWorkspace ? (
            <div>
              <p
                className="text-xs tracking-[0.4em] uppercase mb-3 animate-pulse"
                style={{ color: 'rgba(255,110,60,0.5)', fontFamily: 'JetBrains Mono, monospace' }}
              >
                empty workspace
              </p>
              <p style={{ color: 'rgba(232,220,200,0.2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', letterSpacing: '0.2em' }}>
                press <span style={{ color: 'rgba(255,110,60,0.6)' }}>alt + enter</span> to spawn terminal
              </p>
            </div>
          ) : (
            <p
              className="text-xs tracking-[0.4em] uppercase"
              style={{ color: 'rgba(232,220,200,0.1)', fontFamily: 'JetBrains Mono, monospace' }}
            >
              empty workspace
            </p>
          )}
        </div>
      ) : (
        /* Horizontal scrolling terminal row */
        <div
          className="flex transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{ transform: `translateX(${-viewOffset}vw)` }}
        >
          {workspace.terminals.map((term, index) => (
            <TerminalPanel
              key={term.id}
              terminal={term}
              isActive={isActiveWorkspace && index === workspace.activeTerminalIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
};
