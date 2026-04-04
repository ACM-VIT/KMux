import React from 'react';
import type { Terminal } from '../store/useCanvasStore';

interface Props {
  terminal: Terminal;
  isActive: boolean;
}

/**
 * TerminalPanel — placeholder rectangle.
 * Actual xterm integration is Divyansh's scope.
 * This block exists solely so Prradyun's camera/physics has real DOM elements
 * to translate across the canvas.
 */
export const TerminalPanel: React.FC<Props> = ({ terminal, isActive }) => {
  const widthMap: Record<string, string> = {
    '1/3': '30vw',
    '1/2': '48vw',
    '2/3': '66vw',
    '1':   '80vw',
  };
  const widthStr = widthMap[terminal.widthFraction || '1'];

  return (
    <div
      className="h-[80vh] flex-shrink-0 mx-[1.5vw] rounded-xl flex flex-col transition-all duration-300 ease-out"
      style={{
        width: widthStr,
        background: isActive ? 'rgba(25, 14, 8, 0.95)' : 'rgba(18, 10, 6, 0.75)',
        border: isActive
          ? '1px solid rgba(255, 110, 60, 0.35)'
          : '1px solid rgba(232, 220, 200, 0.07)',
        boxShadow: isActive
          ? '0 0 0 1px rgba(255,110,60,0.1), 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,110,60,0.05)'
          : '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Title bar */}
      <div
        className="h-9 flex items-center px-4 flex-shrink-0 gap-3"
        style={{
          background: isActive ? 'rgba(255, 110, 60, 0.06)' : 'rgba(15, 8, 4, 0.8)',
          borderBottom: isActive
            ? '1px solid rgba(255, 110, 60, 0.12)'
            : '1px solid rgba(232, 220, 200, 0.04)',
        }}
      >
        {/* Traffic light dots */}
        <div className="flex gap-1.5 items-center">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(192,57,43,0.7)' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(212,168,83,0.7)' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(125,186,132,0.7)' }} />
        </div>

        <span
          className="text-xs uppercase flex-1"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            color: isActive ? 'rgba(232,220,200,0.6)' : 'rgba(232,220,200,0.2)',
            letterSpacing: '0.18em',
            fontSize: '10px',
          }}
        >
          {terminal.title}
        </span>

        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            color: isActive ? 'rgba(255,110,60,0.5)' : 'rgba(232,220,200,0.1)',
            fontSize: '9px',
            letterSpacing: '0.1em',
          }}
        >
          [{terminal.widthFraction || '1'}]
        </span>
      </div>

      {/* Placeholder body */}
      <div className="flex-1 flex items-center justify-center">
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            letterSpacing: '0.2em',
            color: isActive ? 'rgba(255,110,60,0.25)' : 'rgba(232,220,200,0.08)',
          }}
        >
          terminal placeholder
        </span>
      </div>
    </div>
  );
};
