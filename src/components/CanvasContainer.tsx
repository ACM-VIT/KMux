import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { WorkspaceRow } from './WorkspaceRow';

export const CanvasContainer: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceIndex,
    isOverview,
    moveTerminal,
    moveWorkspace,
    addTerminal,
    removeTerminal,
    resizeTerminal,
    toggleOverview,
  } = useCanvasStore();

  const [controlsVisible, setControlsVisible] = useState(true);
  // Keep a stable ref to the hide-timer so we can reset it on every keydown
  // regardless of whether controlsVisible has changed.
  const hideTimerRef = useRef<number | undefined>(undefined);

  const resetHideTimer = React.useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 5000);
  }, []);

  // Start the initial hide-timer on mount; cancel on unmount.
  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimerRef.current);
  }, [resetHideTimer]);

  // Global keyboard handler — registered with capture:true so it fires
  // before xterm.js (or any focused element) can swallow the event.
  // Only Alt (Option on macOS) triggers shortcuts; metaKey (Cmd) is NOT
  // included to avoid hijacking Cmd+Q / Cmd+W and other platform shortcuts.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      resetHideTimer();

      if (e.altKey && !e.metaKey) {
        let handled = false;
        switch (e.key.toLowerCase()) {
          case 'arrowleft':  moveTerminal('left');      handled = true; break;
          case 'arrowright': moveTerminal('right');     handled = true; break;
          case 'arrowup':    moveWorkspace('up');       handled = true; break;
          case 'arrowdown':  moveWorkspace('down');     handled = true; break;
          case 'enter':      addTerminal();             handled = true; break;
          case 'w':
          case 'q':          removeTerminal();          handled = true; break;
          case 'o':          toggleOverview();          handled = true; break;
          case '-':          resizeTerminal('shrink');  handled = true; break;
          case '=':
          case '+':          resizeTerminal('expand');  handled = true; break;
        }
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [resetHideTimer, moveTerminal, moveWorkspace, addTerminal, removeTerminal, resizeTerminal, toggleOverview]);

  // ── Camera math ────────────────────────────────────────────────────────────
  // Vertical axis: slide the entire workspace stack by -100vh per step
  const translateY = -(activeWorkspaceIndex * 100);

  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ background: '#0d0806' }}
    >
      {/* Atmospheric ambient glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 30% 45%, rgba(180,60,20,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 50% 45% at 80% 80%, rgba(100,20,120,0.15) 0%, transparent 65%),
            radial-gradient(ellipse 40% 30% at 70% 20%, rgba(120,30,10,0.08) 0%, transparent 60%)
          `,
        }}
      />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(232,220,200,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(232,220,200,0.5) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      {/* ── Main canvas — vertical + overview transforms applied here ── */}
      <div
        className="w-full h-full transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{ transform: isOverview ? 'scale(0.28)' : 'scale(1)' }}
      >
        <div
          className="flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform"
          style={{ transform: `translateY(${translateY}vh)` }}
        >
          {workspaces.map((ws, i) => (
            <WorkspaceRow
              key={ws.id}
              workspace={ws}
              isActiveWorkspace={i === activeWorkspaceIndex}
            />
          ))}
        </div>
      </div>

      {/* Workspace indicator — vertical dot strip on the left */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
        {workspaces.map((_, i) => (
          <div
            key={i}
            className="transition-all duration-300"
            style={{
              width:  i === activeWorkspaceIndex ? '20px' : '6px',
              height: '6px',
              borderRadius: '3px',
              background: i === activeWorkspaceIndex
                ? 'rgba(255,110,60,0.9)'
                : 'rgba(232,220,200,0.2)',
              boxShadow: i === activeWorkspaceIndex ? '0 0 8px rgba(255,110,60,0.5)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Controls overlay — auto-hides after 5s */}
      <div
        className={`absolute top-5 right-5 z-50 transition-opacity duration-1000 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="px-4 py-3 rounded-lg text-xs font-mono"
          style={{
            background: 'rgba(20,12,8,0.85)',
            border: '1px solid rgba(232,220,200,0.08)',
            backdropFilter: 'blur(20px)',
            color: 'rgba(232,220,200,0.5)',
            letterSpacing: '0.05em',
          }}
        >
          <p
            className="mb-2 pb-2 font-semibold text-xs tracking-widest uppercase"
            style={{ color: 'rgba(255,110,60,0.8)', borderBottom: '1px solid rgba(255,110,60,0.1)' }}
          >
            kmux controls
          </p>
          <p>alt + ←/→ · focus terminal</p>
          <p>alt + ↑/↓ · switch workspace</p>
          <p>alt + enter · new terminal</p>
          <p>alt + q/w · close terminal</p>
          <p>alt + o · overview</p>
          <p>alt + -/= · resize</p>
        </div>
      </div>

      {/* Active workspace label — bottom centre */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-1000"
        style={{ opacity: controlsVisible ? 0.6 : 0 }}
      >
        <span
          className="text-xs tracking-[0.3em] uppercase font-mono"
          style={{ color: 'rgba(232,220,200,0.4)' }}
        >
          workspace {activeWorkspaceIndex + 1}
        </span>
      </div>
    </div>
  );
};
