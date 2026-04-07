import React from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { Terminal } from '../types/canvas-types';
import { getWidthVWString } from '../utils/layout';
import { GAPS_VW } from '../lib/constants';
import { TerminalViewport } from '../terminal/renderer/components/TerminalViewport';
import { useTerminalRuntime } from '../terminal/renderer/context/useTerminalRuntime';

interface Props {
  terminal: Terminal;
  terminalIndex: number;
  isActive: boolean;
}

export const TerminalPanel: React.FC<Props> = ({ terminal, terminalIndex, isActive }) => {
  const { theme, isOverview, isTerminalFullscreen, jumpToGlobalTerminal } = useCanvasStore();
  const { sessions } = useTerminalRuntime();
  const w = isTerminalFullscreen && isActive ? '96vw' : getWidthVWString(terminal.widthFraction);
  const shellLabel = sessions[terminal.id]?.shell ?? 'Starting';
  const displayOpacity = isOverview ? 1 : (isActive ? 1 : 0.9);

  return (
    <div
      onMouseDown={() => {
        if (!isActive) {
          jumpToGlobalTerminal(terminal.id);
        }
      }}
      style={{
        width: w,
        height: isTerminalFullscreen && isActive ? '94vh' : '86vh',
        flexShrink: 0,
        margin: isTerminalFullscreen && isActive ? '0' : `0 ${GAPS_VW / 2}vw`,
        borderRadius: '18px',
        border: (isActive || isOverview)
          ? `1.5px solid ${theme.accent}${isActive ? '' : '40'}`
          : '1.5px solid transparent',
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
      <div
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${isActive ? theme.border : 'transparent'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff5f56b0' }} />
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffbd2eb0' }} />
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#27c93fb0' }} />
          </div>
          <span
            style={{
              marginLeft: 4,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              color: isActive ? theme.accent : theme.textDim,
              letterSpacing: '0.12em',
              fontWeight: 500,
              opacity: (isActive || isOverview) ? 1 : 0.5,
            }}
          >
            {`TERMINAL ${terminalIndex + 1} - ${shellLabel}`}
          </span>
        </div>
      </div>

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
