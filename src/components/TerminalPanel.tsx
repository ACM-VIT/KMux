/**
 * TerminalPanel.tsx — Cinematic Render (Final Pass)
 */

import React from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { Terminal } from '../types/canvas-types';
import { TerminalViewport } from '../terminal/renderer/components/TerminalViewport';
import { useTerminalRuntime } from '../terminal/renderer/context/useTerminalRuntime';
import { getWidthVWString } from '../utils/layout';

interface Props {
  terminal: Terminal;
  terminalIndex: number;
  isActive: boolean;
}

export const TerminalPanel: React.FC<Props> = ({ terminal, terminalIndex, isActive }) => {
  const { theme, isOverview } = useCanvasStore();
  const { sessions } = useTerminalRuntime();
  const w = getWidthVWString(terminal.widthFraction);
  const shellLabel = sessions[terminal.id]?.shell ?? 'Starting';

  // Overview logic: in overview mode, everything should be fully bright (1).
  // In regular mode, inactive terminals are "highly" visible (0.9).
  const displayOpacity = isOverview ? 1 : (isActive ? 1 : 0.9);

  return (
    <div
      style={{
        width: w,
        height: '78vh',
        flexShrink: 0,
        margin: '0 1.5vw',
        borderRadius: '20px',
        border: (isActive || isOverview) ? `1.5px solid ${theme.accent}${isActive ? '' : '40'}` : '1.5px solid transparent',
        background: theme.panelBg,
        backdropFilter: (isActive || isOverview) ? 'blur(32px) saturate(160%)' : 'blur(10px)',
        transition: 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        opacity: displayOpacity,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: isActive ? `inset 0 0 60px ${theme.accent}10` : 'none',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          padding: '14px 22px',
          borderBottom: `1px solid ${isActive ? theme.border : 'transparent'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56b0' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2eb0' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93fb0' }} />
          </div>
          <span
            style={{
              marginLeft: 8,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: isActive ? theme.accent : theme.textDim,
              letterSpacing: '0.15em',
              fontWeight: 500,
              opacity: (isActive || isOverview) ? 1 : 0.5,
            }}
          >
            {`TERMINAL ${terminalIndex + 1} - ${shellLabel}`}
          </span>
        </div>
      </div>

      {/* Live xterm viewport */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
        }}
      >
        <TerminalViewport terminalId={terminal.id} isActive={isActive} />
      </div>
    </div>
  );
};
