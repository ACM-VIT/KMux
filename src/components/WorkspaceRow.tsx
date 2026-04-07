import React, { useState, useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { Workspace } from '../store/useCanvasStore';
import { TerminalPanel } from './TerminalPanel';
import { getWidthVW, GAPS_VW } from '../utils/layout';

interface Props {
  workspace: Workspace;
  isActiveWorkspace: boolean;
}


export const WorkspaceRow: React.FC<Props> = ({ workspace, isActiveWorkspace }) => {
  const [viewOffset, setViewOffset] = useState(0);
  const { theme } = useCanvasStore();

  useEffect(() => {
    if (workspace.terminals.length === 0) return;

    const { activeTerminalIndex, terminals } = workspace;

    let totalRowWidth = 0;
    terminals.forEach(t => {
      totalRowWidth += getWidthVW(t.widthFraction) + GAPS_VW;
    });
    totalRowWidth -= GAPS_VW;

    let targetOffset = 0;

    if (totalRowWidth <= 102) {
      targetOffset = (totalRowWidth - 100) / 2;
    } else {
      let activeLeft = 0;
      for (let i = 0; i < activeTerminalIndex; i++) {
        activeLeft += getWidthVW(terminals[i].widthFraction) + GAPS_VW;
      }
      const activeWidth = getWidthVW(terminals[activeTerminalIndex].widthFraction);
      targetOffset = activeLeft + (activeWidth / 2) - 50 + (GAPS_VW / 2);
    }
    
    if (Math.abs(targetOffset - viewOffset) > 0.01) {
      setViewOffset(targetOffset);
    }
  }, [workspace.activeTerminalIndex, workspace.terminals]);

  return (
    <div
      className={`w-screen h-screen flex-shrink-0 flex items-center transition-opacity duration-500 ${
        isActiveWorkspace ? 'opacity-100' : 'opacity-40'
      }`}
    >
      {workspace.terminals.length === 0 ? (
        <div className="w-full text-center select-none">
          {isActiveWorkspace ? (
            <div>
              <p
                className="text-xs tracking-[0.4em] uppercase mb-3 animate-pulse"
                style={{ color: theme.accent, opacity: 0.5, fontFamily: 'JetBrains Mono, monospace' }}
              >
                empty workspace
              </p>
              <p style={{ color: theme.textDim, fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', letterSpacing: '0.2em' }}>
                press <span style={{ color: theme.accent }}>alt + enter</span> to spawn terminal
              </p>
            </div>
          ) : (
            <p
              className="text-xs tracking-[0.4em] uppercase"
              style={{ color: theme.textDim, opacity: 0.2, fontFamily: 'JetBrains Mono, monospace' }}
            >
              empty workspace
            </p>
          )}
        </div>
      ) : (
        <div
          className="flex transition-transform duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{ transform: `translateX(${-viewOffset}vw)` }}
        >
          {workspace.terminals.map((term, index) => (
            <TerminalPanel
              key={term.id}
              terminal={term}
              terminalIndex={index}
              isActive={isActiveWorkspace && index === workspace.activeTerminalIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
};
