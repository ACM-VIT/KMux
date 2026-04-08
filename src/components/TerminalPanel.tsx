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
  const w = isTerminalFullscreen && isActive ? 'calc(100% - 16px)' : getWidthVWString(terminal.widthFraction);
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
        height: isTerminalFullscreen && isActive ? 'calc(100% - 8px)' : '86%',
        flexShrink: 0,
        margin: isTerminalFullscreen && isActive ? '0' : `0 ${GAPS_VW / 2}vw`,
        borderRadius: '2px',
        border: `1px solid ${isActive || isOverview ? theme.accent : theme.border}`,
        background: theme.panelBg,
        transition: 'border-color 140ms linear, opacity 140ms linear',
        opacity: displayOpacity,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'none',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)',
          minHeight: '34px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f85149', opacity: 0.65 }} />
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d29922', opacity: 0.65 }} />
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3fb950', opacity: 0.65 }} />
          </div>
          <span
            style={{
              marginLeft: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: isActive ? theme.text : theme.textDim,
              letterSpacing: '0.04em',
              fontWeight: 500,
              opacity: isActive || isOverview ? 1 : 0.65,
            }}
          >
            {`terminal-${terminalIndex + 1} :: ${shellLabel}`}
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
