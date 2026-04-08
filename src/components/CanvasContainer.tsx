import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChangesSidebar } from '../repo/renderer/components/ChangesSidebar';
import { useRepoDockState } from '../repo/renderer/hooks/useRepoDockState';
import { useCanvasStore } from '../store/useCanvasStore';
import { useTerminalRuntime } from '../terminal/renderer/context/useTerminalRuntime';
import { WorkspaceRow } from './WorkspaceRow';
import { FuzzyFinder } from './FuzzyFinder';
import {
  OVERVIEW_SCALE,
  SCREEN_HEIGHT_VH,
  TRANSITION_CANVAS,
  TRANSITION_UI,
} from '../lib/constants';

const ACTIVITY_BAR_WIDTH_PX = 48;
const SIDEBAR_PANEL_WIDTH_PX = 240;
const STATUS_BAR_HEIGHT_PX = 24;

export const CanvasContainer: React.FC = () => {
  const { workspaces, activeWorkspaceIndex, isOverview, theme } = useCanvasStore();
  const { sessions } = useTerminalRuntime();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDockHovering, setIsDockHovering] = useState(false);
  const [isDockShortcutVisible, setIsDockShortcutVisible] = useState(false);
  const dockShortcutTimerRef = useRef<number | null>(null);
  const repoDockState = useRepoDockState();
  const hasGitRepo = repoDockState.snapshot?.isRepo === true;
  const isDockVisible = hasGitRepo && (isDockHovering || isDockShortcutVisible);
  const leftDockWidth = isDockVisible
    ? ACTIVITY_BAR_WIDTH_PX + (isSidebarOpen ? SIDEBAR_PANEL_WIDTH_PX : 0)
    : 0;
  const workspaceIndicatorLeft = Math.max(12, leftDockWidth + 8);
  const translateY = -(activeWorkspaceIndex * SCREEN_HEIGHT_VH);

  const clearDockShortcutTimer = (): void => {
    if (dockShortcutTimerRef.current !== null) {
      window.clearTimeout(dockShortcutTimerRef.current);
      dockShortcutTimerRef.current = null;
    }
  };

  const revealDockFromShortcut = (): void => {
    clearDockShortcutTimer();
    setIsDockShortcutVisible(true);
    dockShortcutTimerRef.current = window.setTimeout(() => {
      setIsDockShortcutVisible(false);
      dockShortcutTimerRef.current = null;
    }, 1800);
  };

  useEffect(() => {
    if (!hasGitRepo) {
      setIsSidebarOpen(false);
      setIsDockHovering(false);
      setIsDockShortcutVisible(false);
      clearDockShortcutTimer();
    }
  }, [hasGitRepo]);

  useEffect(() => {
    return () => {
      clearDockShortcutTimer();
    };
  }, []);

  useEffect(() => {
    const handleDockShortcut = (event: KeyboardEvent): void => {
      if (!hasGitRepo) {
        return;
      }
      if (!(event.metaKey || event.altKey) || event.key.toLowerCase() !== 'd' || event.repeat) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      revealDockFromShortcut();
      setIsSidebarOpen((current) => !current);
    };

    window.addEventListener('keydown', handleDockShortcut, true);
    return () => {
      window.removeEventListener('keydown', handleDockShortcut, true);
    };
  }, [hasGitRepo]);

  const activeWorkspace = workspaces[activeWorkspaceIndex];
  const activeTerminal = activeWorkspace
    ? activeWorkspace.terminals[activeWorkspace.activeTerminalIndex]
    : undefined;
  const activeSession = activeTerminal ? sessions[activeTerminal.id] : undefined;
  const profileLabel = activeSession?.shell ?? activeTerminal?.profileId ?? 'local';
  const isRemoteProfile = /ssh|remote|wsl|container/i.test(profileLabel);

  const totalChanges = useMemo(() => {
    if (!repoDockState.snapshot?.isRepo) {
      return 0;
    }
    const status = repoDockState.snapshot.status;
    return status.modified + status.added + status.deleted + status.untracked + status.conflicts;
  }, [repoDockState.snapshot]);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none cursor-default"
      style={{
        background: theme.bg,
        transition: `background ${TRANSITION_UI}`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(70% 45% at 18% 42%, ${theme.accent}10 0%, transparent 68%),
            radial-gradient(55% 42% at 78% 16%, rgba(255,255,255,0.035) 0%, transparent 72%),
            linear-gradient(180deg, rgba(255,255,255,0.015), transparent 22%)
          `,
        }}
      />

      {hasGitRepo && !isDockVisible ? (
        <div
          className="absolute left-0 top-0 z-40"
          style={{
            width: '16px',
            height: `calc(100% - ${STATUS_BAR_HEIGHT_PX}px)`,
          }}
          onMouseEnter={() => setIsDockHovering(true)}
        />
      ) : null}

      <div
        className="absolute top-0 right-0 overflow-hidden transition-[width,height,transform] duration-150 ease-out"
        style={{
          width: `calc(100% - ${leftDockWidth}px)`,
          height: `calc(100% - ${STATUS_BAR_HEIGHT_PX}px)`,
        }}
      >
        <div
          className="w-full h-full"
          style={{
            transition: `transform ${TRANSITION_CANVAS}`,
            transform: isOverview ? `scale(${OVERVIEW_SCALE})` : 'scale(1)',
            transformOrigin: 'center center',
          }}
        >
          <div
            className="w-full h-full transition-transform"
            style={{
              transition: `transform ${TRANSITION_CANVAS}`,
              transform: `translateY(${translateY}vh)`,
            }}
          >
            {workspaces.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                workspace={ws}
                isActiveWorkspace={ws.id === workspaces[activeWorkspaceIndex]?.id}
              />
            ))}
          </div>
        </div>

      </div>

      <FuzzyFinder />

      <div
        className="absolute left-0 top-0 h-full overflow-hidden transition-[width] duration-150 ease-out"
        style={{
          width: `${leftDockWidth}px`,
          height: `calc(100% - ${STATUS_BAR_HEIGHT_PX}px)`,
          borderRight: isDockVisible ? `1px solid ${theme.border}` : 'none',
          background: `linear-gradient(180deg, ${theme.panelBg}, rgba(0,0,0,0.18))`,
          boxShadow: `10px 0 28px rgba(0,0,0,0.35)`,
          zIndex: 35,
          pointerEvents: isDockVisible ? 'auto' : 'none',
        }}
        onMouseEnter={() => {
          clearDockShortcutTimer();
          setIsDockShortcutVisible(false);
          setIsDockHovering(true);
        }}
        onMouseLeave={() => {
          setIsDockHovering(false);
        }}
      >
        <ChangesSidebar
          isOpen={hasGitRepo && isSidebarOpen}
          onToggle={() => {
            if (!hasGitRepo) {
              return;
            }
            setIsSidebarOpen((current) => !current);
          }}
          state={repoDockState}
        />
      </div>

      <div
        className="pointer-events-none absolute top-0 z-30 w-7 transition-[left] duration-150 ease-out"
        style={{
          left: `${Math.max(10, leftDockWidth - 3)}px`,
          height: `calc(100% - ${STATUS_BAR_HEIGHT_PX}px)`,
          background: `linear-gradient(90deg, ${theme.accent}44 0%, ${theme.accent}16 34%, transparent 100%)`,
          filter: 'blur(12px)',
          opacity: isDockVisible ? 0.9 : 0,
        }}
      />

      <div
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40 transition-[left] duration-150 ease-out"
        style={{ left: `${workspaceIndicatorLeft}px` }}
      >
        {workspaces.map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-center rounded-lg transition-all duration-700 text-[9px] font-mono font-bold"
            style={{
              width: activeWorkspaceIndex === index ? '30px' : '19px',
              height: activeWorkspaceIndex === index ? '30px' : '19px',
              borderRadius: activeWorkspaceIndex === index ? '10px' : '8px',
              background:
                activeWorkspaceIndex === index
                  ? `linear-gradient(145deg, ${theme.accent}3a, ${theme.accent}14)`
                  : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeWorkspaceIndex === index ? `${theme.accent}a6` : theme.border}`,
              color: activeWorkspaceIndex === index ? theme.accent : theme.textDim,
              opacity: activeWorkspaceIndex === index ? 1 : Math.max(0.38, 0.66 - Math.abs(activeWorkspaceIndex - index) * 0.1),
              boxShadow:
                activeWorkspaceIndex === index
                  ? `0 0 0 1px ${theme.accent}30, 0 8px 22px ${theme.accent}45`
                  : 'none',
              transform:
                activeWorkspaceIndex === index
                  ? 'translateX(3px) scale(1.08)'
                  : `translateX(${-Math.min(Math.abs(activeWorkspaceIndex - index) * 2, 8)}px) scale(${Math.max(0.92, 1 - Math.abs(activeWorkspaceIndex - index) * 0.04)})`,
              fontFamily: 'var(--font-ui)',
              letterSpacing: '0.02em',
            }}
          >
            {index + 1}
          </div>
        ))}
      </div>

      <div
        className="absolute left-0 bottom-0 flex h-6 w-full items-center justify-between border-t px-3"
        style={{
          background: theme.panelBg,
          borderColor: theme.border,
          color: theme.textDim,
        }}
      >
        <div
          className="flex min-w-0 items-center gap-3 text-[11px]"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          <span style={{ color: theme.accent, fontFamily: 'JetBrains Mono, monospace' }}>
            {repoDockState.snapshot?.branch ?? 'no-repo'}
          </span>
          <span className="truncate">
            {repoDockState.activeCwd ?? 'No active directory'}
          </span>
          {totalChanges > 0 ? (
            <span style={{ color: theme.accent }}>{totalChanges} changed</span>
          ) : null}
        </div>
        <div
          className="flex items-center gap-3 text-[11px]"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          <span>WS {activeWorkspaceIndex + 1}</span>
          <button
            type="button"
            className="border px-2 leading-5"
            style={{
              borderColor: theme.border,
              color: isRemoteProfile ? theme.accent : theme.text,
              borderRadius: '2px',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            title="Active terminal profile"
          >
            {profileLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
